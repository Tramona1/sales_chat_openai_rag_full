-- Drop existing hybrid_search and keyword_search functions
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT 
            p.proname, 
            pg_get_function_identity_arguments(p.oid) AS args
        FROM 
            pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE 
            n.nspname = 'public' 
            AND p.proname IN ('hybrid_search', 'keyword_search', 'basic_text_search')
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || func_record.proname || '(' || func_record.args || ') CASCADE';
        RAISE NOTICE 'Dropped function: %(%)', func_record.proname, func_record.args;
    END LOOP;
END
$$;

-- Create the keyword_search function
CREATE OR REPLACE FUNCTION public.keyword_search(
  query_text TEXT,
  match_count INT DEFAULT 10
) RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  rank REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.text AS content,
    dc.metadata,
    ts_rank(to_tsvector('english', dc.text), plainto_tsquery('english', query_text)) AS rank
  FROM 
    document_chunks dc
  WHERE 
    to_tsvector('english', dc.text) @@ plainto_tsquery('english', query_text)
  ORDER BY 
    rank DESC
  LIMIT 
    match_count;
END;
$$;

-- Create the basic_text_search function
CREATE OR REPLACE FUNCTION public.basic_text_search(
  search_text TEXT,
  limit_count INT DEFAULT 10
) RETURNS TABLE (
  id UUID,
  document_id UUID,
  text TEXT,
  metadata JSONB
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.text,
    dc.metadata
  FROM 
    document_chunks dc
  WHERE 
    dc.text ILIKE '%' || search_text || '%'
  LIMIT 
    limit_count;
END;
$$;

-- Create the hybrid_search function with proper aliases
CREATE OR REPLACE FUNCTION public.hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(768),
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.2,
  filter JSONB DEFAULT NULL,
  vector_weight FLOAT DEFAULT 0.5,
  keyword_weight FLOAT DEFAULT 0.5
) RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_id TEXT,
  content TEXT,
  text TEXT,
  metadata JSONB,
  vector_score FLOAT,
  keyword_score FLOAT,
  combined_score FLOAT,
  search_type TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  -- Validate weights add up to 1.0
  IF vector_weight + keyword_weight != 1.0 THEN
    vector_weight := 0.5;
    keyword_weight := 0.5;
  END IF;

  -- First, find matches using vector search
  RETURN QUERY WITH vector_results AS (
    SELECT 
      dc.id,
      dc.document_id,
      dc.chunk_index::text AS chunk_id,
      dc.text AS content,
      dc.text,
      dc.metadata,
      (1 - (dc.embedding <=> query_embedding)) AS similarity,
      0.0 AS keyword_score,
      'vector' AS search_type
    FROM 
      document_chunks dc
    WHERE 
      -- Apply filter conditions if filter is provided
      (filter IS NULL OR (
        -- Primary category filter
        (filter->>'primaryCategory' IS NULL OR 
         dc.metadata->>'primaryCategory' = filter->>'primaryCategory')
        
        -- Technical level range filter
        AND (filter->>'technicalLevelMin' IS NULL OR 
             (dc.metadata->>'technicalLevel')::float >= (filter->>'technicalLevelMin')::float)
        AND (filter->>'technicalLevelMax' IS NULL OR 
             (dc.metadata->>'technicalLevel')::float <= (filter->>'technicalLevelMax')::float)
        
        -- Custom filters handling (like document_id)
        AND (filter->'customFilters' IS NULL OR (
          (filter->'customFilters'->>'document_id' IS NULL OR 
           dc.document_id::text = filter->'customFilters'->>'document_id')
        ))
      ))
      -- Apply similarity threshold
      AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
    ORDER BY 
      similarity DESC
    LIMIT 
      match_count
  ),
  
  -- Then find matches using keyword search
  keyword_results AS (
    SELECT 
      dc.id,
      dc.document_id,
      dc.chunk_index::text AS chunk_id,
      dc.text AS content,
      dc.text,
      dc.metadata,
      0.0 AS similarity,
      ts_rank(to_tsvector('english', dc.text), plainto_tsquery('english', query_text)) AS rank,
      'keyword' AS search_type
    FROM 
      document_chunks dc
    WHERE 
      -- Apply filter conditions if filter is provided
      (filter IS NULL OR (
        -- Primary category filter
        (filter->>'primaryCategory' IS NULL OR 
         dc.metadata->>'primaryCategory' = filter->>'primaryCategory')
        
        -- Technical level range filter
        AND (filter->>'technicalLevelMin' IS NULL OR 
             (dc.metadata->>'technicalLevel')::float >= (filter->>'technicalLevelMin')::float)
        AND (filter->>'technicalLevelMax' IS NULL OR 
             (dc.metadata->>'technicalLevel')::float <= (filter->>'technicalLevelMax')::float)
        
        -- Custom filters handling (like document_id)
        AND (filter->'customFilters' IS NULL OR (
          (filter->'customFilters'->>'document_id' IS NULL OR 
           dc.document_id::text = filter->'customFilters'->>'document_id')
        ))
      ))
      -- Match keyword query
      AND to_tsvector('english', dc.text) @@ plainto_tsquery('english', query_text)
    ORDER BY 
      rank DESC
    LIMIT 
      match_count
  ),
  
  -- Combine results
  combined_results AS (
    -- Vector results
    SELECT 
      vr.id,
      vr.document_id,
      vr.chunk_id,
      vr.content,
      vr.text,
      vr.metadata,
      vr.similarity AS vector_score,
      vr.keyword_score,
      (vr.similarity * vector_weight) AS combined_score,
      vr.search_type
    FROM 
      vector_results vr
    
    UNION ALL
    
    -- Keyword results
    SELECT 
      kr.id,
      kr.document_id,
      kr.chunk_id,
      kr.content,
      kr.text,
      kr.metadata,
      kr.similarity AS vector_score,
      kr.rank AS keyword_score,
      (kr.rank * keyword_weight) AS combined_score,
      kr.search_type
    FROM 
      keyword_results kr
  )
  
  -- Final results with scoring and deduplication
  SELECT DISTINCT ON (cr.id)
    cr.id,
    cr.document_id,
    cr.chunk_id,
    cr.content,
    cr.text,
    cr.metadata,
    cr.vector_score,
    cr.keyword_score,
    -- Calculate the combined score based on the weights
    (cr.vector_score * vector_weight) + (cr.keyword_score * keyword_weight) AS combined_score,
    cr.search_type
  FROM 
    combined_results cr
  ORDER BY 
    cr.id, combined_score DESC
  LIMIT 
    match_count;
END;
$$;

-- Create comments for each function
COMMENT ON FUNCTION public.keyword_search IS 'Simple keyword search on document_chunks using PostgreSQL full-text search.
Parameters:
- query_text: The search text
- match_count: Maximum number of results to return';

COMMENT ON FUNCTION public.basic_text_search IS 'Simple pattern matching search for testing document_chunks access.
Parameters:
- search_text: Text to search for using ILIKE
- limit_count: Maximum number of results to return';

COMMENT ON FUNCTION public.hybrid_search IS 'Performs hybrid search on document_chunks using both vector similarity and keyword matching.
Parameters:
- query_text: The search text
- query_embedding: Vector embedding of the search text
- match_count: Maximum number of results to return
- match_threshold: Minimum similarity threshold for vector search (0-1)
- filter: JSON object containing filtering criteria
- vector_weight: Weight for vector search scores (0-1)
- keyword_weight: Weight for keyword search scores (0-1)

The function handles null filters gracefully and combines vector and keyword search results.'; 
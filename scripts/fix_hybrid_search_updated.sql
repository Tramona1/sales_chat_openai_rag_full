-- Updated hybrid_search function to fix ambiguous 'id' column reference and type mismatch
-- Drop existing hybrid_search function if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname = 'hybrid_search'
    ) THEN
        DROP FUNCTION public.hybrid_search(text, vector, integer, float, jsonb, float, float);
    END IF;
END
$$;

-- Re-create hybrid_search function with fixed query
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
  vector_score DOUBLE PRECISION,
  keyword_score DOUBLE PRECISION,
  combined_score DOUBLE PRECISION,
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
      (1 - (dc.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
      0.0::DOUBLE PRECISION AS keyword_score,
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
      0.0::DOUBLE PRECISION AS similarity,
      ts_rank(to_tsvector('english', dc.text), plainto_tsquery('english', query_text))::DOUBLE PRECISION AS rank,
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
      vr.id AS result_id,  -- Add alias to distinguish from other 'id' columns
      vr.document_id,
      vr.chunk_id,
      vr.content,
      vr.text,
      vr.metadata,
      vr.similarity AS vector_score,
      vr.keyword_score,
      (vr.similarity * vector_weight)::DOUBLE PRECISION AS combined_score,
      vr.search_type
    FROM 
      vector_results vr
    
    UNION ALL
    
    -- Keyword results
    SELECT 
      kr.id AS result_id,  -- Add alias to distinguish from other 'id' columns
      kr.document_id,
      kr.chunk_id,
      kr.content,
      kr.text,
      kr.metadata,
      kr.similarity AS vector_score,
      kr.rank AS keyword_score,
      (kr.rank * keyword_weight)::DOUBLE PRECISION AS combined_score,
      kr.search_type
    FROM 
      keyword_results kr
  )
  
  -- Final results with scoring and deduplication - fix the ambiguous 'id' column reference
  SELECT DISTINCT ON (cr.result_id)  -- Use the aliased column name
    cr.result_id AS id,  -- Explicitly rename back to 'id' for the output schema
    cr.document_id,
    cr.chunk_id,
    cr.content,
    cr.text,
    cr.metadata,
    cr.vector_score,
    cr.keyword_score,
    -- Calculate the combined score based on the weights and cast to DOUBLE PRECISION
    ((cr.vector_score * vector_weight) + (cr.keyword_score * keyword_weight))::DOUBLE PRECISION AS combined_score,
    cr.search_type
  FROM 
    combined_results cr
  ORDER BY 
    cr.result_id, combined_score DESC
  LIMIT 
    match_count;
END;
$$;

-- Add function comment
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
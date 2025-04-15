-- Fix Vector Search Functions for Supabase
-- This script creates or replaces the vector search functions

-- First, drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS public.check_pgvector();
DROP FUNCTION IF EXISTS public.match_documents(vector, double precision, integer, jsonb);
DROP FUNCTION IF EXISTS public.hybrid_search(text, vector, integer, double precision, double precision, double precision, jsonb);

-- 1. Create a function to check if pgvector extension is installed
CREATE OR REPLACE FUNCTION public.check_pgvector()
RETURNS TEXT AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    RETURN 'pgvector extension is installed';
  ELSE
    RETURN 'pgvector extension is NOT installed';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Create a simple match_documents function for vector similarity search
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding VECTOR(768),
  match_threshold DOUBLE PRECISION DEFAULT 0.5,
  match_count INTEGER DEFAULT 10,
  filter JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_index INTEGER,
  text TEXT,
  similarity DOUBLE PRECISION,
  metadata JSONB
) AS $$
DECLARE
  category_filter TEXT;
  min_technical_level INT;
  max_technical_level INT;
  document_ids UUID[];
BEGIN
  -- Parse filter if provided
  IF filter IS NOT NULL THEN
    category_filter := filter->>'primaryCategory';
    min_technical_level := (filter->>'technicalLevelMin')::INT;
    max_technical_level := (filter->>'technicalLevelMax')::INT;
    
    IF filter->'requiredEntities' IS NOT NULL AND jsonb_array_length(filter->'requiredEntities') > 0 THEN
      document_ids := ARRAY(SELECT jsonb_array_elements_text(filter->'requiredEntities')::UUID);
    END IF;
  END IF;
  
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.text,
    CAST(1 - (dc.embedding <=> query_embedding) AS DOUBLE PRECISION) AS similarity,
    dc.metadata
  FROM document_chunks dc
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
  AND (category_filter IS NULL OR dc.metadata->>'category' = category_filter)
  AND (min_technical_level IS NULL OR (dc.metadata->>'technicalLevel')::INT >= min_technical_level)
  AND (max_technical_level IS NULL OR (dc.metadata->>'technicalLevel')::INT <= max_technical_level)
  AND (document_ids IS NULL OR dc.document_id = ANY(document_ids))
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- 3. Fix or recreate the hybrid search function with improved text query handling
CREATE OR REPLACE FUNCTION public.hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(768),
  match_count INT DEFAULT 10,
  match_threshold DOUBLE PRECISION DEFAULT 0.5,
  vector_weight DOUBLE PRECISION DEFAULT 0.7,
  keyword_weight DOUBLE PRECISION DEFAULT 0.3,
  filter JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_index INTEGER,
  text TEXT,
  similarity DOUBLE PRECISION,
  combined_score DOUBLE PRECISION,
  vector_score DOUBLE PRECISION,
  keyword_score DOUBLE PRECISION,
  metadata JSONB
) AS $$
DECLARE
  search_query TSQUERY;
  category_filter TEXT;
  min_technical_level INT;
  max_technical_level INT;
  document_ids UUID[];
BEGIN
  -- Parse filter if provided
  IF filter IS NOT NULL THEN
    category_filter := filter->>'primaryCategory';
    min_technical_level := (filter->>'technicalLevelMin')::INT;
    max_technical_level := (filter->>'technicalLevelMax')::INT;
    
    IF filter->'requiredEntities' IS NOT NULL AND jsonb_array_length(filter->'requiredEntities') > 0 THEN
      document_ids := ARRAY(SELECT jsonb_array_elements_text(filter->'requiredEntities')::UUID);
    END IF;
  END IF;
  
  -- Create tsquery for text search using plainto_tsquery for safer parsing
  -- This handles special characters like ? and ! properly
  search_query := plainto_tsquery('english', query_text);
  
  -- If plainto_tsquery returns an empty query (e.g., for very short queries),
  -- try websearch_to_tsquery as an alternative
  IF search_query::text = '' THEN
    search_query := websearch_to_tsquery('english', query_text);
  END IF;
  
  -- If both methods fail, create a fallback using individual words
  IF search_query::text = '' THEN
    -- Extract words, ignoring punctuation
    WITH words AS (
      SELECT word
      FROM regexp_split_to_table(lower(query_text), '[^a-zA-Z0-9]') word
      WHERE length(word) > 2  -- Skip very short words
    )
    SELECT string_agg(word, ' & ') INTO query_text FROM words;
    
    -- Create a basic tsquery if we got any words
    IF length(coalesce(query_text, '')) > 0 THEN
      search_query := to_tsquery('english', query_text);
    END IF;
  END IF;
  
  -- Combined query with both vector and keyword search
  RETURN QUERY
  WITH vector_search AS (
    -- Vector similarity search
    SELECT 
      dc.id,
      dc.document_id,
      dc.chunk_index,
      dc.text,
      CAST(1 - (dc.embedding <=> query_embedding) AS DOUBLE PRECISION) AS similarity
    FROM document_chunks dc
    WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (category_filter IS NULL OR dc.metadata->>'category' = category_filter)
    AND (min_technical_level IS NULL OR (dc.metadata->>'technicalLevel')::INT >= min_technical_level)
    AND (max_technical_level IS NULL OR (dc.metadata->>'technicalLevel')::INT <= max_technical_level)
    AND (document_ids IS NULL OR dc.document_id = ANY(document_ids))
    ORDER BY similarity DESC
    LIMIT match_count * 2
  ),
  keyword_search AS (
    -- Full-text keyword search
    SELECT 
      dc.id,
      dc.document_id,
      dc.chunk_index,
      dc.text,
      CAST(ts_rank(to_tsvector('english', dc.text), search_query) AS DOUBLE PRECISION) AS keyword_rank
    FROM document_chunks dc
    WHERE (search_query::text != '')  -- Only perform keyword search if we have a valid query
    AND (to_tsvector('english', dc.text) @@ search_query)
    AND (category_filter IS NULL OR dc.metadata->>'category' = category_filter)
    AND (min_technical_level IS NULL OR (dc.metadata->>'technicalLevel')::INT >= min_technical_level)
    AND (max_technical_level IS NULL OR (dc.metadata->>'technicalLevel')::INT <= max_technical_level)
    AND (document_ids IS NULL OR dc.document_id = ANY(document_ids))
    ORDER BY keyword_rank DESC
    LIMIT match_count * 2
  ),
  combined_results AS (
    -- Combine both search results with weighted scores
    SELECT 
      COALESCE(v.id, k.id) AS id,
      COALESCE(v.document_id, k.document_id) AS document_id,
      COALESCE(v.chunk_index, k.chunk_index) AS chunk_index,
      COALESCE(v.text, k.text) AS text,
      COALESCE(v.similarity, 0.0) AS vector_score,
      COALESCE(k.keyword_rank, 0.0) AS keyword_score,
      CAST((COALESCE(v.similarity, 0.0) * vector_weight + 
           COALESCE(k.keyword_rank, 0.0) * keyword_weight) AS DOUBLE PRECISION) AS combined_score
    FROM vector_search v
    FULL OUTER JOIN keyword_search k ON v.id = k.id
    WHERE (v.id IS NOT NULL OR k.id IS NOT NULL)
    ORDER BY combined_score DESC
    LIMIT match_count
  )
  SELECT 
    cr.id,
    cr.document_id,
    cr.chunk_index,
    cr.text,
    cr.vector_score AS similarity, -- Keep existing column for compatibility
    cr.combined_score,
    cr.vector_score,
    cr.keyword_score,
    dc.metadata
  FROM combined_results cr
  JOIN document_chunks dc ON cr.id = dc.id
  ORDER BY cr.combined_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- 4. Create a function to list tables in the database
CREATE OR REPLACE FUNCTION public.get_tables()
RETURNS TABLE(table_name text)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tables.table_name::text
  FROM
    information_schema.tables tables
  WHERE
    table_schema = 'public'
  ORDER BY
    tables.table_name;
END;
$$;

-- 5. Create a function to get information about another function
CREATE OR REPLACE FUNCTION public.get_function_info(function_name text)
RETURNS TABLE(
  routine_name text,
  parameters text,
  return_type text,
  created_at timestamp
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    routines.routine_name::text,
    COALESCE(
      (
        SELECT string_agg(pp.parameter_name || ' ' || pp.data_type, ', ')
        FROM information_schema.parameters pp
        WHERE pp.specific_name = routines.specific_name
        AND pp.parameter_mode = 'IN'
      ),
      'No parameters'
    ) AS parameters,
    routines.data_type::text,
    routines.created::timestamp
  FROM
    information_schema.routines routines
  WHERE
    routine_schema = 'public'
    AND routine_name = function_name
  ORDER BY
    routines.routine_name;
END;
$$; 
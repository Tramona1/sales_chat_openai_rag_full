-- update_text_search.sql
-- SQL script to add text_search_vector column and create index for full-text search
-- This migration replaces the custom BM25 implementation with PostgreSQL's built-in FTS

-- Step 1: Check if the column exists
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'document_chunks'
    AND column_name = 'text_search_vector'
  ) INTO column_exists;

  IF NOT column_exists THEN
    -- Step 2: Add the text_search_vector column if it doesn't exist
    RAISE NOTICE 'Adding text_search_vector column...';
    
    -- Add the column with generated tsvector from text
    ALTER TABLE document_chunks 
    ADD COLUMN text_search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(text, ''))) STORED;
    
    RAISE NOTICE 'Added text_search_vector column successfully.';
  ELSE
    RAISE NOTICE 'text_search_vector column already exists.';
  END IF;
END $$;

-- Step 3: Check if the index exists
DO $$
DECLARE
  index_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'document_chunks'
    AND indexname = 'idx_document_chunks_text_search_vector'
  ) INTO index_exists;

  IF NOT index_exists THEN
    -- Step 4: Create the index if it doesn't exist
    RAISE NOTICE 'Creating GIN index on text_search_vector...';
    
    CREATE INDEX idx_document_chunks_text_search_vector 
    ON document_chunks 
    USING gin(text_search_vector);
    
    RAISE NOTICE 'Created GIN index successfully.';
  ELSE
    RAISE NOTICE 'GIN index already exists.';
  END IF;
END $$;

-- Helper function to safely process search queries
CREATE OR REPLACE FUNCTION process_search_query(query_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  processed_query TEXT;
BEGIN
  -- Remove special characters that might break tsquery
  processed_query := regexp_replace(query_text, '[^\w\s]', ' ', 'g');
  
  -- Convert to lowercase
  processed_query := lower(processed_query);
  
  -- Split words and add :* for prefix matching
  processed_query := string_agg(word || ':*', ' & ')
  FROM (
    SELECT regexp_split_to_table(processed_query, '\s+') AS word
    WHERE length(regexp_split_to_table(processed_query, '\s+')) > 1
  ) AS words;
  
  -- If the query is empty after processing, return a safe fallback
  IF processed_query IS NULL OR processed_query = '' THEN
    RETURN 'dummy:*';
  END IF;
  
  RETURN processed_query;
END;
$$;

-- Step 5: Create a search function for keyword search
-- This function can be called directly for keyword search
CREATE OR REPLACE FUNCTION keyword_search(
  query_text TEXT,
  match_count INTEGER DEFAULT 10
) RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_index INTEGER,
  content TEXT,
  metadata JSONB,
  rank DOUBLE PRECISION
) LANGUAGE plpgsql
AS $$
DECLARE
  processed_query TEXT;
BEGIN
  -- Process query safely
  processed_query := process_search_query(query_text);
  
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.text as content,
    dc.metadata,
    ts_rank(dc.text_search_vector, to_tsquery('english', processed_query)) as rank
  FROM 
    document_chunks dc
  WHERE 
    dc.text_search_vector @@ to_tsquery('english', processed_query)
  ORDER BY 
    rank DESC
  LIMIT 
    match_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in keyword_search: %', SQLERRM;
    -- Return empty result set
    RETURN QUERY
    SELECT 
      NULL::UUID as id,
      NULL::UUID as document_id,
      NULL::INTEGER as chunk_index,
      NULL::TEXT as content,
      NULL::JSONB as metadata,
      NULL::DOUBLE PRECISION as rank
    WHERE FALSE;
END;
$$;

-- Step 6: Create a hybrid search function that combines vector and keyword search
-- This will replace the custom BM25 implementation
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(768),
  match_count INTEGER DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.7,
  vector_weight FLOAT DEFAULT 0.7,
  keyword_weight FLOAT DEFAULT 0.3,
  filter JSONB DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_id UUID,
  content TEXT,
  text TEXT,
  metadata JSONB,
  vector_score FLOAT,
  keyword_score FLOAT,
  combined_score FLOAT,
  search_type TEXT
) LANGUAGE plpgsql
AS $$
DECLARE
  processed_query TEXT;
BEGIN
  -- Validate weights
  IF (vector_weight + keyword_weight) <> 1.0 THEN
    RAISE WARNING 'Vector weight (%) and keyword weight (%) must sum to 1.0, adjusting automatically', 
      vector_weight, keyword_weight;
    -- Auto-adjust to ensure they sum to 1.0
    vector_weight := vector_weight / (vector_weight + keyword_weight);
    keyword_weight := 1.0 - vector_weight;
  END IF;

  -- Process query safely
  processed_query := process_search_query(query_text);

  -- Apply metadata filters if provided
  -- Process filters from the filter JSON parameter
  DECLARE
    filter_clauses TEXT := '';
    filter_values TEXT[];
    i INTEGER := 0;
  BEGIN
    IF filter IS NOT NULL AND jsonb_typeof(filter) = 'object' THEN
      -- Extract filter conditions
      IF filter ? 'categories' AND jsonb_typeof(filter->'categories') = 'array' THEN
        filter_clauses := filter_clauses || ' AND metadata->>''category'' IN (SELECT jsonb_array_elements_text($' || (i+1) || '::jsonb))';
        filter_values := filter_values || (filter->'categories')::TEXT;
        i := i + 1;
      END IF;
      
      -- Add more filter types as needed
    END IF;
  END;

  RETURN QUERY
  WITH vector_results AS (
    -- Vector similarity search
    SELECT 
      id,
      document_id,
      id as chunk_id,
      chunk_index,
      text as content,
      text,
      metadata,
      1 - (embedding <=> query_embedding) as similarity,
      'vector' as search_type
    FROM 
      document_chunks
    WHERE 
      1 - (embedding <=> query_embedding) > match_threshold
      -- Apply filters if specified
      AND (filter IS NULL OR 
           (
             (NOT filter ? 'only_authoritative' OR filter->>'only_authoritative' = 'false' OR 
             metadata->>'isAuthoritative' = 'true')
           )
          )
    ORDER BY 
      similarity DESC
    LIMIT 
      match_count * 2
  ),
  keyword_results AS (
    -- Keyword search using PostgreSQL FTS
    SELECT 
      id,
      document_id,
      id as chunk_id,
      chunk_index,
      text as content,
      text,
      metadata,
      ts_rank(text_search_vector, to_tsquery('english', processed_query)) as rank,
      'keyword' as search_type
    FROM 
      document_chunks
    WHERE 
      text_search_vector @@ to_tsquery('english', processed_query)
      -- Apply same filters as vector search
      AND (filter IS NULL OR 
           (
             (NOT filter ? 'only_authoritative' OR filter->>'only_authoritative' = 'false' OR 
             metadata->>'isAuthoritative' = 'true')
           )
          )
    ORDER BY 
      rank DESC
    LIMIT 
      match_count * 2
  ),
  -- Combine the results with normalization
  combined_results AS (
    SELECT 
      COALESCE(v.id, k.id) as id,
      COALESCE(v.document_id, k.document_id) as document_id,
      COALESCE(v.chunk_id, k.chunk_id) as chunk_id,
      COALESCE(v.chunk_index, k.chunk_index) as chunk_index,
      COALESCE(v.content, k.content) as content,
      COALESCE(v.text, k.text) as text,
      COALESCE(v.metadata, k.metadata) as metadata,
      COALESCE(v.similarity, 0) as vector_score,
      COALESCE(k.rank, 0) as keyword_score,
      CASE 
        WHEN v.id IS NOT NULL AND k.id IS NOT NULL THEN 
          (vector_weight * COALESCE(v.similarity, 0)) + (keyword_weight * COALESCE(k.rank, 0))
        WHEN v.id IS NOT NULL THEN 
          vector_weight * v.similarity
        ELSE 
          keyword_weight * k.rank
      END as combined_score,
      CASE 
        WHEN v.id IS NOT NULL AND k.id IS NOT NULL THEN 'hybrid'
        WHEN v.id IS NOT NULL THEN 'vector'
        ELSE 'keyword'
      END as search_type
    FROM 
      vector_results v
    FULL OUTER JOIN 
      keyword_results k
    ON 
      v.id = k.id
  )
  SELECT * FROM combined_results
  ORDER BY combined_score DESC
  LIMIT match_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in hybrid_search: %', SQLERRM;
    -- Return empty result set
    RETURN QUERY
    SELECT 
      NULL::UUID as id,
      NULL::UUID as document_id,
      NULL::UUID as chunk_id,
      NULL::TEXT as content,
      NULL::TEXT as text,
      NULL::JSONB as metadata,
      NULL::FLOAT as vector_score,
      NULL::FLOAT as keyword_score,
      NULL::FLOAT as combined_score,
      'error'::TEXT as search_type
    WHERE FALSE;
END;
$$;

-- Function to clean up legacy BM25 tables if they exist
DO $$
BEGIN
  -- Drop old corpus statistics tables if they exist
  DROP TABLE IF EXISTS corpus_statistics CASCADE;
  DROP TABLE IF EXISTS term_frequencies CASCADE;
  DROP TABLE IF EXISTS document_frequencies CASCADE;
  
  -- Drop old BM25 functions if they exist
  DROP FUNCTION IF EXISTS calculate_token_frequencies(TEXT);
  DROP FUNCTION IF EXISTS rebuild_corpus_statistics();
  DROP FUNCTION IF EXISTS calculate_bm25_score(TEXT, UUID, FLOAT, FLOAT);
  DROP FUNCTION IF EXISTS search_documents_bm25(TEXT, INT, FLOAT, FLOAT);
  
  RAISE NOTICE 'Removed legacy BM25 tables and functions.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Some legacy BM25 tables or functions could not be removed: %', SQLERRM;
END $$;

-- Notify on completion
DO $$
BEGIN
  RAISE NOTICE 'Text search setup completed successfully.';
  RAISE NOTICE 'You can now use keyword_search() and hybrid_search() functions.';
  RAISE NOTICE 'The hybrid_search function uses PostgreSQL FTS instead of custom BM25.';
END $$; 
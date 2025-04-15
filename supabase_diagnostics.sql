-- Supabase Diagnostics SQL
-- This file contains SQL commands to diagnose and fix issues with your Supabase setup

-- 1. Check if pgvector extension is installed and active
SELECT installed_version FROM pg_available_extensions WHERE name = 'vector';

-- 2. Check if the required tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 3. Check the document_chunks table structure
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'document_chunks' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Count records in key tables
SELECT 'documents' as table_name, COUNT(*) as record_count FROM documents
UNION ALL
SELECT 'document_chunks' as table_name, COUNT(*) as record_count FROM document_chunks;

-- 5. Check for vector column in document_chunks
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'document_chunks'
AND column_name = 'embedding'
AND table_schema = 'public';

-- 6. Verify hybrid_search function exists
SELECT routine_name, data_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION'
AND routine_name IN ('hybrid_search', 'match_documents', 'check_pgvector');

-- 7. Check the function signature for hybrid_search
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'hybrid_search' 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 8. Check the function signature for match_documents
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'match_documents' 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 9. Test a simple vector search (adjust vector dimension if needed)
-- This can be commented out and run separately if needed
SELECT * FROM match_documents(
  ARRAY[0.1, 0.1, 0.1, 0.1]::vector(768), -- Make sure dimension matches your embeddings
  0.1,
  5
) LIMIT 1;

-- 10. Fix for hybrid_search if needed (based on fix_vector_search.sql)
-- NOTE: Only run this if the diagnostics show that hybrid_search is not working
/*
CREATE OR REPLACE FUNCTION public.hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(768),
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.5,
  vector_weight FLOAT DEFAULT 0.7,
  keyword_weight FLOAT DEFAULT 0.3,
  filter JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_index INTEGER,
  text TEXT,
  similarity FLOAT,
  combined_score FLOAT,
  vector_score FLOAT,
  keyword_score FLOAT,
  metadata JSONB
) AS $$
DECLARE
  query_tokens TEXT[];
  token_count INT;
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
  
  -- Process query for keyword search
  query_tokens := regexp_split_to_array(lower(query_text), '\\s+');
  token_count := array_length(query_tokens, 1);
  
  -- Create tsquery for text search
  IF token_count > 0 THEN
    search_query := to_tsquery('english', array_to_string(query_tokens, ':&'));
  ELSE
    search_query := to_tsquery('english', '');
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
      1 - (dc.embedding <=> query_embedding) AS similarity
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
      ts_rank(to_tsvector('english', dc.text), search_query) AS keyword_rank
    FROM document_chunks dc
    WHERE (search_query != to_tsquery('english', ''))
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
      COALESCE(v.similarity, 0) AS vector_score,
      COALESCE(k.keyword_rank, 0) AS keyword_score,
      (COALESCE(v.similarity, 0) * vector_weight + 
       COALESCE(k.keyword_rank, 0) * keyword_weight) AS combined_score
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
*/ 

-- Supabase pgvector diagnostics script
-- This script checks for common configuration issues with pgvector setup

-- Check if the pgvector extension is installed
SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
) AS pgvector_installed;

-- Check if the required tables exist in the public schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('documents', 'document_chunks')
ORDER BY table_name;

-- Check the structure of the document_chunks table
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'document_chunks'
ORDER BY ordinal_position;

-- Count the records in the documents and document_chunks tables
SELECT 'documents' AS table_name, COUNT(*) AS record_count FROM public.documents
UNION ALL
SELECT 'document_chunks' AS table_name, COUNT(*) AS record_count FROM public.document_chunks
ORDER BY table_name;

-- Check if the embedding column exists and has vector data
SELECT 
    COUNT(*) AS chunks_with_embeddings,
    MIN(embedding) IS NOT NULL AS has_embeddings
FROM public.document_chunks;

-- Check if the necessary functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('hybrid_search', 'match_documents', 'check_pgvector')
ORDER BY routine_name;

-- If hybrid_search exists, check its signature
SELECT 
    p.proname AS function_name,
    pg_get_function_result(p.oid) AS result_data_type,
    pg_get_function_arguments(p.oid) AS argument_data_types
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'hybrid_search';

-- If match_documents exists, check its signature
SELECT 
    p.proname AS function_name,
    pg_get_function_result(p.oid) AS result_data_type,
    pg_get_function_arguments(p.oid) AS argument_data_types
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'match_documents';

-- Test a simple vector search using match_documents with a sample vector
-- This may fail if the function doesn't exist or has incorrect parameters
DO $$
BEGIN
    BEGIN
        -- Attempt to run match_documents with a sample vector
        PERFORM * FROM public.match_documents(
            ARRAY[0.1, 0.2, 0.3, 0.4]::vector(768), 
            0.5, 
            5
        );
        RAISE NOTICE 'match_documents test: SUCCESS';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'match_documents test: FAILED - %', SQLERRM;
    END;
END;
$$;

-- Instructions for fixing vector search functions
COMMENT ON SCHEMA public IS $$
IMPORTANT: If the tests above show issues with pgvector functions, run the fix_vector_search.sql script.

To fix the vector search functions:
1. Run the file 'fix_vector_search.sql' in the SQL editor or via the command line
2. The script will:
   - Drop and recreate the hybrid_search and match_documents functions
   - Fix the data type issues (using DOUBLE PRECISION for similarity scores)
   - Update the function signatures to be compatible with your application
   - Add enhanced filtering capabilities

After running the fix script, run this diagnostic script again to verify the fixes.
$$;

-- If there are issues with hybrid_search, here's how to test it after fixing
DO $$
BEGIN
    BEGIN
        -- Attempt to run hybrid_search with sample data
        PERFORM * FROM public.hybrid_search(
            'sample query',
            ARRAY[0.1, 0.2, 0.3, 0.4]::vector(768),
            5,
            0.5,
            0.7,
            0.3,
            NULL
        );
        RAISE NOTICE 'hybrid_search test: SUCCESS';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'hybrid_search test: FAILED - %', SQLERRM;
    END;
END;
$$; 
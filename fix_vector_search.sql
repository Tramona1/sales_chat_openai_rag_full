-- Fix Vector Search Functions for Supabase
-- This script creates or replaces the vector search functions

-- 1. Create a function to check if pgvector extension is installed
CREATE OR REPLACE FUNCTION public.check_pgvector()
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM pg_extension 
    WHERE extname = 'vector'
  );
END;
$$;

-- 2. Create a simple match_documents function for vector similarity search
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index int,
  text text,
  metadata jsonb,
  embedding vector(768),
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.text,
    dc.metadata,
    dc.embedding,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM
    document_chunks dc
  WHERE
    1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY
    dc.embedding <=> query_embedding
  LIMIT
    match_count;
END;
$$;

-- 3. Fix or recreate the hybrid search function
CREATE OR REPLACE FUNCTION public.hybrid_search(
  query_text text,
  query_embedding vector(768),
  match_count integer DEFAULT 10,
  match_threshold double precision DEFAULT 0.2,
  vector_weight double precision DEFAULT 0.5,
  keyword_weight double precision DEFAULT 0.5,
  filter jsonb DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  chunk_index integer,
  text text,
  metadata jsonb,
  embedding vector(768),
  score double precision,
  vector_score double precision,
  keyword_score double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_matches AS (
    SELECT
      dc.id,
      dc.document_id,
      dc.chunk_index,
      dc.text,
      dc.metadata,
      dc.embedding,
      1 - (dc.embedding <=> query_embedding) AS similarity_score
    FROM
      document_chunks dc
    WHERE
      -- Filter by URL path segments if provided
      (
        filter IS NULL
        OR filter->'url_path_segments' IS NULL
        OR filter->'url_path_segments' = '[]'
        OR dc.metadata->'urlPathSegments' ?| (SELECT array_agg(jsonb_array_elements_text(filter->'url_path_segments')))
      )
      -- Filter by primary category if provided
      AND (
        filter IS NULL
        OR filter->'primaryCategory' IS NULL
        OR dc.metadata->>'primaryCategory' = filter->>'primaryCategory'
      )
      -- Filter by secondary categories if provided
      AND (
        filter IS NULL
        OR filter->'secondaryCategories' IS NULL
        OR filter->'secondaryCategories' = '[]'
        OR dc.metadata->'secondaryCategories' ?| (SELECT array_agg(jsonb_array_elements_text(filter->'secondaryCategories')))
      )
      -- Filter by technical level min if provided
      AND (
        filter IS NULL
        OR filter->'technicalLevelMin' IS NULL
        OR (dc.metadata->>'technicalLevel')::float >= (filter->>'technicalLevelMin')::float
      )
      -- Filter by technical level max if provided
      AND (
        filter IS NULL
        OR filter->'technicalLevelMax' IS NULL
        OR (dc.metadata->>'technicalLevel')::float <= (filter->>'technicalLevelMax')::float
      )
      -- Filter by required entities if provided
      AND (
        filter IS NULL
        OR filter->'requiredEntities' IS NULL
        OR filter->'requiredEntities' = '[]'
        OR dc.metadata->'entities' ?| (SELECT array_agg(jsonb_array_elements_text(filter->'requiredEntities')))
      )
      -- Apply vector similarity threshold
      AND 1 - (dc.embedding <=> query_embedding) >= match_threshold
  ),
  keyword_matches AS (
    SELECT
      dc.id,
      dc.document_id,
      dc.chunk_index,
      dc.text,
      dc.metadata,
      dc.embedding,
      ts_rank(to_tsvector('english', dc.text), to_tsquery('english', 
        regexp_replace(regexp_replace(query_text, '[^a-zA-Z0-9]', ' ', 'g'), '\s+', ':* & ', 'g') || ':*'
      )) AS keyword_score
    FROM
      document_chunks dc
    WHERE
      -- Filter by URL path segments if provided
      (
        filter IS NULL
        OR filter->'url_path_segments' IS NULL
        OR filter->'url_path_segments' = '[]'
        OR dc.metadata->'urlPathSegments' ?| (SELECT array_agg(jsonb_array_elements_text(filter->'url_path_segments')))
      )
      -- Filter by primary category if provided
      AND (
        filter IS NULL
        OR filter->'primaryCategory' IS NULL
        OR dc.metadata->>'primaryCategory' = filter->>'primaryCategory'
      )
      -- Filter by secondary categories if provided
      AND (
        filter IS NULL
        OR filter->'secondaryCategories' IS NULL
        OR filter->'secondaryCategories' = '[]'
        OR dc.metadata->'secondaryCategories' ?| (SELECT array_agg(jsonb_array_elements_text(filter->'secondaryCategories')))
      )
      -- Filter by technical level min if provided
      AND (
        filter IS NULL
        OR filter->'technicalLevelMin' IS NULL
        OR (dc.metadata->>'technicalLevel')::float >= (filter->>'technicalLevelMin')::float
      )
      -- Filter by technical level max if provided
      AND (
        filter IS NULL
        OR filter->'technicalLevelMax' IS NULL
        OR (dc.metadata->>'technicalLevel')::float <= (filter->>'technicalLevelMax')::float
      )
      -- Filter by required entities if provided
      AND (
        filter IS NULL
        OR filter->'requiredEntities' IS NULL
        OR filter->'requiredEntities' = '[]'
        OR dc.metadata->'entities' ?| (SELECT array_agg(jsonb_array_elements_text(filter->'requiredEntities')))
      )
      -- Apply text search
      AND to_tsvector('english', dc.text) @@ to_tsquery('english', 
        regexp_replace(regexp_replace(query_text, '[^a-zA-Z0-9]', ' ', 'g'), '\s+', ':* & ', 'g') || ':*'
      )
  ),
  hybrid_result AS (
    SELECT
      COALESCE(vm.id, km.id) AS id,
      COALESCE(vm.document_id, km.document_id) AS document_id,
      COALESCE(vm.chunk_index, km.chunk_index) AS chunk_index,
      COALESCE(vm.text, km.text) AS text,
      COALESCE(vm.metadata, km.metadata) AS metadata,
      COALESCE(vm.embedding, km.embedding) AS embedding,
      COALESCE(vm.similarity_score, 0) * vector_weight + COALESCE(km.keyword_score, 0) * keyword_weight AS combined_score,
      COALESCE(vm.similarity_score, 0) AS vector_score,
      COALESCE(km.keyword_score, 0) AS keyword_score
    FROM
      vector_matches vm
    FULL OUTER JOIN
      keyword_matches km ON vm.id = km.id
    WHERE
      COALESCE(vm.similarity_score, 0) * vector_weight + COALESCE(km.keyword_score, 0) * keyword_weight > 0
  )
  SELECT
    id,
    document_id,
    chunk_index,
    text,
    metadata,
    embedding,
    combined_score AS score,
    vector_score,
    keyword_score
  FROM
    hybrid_result
  ORDER BY
    combined_score DESC
  LIMIT
    match_count;
END;
$$;

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
-- SQL file for fixing the text_search_vector column

-- Drop one of the redundant indexes
DROP INDEX IF EXISTS idx_document_chunks_text_search_vector;

-- Drop and recreate the text_search_vector column as a generated column
ALTER TABLE public.document_chunks
DROP COLUMN IF EXISTS text_search_vector;

ALTER TABLE public.document_chunks
ADD COLUMN text_search_vector tsvector
GENERATED ALWAYS AS (to_tsvector('english'::regconfig, text)) STORED;

-- Keep the remaining index (no need to recreate)
-- The idx_document_chunks_fts index will remain

-- Update the hybrid_search function to support URL path segment filtering
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
LANGUAGE plpgsql AS $$
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
      -- Continue with existing filters...
      AND (
        filter IS NULL
        OR filter->'primary_category' IS NULL
        OR dc.metadata->>'primaryCategory' = filter->>'primary_category'
      )
      AND (
        filter IS NULL
        OR filter->'secondary_categories' IS NULL
        OR filter->'secondary_categories' = '[]'
        OR dc.metadata->'secondaryCategories' ?| (SELECT array_agg(jsonb_array_elements_text(filter->'secondary_categories')))
      )
      -- Rest of function remains the same...
    WHERE
      1 - (dc.embedding <=> query_embedding) >= match_threshold
  ),
  -- Rest of function remains the same...
  
  -- Return the combined results
  -- ...
$$;

-- Add an index on the urlPathSegments array in the metadata
CREATE INDEX IF NOT EXISTS idx_document_chunks_url_path_segments ON document_chunks USING GIN ((metadata->'urlPathSegments'));

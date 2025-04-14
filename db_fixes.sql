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

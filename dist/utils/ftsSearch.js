/**
 * PostgreSQL Full-Text Search (FTS) Implementation
 *
 * This module provides keyword search functionality using PostgreSQL's built-in
 * Full-Text Search capabilities, replacing the custom BM25 implementation.
 */
import { getSupabaseAdmin } from './supabaseClient';
import { logError, logInfo } from './logger';
/**
 * Perform a keyword search using PostgreSQL Full-Text Search
 *
 * @param query Search query
 * @param options Search options
 * @returns Search results with scores
 */
export async function performFtsSearch(query, options = {}) {
    const { limit = 10, threshold = 0.1, configuration = 'english', contentColumn = 'content', table = 'document_chunks', filter = {} } = options;
    try {
        const supabase = getSupabaseAdmin();
        // Clean the query
        const cleanedQuery = query
            .trim()
            .replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, ' ')
            .replace(/\s+/g, ' ')
            .toLowerCase();
        // Create the SQL query
        let rpcParams = {
            search_query: cleanedQuery,
            match_limit: limit,
            similarity_threshold: threshold,
            config_name: configuration
        };
        // Add metadata filters if provided
        if (Object.keys(filter).length > 0) {
            rpcParams.filter_json = filter;
        }
        // Call the RPC function
        const { data, error } = await supabase.rpc('search_documents', rpcParams);
        if (error) {
            logError('FTS search error:', error);
            throw error;
        }
        // Transform results to expected format
        const results = (data || []).map((item) => ({
            id: item.id,
            document_id: item.document_id,
            chunk_index: item.chunk_index || 0,
            text: item.content,
            originalText: item.original_text,
            embedding: [], // Embeddings are not returned by default
            metadata: item.metadata || {},
            score: item.similarity || 0
        }));
        logInfo(`FTS search returned ${results.length} results for query: "${query}"`);
        return results;
    }
    catch (error) {
        logError('Error in FTS search:', error);
        return [];
    }
}
/**
 * Helper function to create the PostgreSQL text search query
 *
 * @param query User search query
 * @returns PostgreSQL text search query
 */
function createTsQuery(query) {
    // Split query into words
    const words = query
        .trim()
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(Boolean);
    // Create a tsquery with word:* prefix matching for each word
    return words.map(word => `${word}:*`).join(' & ');
}
/**
 * Create PostgreSQL tsvector configuration
 *
 * This SQL function can be used to create or update the
 * necessary database objects for FTS functionality
 */
export function getSetupSql() {
    return `
-- 1. Add the pg_trgm extension if not already available
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create a function to perform document search using ts_vector
CREATE OR REPLACE FUNCTION search_documents(
  search_query TEXT,
  match_limit INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.1,
  config_name TEXT DEFAULT 'english',
  filter_json JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  document_id TEXT,
  chunk_index INT,
  content TEXT,
  original_text TEXT,
  metadata JSONB,
  similarity FLOAT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  ts_query TSQUERY;
BEGIN
  -- Convert search query to tsquery format
  ts_query := to_tsquery(config_name, string_agg(lexeme || ':*', ' & ')) 
    FROM unnest(string_to_array(regexp_replace(search_query, '[!@#$%^&*()_+\\-=\\[\\]{};'':"|,.<>\\/?]', ' ', 'g'), ' ')) lexeme
    WHERE length(lexeme) > 0;
  
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    dc.original_text,
    dc.metadata,
    ts_rank(to_tsvector(config_name, dc.content), ts_query) AS similarity
  FROM
    document_chunks dc
  WHERE
    -- Filter by metadata if provided
    (filter_json = '{}'::jsonb OR dc.metadata @> filter_json)
    -- Full-text match
    AND to_tsvector(config_name, dc.content) @@ ts_query
  ORDER BY
    similarity DESC
  LIMIT match_limit;
END;
$$;

-- 3. Create a GIN index on the document_chunks table for fast FTS queries
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_fts ON document_chunks USING GIN (to_tsvector('english', content));

-- 4. Create a function to perform hybrid search with both vector and FTS
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT, 
  query_embedding VECTOR(768),
  match_limit INT DEFAULT 10,
  vector_weight FLOAT DEFAULT 0.7,
  keyword_weight FLOAT DEFAULT 0.3,
  match_threshold FLOAT DEFAULT 0.5,
  filter_json JSONB DEFAULT '{}'::jsonb
) 
RETURNS TABLE (
  id UUID,
  document_id TEXT,
  chunk_index INT,
  content TEXT,
  original_text TEXT, 
  metadata JSONB,
  vector_score FLOAT,
  text_score FLOAT,
  combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  ts_query TSQUERY;
BEGIN
  -- Convert search query to tsquery format
  ts_query := to_tsquery('english', string_agg(lexeme || ':*', ' & ')) 
    FROM unnest(string_to_array(regexp_replace(query_text, '[!@#$%^&*()_+\\-=\\[\\]{};'':"|,.<>\\/?]', ' ', 'g'), ' ')) lexeme
    WHERE length(lexeme) > 0;
  
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    dc.original_text,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS vector_score,
    ts_rank(to_tsvector('english', dc.content), ts_query) AS text_score,
    (vector_weight * (1 - (dc.embedding <=> query_embedding))) + 
    (keyword_weight * ts_rank(to_tsvector('english', dc.content), ts_query)) AS combined_score
  FROM
    document_chunks dc
  WHERE
    -- Vector similarity threshold
    (1 - (dc.embedding <=> query_embedding)) >= match_threshold
    -- Filter by metadata if provided
    AND (filter_json = '{}'::jsonb OR dc.metadata @> filter_json)
    -- Optional full-text match if keywords have weight
    AND (keyword_weight = 0 OR to_tsvector('english', dc.content) @@ ts_query)
  ORDER BY
    combined_score DESC
  LIMIT match_limit;
END;
$$;
  `;
}
/**
 * Legacy function for compatibility with the old BM25 interface
 * @deprecated Use performFtsSearch directly
 */
export async function performBM25Search(query, limit = 10) {
    return performFtsSearch(query, { limit });
}

# Supabase Migration Documentation

## Overview
This document summarizes the changes made to migrate the Sales Knowledge Assistant from a file-based vector store to a Supabase PostgreSQL database with pgvector. It also outlines remaining tasks to complete the migration.

## Completed Changes

### 1. Database Schema Updates
- **Added `tsvector` Column:** Added a `text_search_vector` column of type `tsvector` to the `document_chunks` table.
- **Added GIN Index:** Created a GIN index on the `text_search_vector` column for fast full-text searches.
- **Populated Text Vectors:** Executed a SQL script to populate the `text_search_vector` column from the `original_text` data.
- **Removed Manual BM25:** Dropped the inefficient `corpus_statistics` table and manual implementation functions (`rebuild_corpus_statistics`, `calculate_token_frequencies`).

### 2. PostgreSQL Search Functions
- **Vector Search:** Created `search_vectors` function that performs similarity search using pgvector on the `document_chunks` table.
- **Keyword Search:** Created `keyword_search` function that leverages PostgreSQL's built-in full-text search via the `text_search_vector` column.
- **Hybrid Search:** Created `hybrid_search` function that combines both vector and keyword search results with configurable weighting.

### 3. Data Migration (Already Completed)
- Successfully migrated data using the `rebuildVectorStoreGemini_modified.js` script.
- Verified that 19,137 chunks were successfully inserted into the `document_chunks` table.
- Cleaned up duplicate document records (reducing from ~2,794 to ~1,397 documents).

### 4. Application Code Refactoring
- **utils/vectorStore.ts:**
  - Removed all file system dependencies (fs, path, file I/O functions).
  - Added Supabase client integration.
  - Refactored core functions to use Supabase:
    - `addToVectorStore`: Now inserts directly into the `document_chunks` table.
    - `getSimilarItems`: Now calls the `search_vectors` RPC function.
    - `getVectorStoreSize`: Now gets the count from the `document_chunks` table.
    - `getAllVectorStoreItems`: Now queries the `document_chunks` table.
    - `clearVectorStore`: Modified to show a warning (for safety).
  - Fixed linter errors related to multiline strings.

- **utils/supabaseClient.ts:**
  - Created a centralized Supabase client for use across the application.
  - Added functions for creating different types of clients (public, service, authenticated).
  - Added error handling for missing environment variables.
  - Exported the default service client instance for immediate use.

- **utils/hybridSearch.ts:**
  - Already using Supabase's `hybrid_search` RPC function.
  - Updated to use imported Supabase client from `supabaseClient.ts`.
  - Removed file system dependencies and corpus statistics loading.
  - Added proper error handling for Supabase operations.

## Remaining Tasks

### 1. Update API Endpoints
- **api/query.ts:** Update to use the refactored utility functions.
- **api/admin/ingest-document.ts:** Update document ingestion to use the new schema and functions.
- Other relevant API routes that interact with the vector store.

### 2. Additional Utility File Checks
- **utils/openaiClient.ts:** Check if any embedding-related functions need updating.
- **utils/geminiClient.ts:** Ensure this properly supports the embedding model used in our rebuild script.

### 3. Integration Testing
- Test vector search functionality with complex queries.
- Test keyword search functionality.
- Test hybrid search with various weight combinations.
- Verify document ingestion workflow.
- Check performance with large result sets.

### 4. Data Validation & Potential Cleanup
- Verify that metadata and context are correctly populated and accessible.
- Consider a script to clean up duplicate documents (already handled via SQL).
- Review document approval statuses for consistency.

### 5. Document Ingestion Updates
- Modify any related ingestion scripts to use the new Supabase backend.
- Ensure correct population of required fields (`document_id`, `chunk_index`, etc.).
- Consider adding triggers to automatically update the `text_search_vector` column on insert/update.

### 6. UI Integration
- Update any UI components that directly interact with vector or search functions.
- Add appropriate error handling for Supabase-specific errors.

## Implementation Details & Gotchas

### Database
- The Supabase database now has `documents` (metadata) and `document_chunks` (text, embeddings) tables.
- Full-text search is now handled by PostgreSQL's built-in capabilities instead of a custom BM25 implementation.
- Vector similarity uses the `<=>` operator from pgvector (cosine distance).

### Async Code
- All vector store functions are now `async` and return Promises - code calling these functions needs to be updated to handle this change.

### Error Handling
- The refactored code includes more robust error handling for database operations.
- API routes need updating to properly handle and report Supabase errors.

### Security
- Application uses Supabase service role key for backend operations - ensure this is kept secure.
- Consider adding Row Level Security (RLS) policies in the future if multi-tenant access is needed.

## Next Steps Recommendation
1. Check API endpoints to ensure they're all using the new Supabase-based utility functions
2. Update document ingestion flow to use the new schema
3. Perform thorough testing of the entire system
4. Complete UI integration where needed

---

This migration moves the system from a file-based vector store with limited scalability to a robust PostgreSQL-backed solution with optimized search capabilities, setting it up for better performance and maintainability going forward. 
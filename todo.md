# Sales Chat RAG Application TODO List

## Critical Issues

### API Key Issues
- [x] Update OpenAI API Key in both `.env` and `.env.local` files
- [x] **RESOLVED**: Replace invalid Gemini API key (`AIzaSyBghKQWBhi2w2BO0-EdqnHGU-jY7DrRTM`) with a valid one (`AIzaSyCdTVXWgr4QkLW2xxneXB2cQgTElgIMWQM`)
- [x] Implement proper error handling for API key failures to ensure graceful fallback

### Module Import/Export Issues
- [x] Fixed export issues in `utils/modelConfig.ts` to provide both named and default exports
- [x] Fixed export issues in `utils/modelConfigFallback.ts` to match the same pattern
- [x] Review all files importing from modelConfig to ensure they use the correct import approach

### Search Implementation Changes
- [x] **URGENT**: Replace custom BM25 implementation with PostgreSQL FTS (Full-Text Search)
- [x] Create migration script to add `text_search_vector` column to document chunks table
- [x] Update `hybrid_search` function to use PostgreSQL FTS instead of custom BM25
- [x] Remove unnecessary corpus statistics tables and functions once FTS is implemented
- [ ] Run updated `rebuildVectorStoreGemini_modified.js` with corrected embedding model (`text-embedding-004`)
- [ ] Test hybrid search API to confirm it works correctly with PostgreSQL FTS
- [ ] Update search API documentation to reflect the new implementation
- [ ] Verify parameter compatibility between `utils/hybridSearch.ts` and the new PostgreSQL `function
- [ ] Test with various query types to ensure FTS stemming and tokenization work correctly
- [ ] Optimize vector_weight (default 0.7) and keyword_weight (default 0.3) parameters for best results

### Embedding Model Issues
- [x] **RESOLVED**: Fix incorrect Gemini embedding model in `rebuildVectorStoreGemini_modified.js` (changed from "embedding-001" to "text-embedding-004")
- [x] **RESOLVED**: Update `geminiClient.ts` to use the consistent embedding model from central configuration rather than hardcoded "embedding-001"
- [x] **RESOLVED**: Update `embeddingClient.ts` to use the same model ("text-embedding-004") for consistency
- [x] Ensure all embedding functions reference the same model to maintain consistency in vector dimensions

### Model Configuration Issues
- [x] **RESOLVED**: Update `modelConfig.ts` to use validated Gemini models
- [x] **RESOLVED**: Fix references to "gemini-2.0-pro" which doesn't exist
- [x] **RESOLVED**: Update provider settings to use 'gemini' instead of 'openai' for chat operations
- [x] **RESOLVED**: Configure consistent model names across the application

### Tagging Issues
- [x] Fix chat session tags processing - currently all tags are returning null 
- [x] Review the `extractKeywords` function implementation to properly extract and save tags
- [x] Ensure consistent tag extraction and storage across different storage methods

### Supabase Integration
- [x] Fix `supabase.rpc is not a function` error in hybridSearch function
- [ ] Implement proper error handling for Supabase connection failures
- [ ] Update Supabase client initialization to ensure proper RPC function availability

### Perplexity API Issues
- [x] **RESOLVED**: Review hardcoded Perplexity API key in `perplexityClient.ts` for potential replacement - Updated to use PERPLEXITY_API_KEY environment variable
- [x] **RESOLVED**: Add proper error handling for Perplexity API rate limiting - Removed rate limit and implemented Supabase cache 
- [x] **RESOLVED**: Implement feature flag to disable Perplexity API when not needed - Added USE_PERPLEXITY and PERPLEXITY_COMPANY_RESEARCH_ONLY flags

### Multi-Modal Processing
- [ ] Complete implementation of image analysis functionality
- [ ] Ensure proper storage of images in Supabase
- [ ] Fix integration between multi-modal chunks and hybrid search

### Admin Dashboard Issues
- [ ] Complete implementation of pending document approval workflow
- [ ] Add analytics dashboard for tracking feedback and usage statistics
- [ ] Implement proper admin authentication to secure the admin routes

### Analytics and Document Management Implementation
- [x] **NEW**: Create new database tables for analytics and document management:
  - [x] `analytics_events` - Track usage patterns and user behavior
  - [x] `search_metrics` - Track detailed search behavior and performance
  - [x] `search_queries_aggregated` - Analyze popular search terms and trends
  - [x] `user_feedback` - Collect and manage explicit user feedback
  - [x] `query_categories` - Organize and manage common query types for training
  - [x] `search_synonyms` - Enhance search relevance with custom synonyms
  - [x] `visual_content` - Support multi-modal content storage and retrieval
  - [ ] `pending_documents` - Facilitate document approval workflow
- [x] Create SQL views for common analytics queries:
  - [x] `v_top_searches` - View for most common searches
  - [x] `v_search_performance_by_type` - View for search performance metrics by search type
  - [x] `v_user_feedback_summary` - View for user feedback analysis
- [x] Implement API endpoints to collect and store analytics data:
  - [x] Created `/api/analytics/track.ts` endpoint for tracking events, searches, and feedback
- [x] **NEW**: Fix analytics trigger function to work with existing database schema
  - [x] Corrected column name mismatches between scripts and existing tables
  - [x] Updated trigger to use `query_normalized` instead of `query_text`
  - [x] Created proper aggregation logic for search metrics
- [x] **NEW**: Create analytics dashboard and tracking components
  - [x] Built comprehensive dashboard with charts and filters in `pages/admin/analytics.tsx`
  - [x] Implemented feedback collection UI components in the chat interface
  - [x] Added search result tracking with intersection observer for engagement metrics
  - [x] Created API endpoints for analytics data retrieval and export
- [ ] Enhance analytics implementation to track:
  - [ ] User interaction patterns with search results
  - [ ] Document popularity and engagement metrics
  - [ ] Search quality metrics with correlation to feedback
  - [ ] A/B testing for different search algorithms
- [ ] Create dashboard for visualizing search and usage analytics
- [ ] Implement data export functionality for offline analysis

### Admin Approval Workflow Implementation
- [ ] Create admin UI for reviewing pending documents
- [ ] Implement document submission form for users to upload new content
- [ ] Add server API endpoints to handle pending document operations
- [ ] Create approval/rejection workflow with notifications
- [ ] Set up RLS policies for the pending_documents table
- [ ] Implement document processing pipeline for approved documents
- [ ] Add status tracking and history for submitted documents

## Temporary Solutions Implemented

1. **API Fallbacks**:
   - Modified code to fall back to OpenAI when Gemini operations fail
   - Updated API keys in environment files with valid keys
   - Configured "gemini-2.0-flash" as the default model since it was confirmed to work

2. **Module Exports**:
   - Implemented hybrid export approach (both named and default exports)
   - Updated `modelConfig.ts` and `modelConfigFallback.ts` to use consistent export patterns

3. **Error Handling**:
   - Added graceful error handling in various functions
   - Implemented fallback search functionality when primary search fails

4. **Search Implementation**:
   - Migrated from custom BM25 to PostgreSQL Full-Text Search
   - Created clean migration script for adding text search vector and index
   - Updated hybrid_search function to use FTS instead of custom BM25
   
5. **Model Configuration**:
   - Updated all model references to use consistent naming
   - Changed embedding model to "text-embedding-004" in all related files
   - Fixed chat completion to use Gemini providers with the working API key
   - Removed references to non-existent models like "gemini-2.0-pro"

6. **Tag Extraction**:
   - Improved `extractKeywords` function to handle null cases and better filtering
   - Added more comprehensive stopword list for better keyword extraction
   - Implemented consistent tag extraction across both storage methods

7. **Supabase Client Initialization**:
   - Fixed Supabase admin client initialization to properly support RPC functions
   - Added error handling for RPC function availability
   - Created a test script to verify Supabase functionality

## Next Steps

### Short-term Fixes
1. **Test and Fix Supabase RPC Functionality**:
   - [x] Create a test script to diagnose Supabase RPC function issues
   - [x] Update Supabase client initialization to properly support RPC functions
   - [x] Run test script with `node scripts/test_supabase_rpc.js` to verify RPC functionality
   - [x] If issues persist, check Supabase version compatibility with RPC interface

2. **API Models and Configuration**:
   - [x] Verify Gemini API key functionality with direct API tests
   - [x] Update all model references to use correct and available models
   - [x] Fix inconsistent embedding model references
   - [x] Update feature flags to enable Gemini functionality

3. **Complete PostgreSQL FTS implementation**:
   - [x] Apply `update_text_search.sql` migration script to add text search vectors
   - [x] Remove complex corpus statistics calculations and tables
   - [x] Run the following commands to rebuild the document store:
     ```sql
     -- First purge existing document data
     DELETE FROM document_chunks;
     DELETE FROM documents;
     ```
   - [ ] Run the rebuild script to repopulate the database with correct embeddings:
     ```bash
     node scripts/rebuildVectorStoreGemini_modified.js
     ```
   - [ ] Test search performance and relevance with the new implementation
   - [ ] Verify `utils/supabaseClient.ts` and `utils/hybridSearch.ts` parameter compatibility with new SQL function

4. **Fix Supabase RPC function**:
   - [x] Debug Supabase client initialization
   - [x] Ensure proper version of Supabase client is being used
   - [x] If test_supabase_rpc.js shows that RPC is not available, install a compatible version:
     ```bash
     npm install @supabase/supabase-js@2.38.4
     ```

5. **Fix tagging issues**:
   - [x] Update tag extraction and processing functions
   - [x] Add null checks and improved word filtering
   - [x] Fix consistent tag extraction across storage methods
   - [ ] Test tag functionality by creating and updating sessions

6. **Secure API keys**:
   - [x] Verify all API keys are valid and working
   - [x] Update environment variables with correct keys
   - [ ] Add proper validation for API key presence before making API calls
   - [ ] Implement consistent error handling across all API clients

### Medium-term Tasks
1. Properly configure Supabase:
   - [ ] Complete migration of all data to Supabase
   - [ ] Implement proper indexing for vector search and full-text search
   - [ ] Test all CRUD operations
   - [ ] Set up database monitoring for hybrid_search function performance
   - [x] Create and configure analytics and document management tables
   - [x] Implement data collection for search metrics and user behavior

2. Implement better error handling:
   - [ ] Add more comprehensive logging
   - [ ] Create fallback strategies for all critical functions
   - [ ] Implement retry logic for transient failures

3. Improve API key management:
   - [ ] Move to a more secure key management solution
   - [ ] Implement key rotation and monitoring

4. Enhance tagging functionality:
   - [ ] Implement proper tag extraction and processing
   - [ ] Update UI to display and filter by tags
   - [ ] Add machine learning-based tag suggestions

5. Complete admin dashboard:
   - [ ] Finalize pending document approval workflow
   - [x] Implement analytics dashboard with visualizations
   - [ ] Add proper authentication and authorization
   - [ ] Create document submission and approval workflow UI
   - [x] Add visualization tools for search metrics and user behavior
   - [x] Implement feedback collection UI components in the chat interface

6. Search analytics implementation:
   - [x] Create endpoints to capture search interactions (`/api/analytics/track.ts`)
   - [x] Implement database schema for tracking search analytics
   - [x] Set up trigger for automated aggregation of search data
   - [x] Fix trigger function to match existing database schema
   - [x] Implement tracking for click-through rates on search results
   - [ ] Add analytics to identify content gaps from zero-result searches
   - [ ] Create search synonym management interface
   - [ ] Set up automated reports for most common queries and trends

### Long-term Improvements
1. Refactor modular architecture:
   - [ ] Better separation of concerns
   - [ ] More consistent import/export patterns
   - [ ] Improved testing coverage

2. Performance optimizations:
   - [ ] Optimize embedding generation
   - [ ] Implement caching strategies for search results
   - [ ] Tune PostgreSQL FTS parameters for better relevance
   - [ ] Improve response times for hybrid search
   - [ ] Monitor and optimize the text_search_vector GIN index performance
   - [ ] Add additional indexes if necessary based on query patterns
   - [ ] Optimize analytics tables for reporting performance

3. Enhanced monitoring:
   - [ ] Implement performance monitoring
   - [ ] Add usage analytics
   - [ ] Set up alerting for critical failures
   - [ ] Create dashboard for search quality metrics
   - [ ] Create automated reporting on search and content effectiveness
   - [ ] Implement anomaly detection for unusual search patterns

4. Complete multi-modal implementation:
   - [ ] Finalize image analysis and processing
   - [ ] Add support for additional file types (PDFs, diagrams, etc.)
   - [ ] Improve relevance matching between text and visual content 
   - [ ] Implement analytics for visual content effectiveness

## Model Use Cases
1. **Chat Completions**: 
   - Model: `gemini-2.0-flash`
   - File: `geminiClient.ts` - `generateGeminiChatCompletion`
   - Environment Variable: `DEFAULT_LLM_MODEL`

2. **Text Embeddings**:
   - Model: `text-embedding-004`
   - Files: 
     - `embeddingClient.ts` - `GeminiEmbeddingClient` 
     - `geminiClient.ts` - `embedTextWithGemini`
   - Environment Variable: `EMBEDDING_MODEL`

3. **Context Generation**:
   - Model: `gemini-2.0-flash`
   - File: `modelConfig.ts` - `contextGenerationModel`
   - Used for: Generating context-aware responses and document analysis

4. **Reranking**:
   - Model: `gemini-2.0-flash` (previously incorrectly set to `gemini-2.0-pro` which doesn't exist)
   - File: `modelConfig.ts` - `rerankerModel`
   - Used for: Reranking search results for improved relevance

5. **Fallback Chat Completions**: 
   - Model: `gpt-3.5-turbo-1106` (OpenAI)
   - File: `openaiClient.ts` - `generateChatCompletion`
   - Environment Variable: `FALLBACK_LLM_MODEL`
   - Used when Gemini chat completion fails

## Files to Purge
- [x] `utils/bm25.ts` - Custom BM25 implementation replaced by PostgreSQL FTS
- [x] `utils/bm25Search.ts` - File-based BM25 search replaced
- [x] `scripts/calculate-corpus-stats.js` - No longer needed with PostgreSQL FTS
- [x] `data/corpus_stats/*` - All corpus statistics files are redundant with FTS

## Commands to Run
```bash
# Test Supabase RPC functionality
node scripts/test_supabase_rpc.js

# If Supabase RPC test fails, update Supabase JS client
npm install @supabase/supabase-js@2.38.4
```

```sql
-- Purge existing data in Supabase before rebuilding:
DELETE FROM document_chunks;
DELETE FROM documents;

-- Or to just update without purging, run this to add the text search vector:
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS text_search_vector tsvector
GENERATED ALWAYS AS (to_tsvector('english', coalesce(text, ''))) STORED;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_document_chunks_text_search_vector 
ON document_chunks 
USING gin(text_search_vector);

-- Apply the analytics tables migration
\i migrations/analytics_tables.sql

-- Apply the fixed analytics trigger (if needed)
\i migrations/fixed_analytics_trigger.sql
```

## PostgreSQL FTS Tips
- The `text_search_vector` column is automatically updated when the `text` column changes
- FTS in PostgreSQL provides stemming (e.g., 'running' matches 'run')
- Adjust vector_weight (default 0.7) and keyword_weight (default 0.3) based on relevance testing
- FTS uses the PostgreSQL language 'english' by default - this can be changed if needed
- The `process_search_query` helper function safely formats queries for the PostgreSQL `to_tsquery` function

## New Analytics Tables and Views

### SQL to Create Analytics Tables
Save the following SQL to a file (e.g., `scripts/create_analytics_tables.sql`) and run it in Supabase:

```sql
-- 1. Enhanced Search Metrics Table
CREATE TABLE search_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    session_id TEXT,
    query_text TEXT NOT NULL,
    search_type TEXT NOT NULL CHECK (search_type IN ('hybrid', 'vector', 'keyword', 'fallback')),
    result_count INTEGER NOT NULL DEFAULT 0,
    execution_time_ms INTEGER,
    clicked_results JSONB,
    relevance_feedback JSONB,
    filter_used JSONB,
    query_vector VECTOR(768),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    company_context TEXT,
    query_category TEXT
);

-- Additional tables (visual_content, pending_documents, search_synonyms, etc.)
-- See the complete SQL in scripts/create_analytics_tables.sql
```

### Useful Analytics Views
```sql
-- Top searched queries
CREATE VIEW top_searches AS
SELECT 
    query_normalized,
    total_count,
    successful_count,
    zero_results_count,
    avg_result_count,
    last_seen
FROM 
    search_queries_aggregated
ORDER BY 
    total_count DESC;

-- Additional views for no_results_searches, search_activity_by_day, etc.
-- See the complete SQL in scripts/create_analytics_views.sql
```

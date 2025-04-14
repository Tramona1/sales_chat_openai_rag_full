# Archived Migration Scripts

This folder contains migration scripts and obsolete files that were used once for specific data migrations but are no longer in active use.

## Migration Scripts

1. **migrateDbSchema.ts**
   - Migrated the database schema from 1536-dimension OpenAI embeddings to 768-dimension Gemini embeddings
   - Modified vector columns, dropped old indices, and created new optimized indices

2. **migrateToMultiModal.js**
   - Upgraded existing documents to support multi-modal content (text + images)
   - Extracted and analyzed images from PDFs and other documents
   - Created multi-modal chunks with visual context information

3. **rebuildVectorStoreGemini_modified.js**
   - Rebuilt the vector store using Gemini embeddings
   - Generated context for documents using Gemini
   - Created chunks and embeddings for all documents
   - Stored everything in Supabase

4. **rebuild_corpus_stats.js** and **rebuild_corpus_stats_batched.js**
   - Scripts for rebuilding BM25 corpus statistics
   - Replaced by PostgreSQL Full-Text Search (FTS) functionality
   - Now handled directly by database functions

## Obsolete Files

5. **vectorSearch.ts**
   - Provided simple vector-similarity search functions
   - Superseded by the more comprehensive `hybridSearch.ts` and `vectorStoreFactory.ts` modules
   - Functionality has been consolidated into the refactored embedding system

6. **metadataExtractor.ts**
   - Previously handled standalone metadata extraction
   - Functionality consolidated into `documentAnalysis.ts` which provides a unified approach
   - Replaced to avoid redundant LLM calls and ensure consistency

7. **bm25.ts**
   - Custom BM25 implementation for keyword search
   - Replaced by PostgreSQL Full-Text Search (FTS) for improved performance and scalability
   - Core functionality is now handled directly in the database

8. **bm25Search.ts**
   - Client-side integration of BM25 keyword search
   - Superseded by the `performBM25Search` function in the hybrid search module
   - PostgreSQL-based implementation is more efficient and supports larger document collections

9. **bm25SearchFactory.ts**
   - Factory pattern implementation for BM25 search
   - Provided a unified interface for both file-based and Supabase-based BM25 search
   - Redundant since we now exclusively use PostgreSQL FTS

10. **enhancedRetrieval.ts**
    - Combined BM25 and vector-based search implementation
    - Superseded by the `hybridSearch.ts` module which provides more flexibility
    - Relied heavily on the obsolete file-based BM25 implementation

11. **pages/api/hierarchical-search.ts**
    - Deprecated API endpoint for hierarchical search
    - Functionality integrated into the main hybrid search system
    - Now just redirects to the main search API

12. **pages/hierarchical-search.tsx**
    - Deprecated page for hierarchical search UI
    - Functionality integrated into the main chat interface
    - Now just redirects to the main chat page

13. **scripts/build_corpus_stats.ts**
    - Script for building BM25 corpus statistics files
    - Created statistical data used by the file-based BM25 implementation
    - Replaced by PostgreSQL Full-Text Search (FTS) functionality

## Corpus Statistics Files

The `data/corpus_stats/` directory, which contained BM25 term frequency and document frequency data, has been removed as these statistics are now maintained directly by PostgreSQL's Full-Text Search system. This includes:

- `corpus_statistics.json` - Overall corpus information
- `document_frequency.json` - Document frequency information for terms
- `document_lengths.json` - Document length information
- `term_frequencies.json` - Term frequency data

This explains why scripts like `build_corpus_stats.ts` are archived. Similarly, scripts that interacted with these file-based statistics (e.g., the original `migrate_to_supabase.js` and parts of `purgeVectorStore.ts`, also now archived) are obsolete.

## Related Code Changes

Several active files were modified rather than archived:

- **adminWorkflow.ts**: Updated to use PostgreSQL for BM25 corpus statistics instead of the file-based implementation
- **pages/api/query.ts**: Already using the hybrid search approach with configurable weights

These files are kept for reference purposes only and should not be used in new code. Please use the current implementations as documented in the codebase. 
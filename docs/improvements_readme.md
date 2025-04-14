## RAG Pipeline Improvements

This document outlines the improvements made to the RAG (Retrieval-Augmented Generation) pipeline to enhance the quality and relevance of responses.

### Implementation Status

#### 1. Improved Document Processing

- **Chunk Size Optimization**:
  - Increased `DEFAULT_CHUNK_SIZE` from 500 to 700 chars for better context preservation
  - Status: ✅ Implemented in `scripts/process_crawl_and_store.ts`

- **URL-based Categorization**:
  - Added logic to derive reliable categories from URL structure patterns
  - Fixed bugs in URL categorization for paths like `/blog/` and `/about/`
  - Added new document category types: `BLOG`, `COMPANY_INFO`, `LEGAL`, and `PRODUCT_OVERVIEW` 
  - Enhanced path matching logic using both exact matches (using `===` and `startsWith()`) and pattern matches (using `includes()`)
  - Implemented special case handling for homepage URL to categorize as `PRODUCT_OVERVIEW`
  - **NEW**: Added extraction of all URL path segments as tags for more granular filtering
  - **NEW**: Store path segments in both document and chunk metadata for improved retrieval
  - Status: ✅ Implemented in `scripts/process_crawl_and_store.ts`

- **LLM Document Context Enrichment**:
  - Added document-level context extraction using LLM for improved metadata
  - Extract document summaries, entities (PERSON, ORG, PRODUCT, LOCATION), and keywords
  - Only raw chunk text used for embedding generation
  - Document context metadata added to chunks for improved retrieval relevance
  - Status: ✅ Implemented in `scripts/process_crawl_and_store.ts`

#### 2. Query Processing Enhancements

- **Query Text Cleaning**:
  - Applied consistent text normalization to user queries
  - Implemented `query.replace(/\s+/g, ' ').trim()` to normalize whitespace
  - Status: ✅ Implemented in `hybridSearch.ts`

- **Improved Entity Extraction**:
  - Enhanced entity detection in user queries 
  - Status: ✅ Implemented in `hybridSearch.ts`

#### 3. Vector Search Optimization

- **Embedding Consistency**:
  - Ensured consistent text cleaning between indexing and query time
  - Status: ✅ Implemented in `embeddingClient.ts`

- **Metadata-Aware Reranking**:
  - Leveraged document metadata in reranking algorithm
  - **NEW**: Added support for URL path segment filtering in hybrid search
  - Status: ✅ Implemented in `hybridSearch.ts` and via database function updates

#### 4. Response Generation Improvements

- **Context Coherence**:
  - Improved context ordering based on relevance score
  - Status: ✅ Implemented

### 5. Database Improvements

- **URL Path Segment Indexing**:
  - Added GIN index for efficient filtering by URL path segments
  - Updated the `hybrid_search` database function to support URL path segment filtering
  - Status: ✅ Implemented in `db_fixes.sql`

### Modified Files

#### 1. `utils/hybridSearch.ts`
- Enhanced filter interface to support URL path segment filtering
- Updated filter conversion logic to handle URL path segments properly
- Improved logging around URL path segment handling

#### 2. `scripts/process_crawl_and_store.ts`
- Increased `DEFAULT_CHUNK_SIZE` from 500 to 700 for better context preservation.
- Added URL-based categorization logic to derive reliable categories from URL structure.
- Fixed URL categorization bugs to ensure paths like `/blog/` and `/about/` are properly categorized.
- Added new document category types: `BLOG`, `COMPANY_INFO`, `LEGAL`, and `PRODUCT_OVERVIEW` to support better URL-based categorization.
- Improved path matching logic to handle both exact matches (using `===` and `startsWith()`) and pattern matches (using `includes()`).
- Added special case handling for the homepage URL to categorize it as `PRODUCT_OVERVIEW`.
- Implemented LLM document context enrichment to add document-level summaries and entity information.
- Ensured only raw chunk text is used for embedding generation.
- Added document context metadata to chunks, ensuring important document-level information is available in every chunk.
- **NEW**: Added extraction and storage of all URL path segments as tags in both document and chunk metadata.

#### 3. `utils/embeddingClient.ts`
- Modified to ensure consistent, minimal text cleaning in both `embedText` and `embedBatch` methods.
- Only applies `text.replace(/\s+/g, ' ').trim()` immediately before sending to the embedding API.

#### 4. `db_fixes.sql`
- Created SQL script to fix the `text_search_vector` column:
  - Drops redundant index `idx_document_chunks_text_search_vector`.
  - Recreates the column with `GENERATED ALWAYS AS (to_tsvector('english'::regconfig, text)) STORED`.
  - Maintains the existing `idx_document_chunks_fts` index.
- **NEW**: Added SQL to update the `hybrid_search` function to support URL path segment filtering
- **NEW**: Added GIN index on URL path segments for efficient filtering 
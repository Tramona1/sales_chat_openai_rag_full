# Data Processing Pipeline Improvements

This document outlines the improvements made to the data processing pipeline based on the "Fixed Data Processing Strategy" document. The changes address several core issues identified in the initial content audit.

## 1. Key Issues Addressed

1. **Inconsistent Text Preprocessing**: 
   - Modified `utils/embeddingClient.ts` to ensure consistent text cleaning with `text.replace(/\s+/g, ' ').trim()` in both `embedText` and `embedBatch` methods.
   - Updated `scripts/process_crawl_and_store.ts` to ensure only raw chunk text is passed to the embedding generation.

2. **Faulty FTS Vector Generation**: 
   - Created SQL fix in `db_fixes.sql` to properly define the `text_search_vector` column as a generated column that automatically populates based on the `text` column.
   - Removed redundant index on the same column.

3. **Chunking Fragmentation**: 
   - Increased `DEFAULT_CHUNK_SIZE` from 500 to 700 in `scripts/process_crawl_and_store.ts` for more semantically complete chunks.
   - Improved the `splitRegularContent` function in `utils/documentProcessing.ts` to prioritize paragraph breaks, reducing the likelihood of breaking related content.

4. **URL-Based Categorization**: 
   - Added URL-based category derivation in `scripts/process_crawl_and_store.ts` based on URL path patterns.
   - This provides reliable category metadata derived from URL structure.

5. **LLM Document Context Enrichment**: 
   - Implemented the `getDocumentLevelContextFromLLM` function to extract document-level summaries and entity information.
   - Added this context to both the document metadata and individual chunk metadata.

## 2. Modified Files

### 1. `utils/embeddingClient.ts`
- Modified to ensure consistent, minimal text cleaning in both `embedText` and `embedBatch` methods.
- Only applies `text.replace(/\s+/g, ' ').trim()` immediately before sending to the embedding API.

### 2. `scripts/process_crawl_and_store.ts`
- Increased `DEFAULT_CHUNK_SIZE` from 500 to 700 for better context preservation.
- Added URL-based categorization logic to derive reliable categories from URL structure.
- Implemented LLM document context enrichment to add document-level summaries and entity information.
- Ensured only raw chunk text is used for embedding generation.
- Added document context metadata to chunks, ensuring important document-level information is available in every chunk.

### 3. `utils/documentProcessing.ts`
- Improved the `splitRegularContent` function to prioritize splitting on paragraph breaks.
- Added better handling of large paragraphs by using sentence boundaries.
- This reduces the risk of fragmenting related content (like lists or paragraphs) across chunks.

### 4. `db_fixes.sql`
- Created SQL script to fix the `text_search_vector` column:
  - Drops redundant index `idx_document_chunks_text_search_vector`.
  - Recreates the column with `GENERATED ALWAYS AS (to_tsvector('english'::regconfig, text)) STORED`.
  - Maintains the existing `idx_document_chunks_fts` index.

## 3. How These Changes Solve the Identified Issues

### Improved Vector Matching
By ensuring consistent text preprocessing both at indexing time and at query time, we eliminate vector mismatches. The embedding vectors will be generated from identically processed text, enabling reliable semantic similarity matching.

### Reliable Keyword Search
The fixed `text_search_vector` column will now correctly populate with the indexed text tokens, enabling proper keyword search functionality in the hybrid search implementation.

### Better Semantic Coherence
The larger chunk size (700 vs 500) and improved splitting algorithm prioritizing paragraph boundaries will result in more coherent, semantically complete chunks. This will preserve the integrity of related content like lists, definitions, and conceptual explanations.

### Enhanced Metadata
The URL-based categorization provides reliable metadata derived from the source URL structure, complementing the sometimes inconsistent LLM-generated categories.

### Enriched Context in Chunks
By extracting document-level insights with LLM and propagating them to all chunks from that document, we ensure that important context (like CEO/CTO names mentioned once in the document) is available in every chunk's metadata for retrieval.

## 4. How to Apply the Changes

1. **Database Changes**: 
   - Run the SQL in `db_fixes.sql` against your Supabase database to fix the `text_search_vector` column.

2. **Code Updates**:
   - Deploy the modified files to your environment.

3. **Re-index Process**:
   - Run the updated `process_crawl_and_store.ts` script with clean crawl data to re-index your content.
   - Example: `npx ts-node scripts/process_crawl_and_store.ts ./data/crawl_data --purge`

## 5. Testing Considerations

After applying these changes, it's recommended to test:

1. **Vector Search Quality**: Test semantic search queries to verify improved retrieval accuracy.
2. **Keyword Search**: Verify that keyword search is now functioning correctly.
3. **Mixed Content Retrieval**: Test retrieval of content that requires understanding document-level context (like CEO names or investor information).
4. **Chunk Quality**: Review some generated chunks to verify they have appropriate semantic boundaries.

## 6. Further Improvements

While these changes address the core issues, future improvements could include:

1. **Fine-tuning the chunking size** based on content type (potentially using different sizes for different content categories).
2. **Enhancing the URL categorization rules** with more specific patterns based on your website structure.
3. **Adding more entity types** to the LLM document context extraction for specialized industry terms.

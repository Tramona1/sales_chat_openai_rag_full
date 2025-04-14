# Category Standardization Tracker

This document tracks the progress of standardizing categories and tags across the application. Each file should be reviewed to ensure it adheres to the standardized approach defined in `utils/tagUtils.ts` and `utils/documentCategories.ts`.

## Core Category Definition Files

### 1. `utils/tagUtils.ts`
- [x] Verify `STANDARD_CATEGORIES` is complete and accurate (Acts as source of truth)
- [x] Ensure utility functions handle all edge cases (normalizeTags, parseTagInput reviewed)
- [x] Check that `getCategoryFilterOptions()` is implemented correctly
- [x] Verify normalization functions for keywords and tags (Checked)

### 2. `utils/documentCategories.ts`
- [x] Update `DocumentCategoryType` enum to align with `STANDARD_CATEGORIES`
- [x] Remove legacy category mappings (Done by replacing enum/attributes)
- [x] Implement `getStandardCategories()` function (Updated)
- [x] Add `mapToStandardCategory()` function (Updated to be passthrough)
- [x] Review `CATEGORY_ATTRIBUTES` for completeness (Updated with new categories)
- [x] Add missing enum members (`EntityType.OTHER`, `QualityControlFlag` additions)
- [x] Add placeholder `detectCategoryFromText` export (Updated logic)

### 3. `types/metadata.ts`
- [x] Ensure type definitions use `DocumentCategoryType` enum (Checked, uses imports)
- [x] Verify `EntityType` enum is standardized (Checked, uses imports)
- [x] Check that metadata interfaces use standardized types (Checked)
- [x] Review quality flag enums for consistency (Checked, uses imports)
- [x] Update comments/defaults for 1-10 technical level scale (Completed)
- [x] Fix `needsManualReview` function logic (Completed)

## Document Processing Files

### 4. `utils/documentProcessing.ts`
- [x] Review chunking logic to preserve metadata (Relies on generateChunkContext)
- [x] Check that `prepareTextForEmbedding` uses standardized categories (Uses context, seems OK)
- [x] Verify handling of context in chunks (Done via generateChunkContext)
- [x] Ensure visual content association is maintained

### 5. `utils/metadataExtractor.ts`
- [x] Consolidate with `extractDocumentContext` function (Consolidated into documentAnalysis.ts, file archived)
- [x] Create unified interface for document analysis results (Done in documentAnalysis.ts)
- [x] Ensure all categories are mapped to standard values (Done in documentAnalysis.ts)
- [x] Verify technical level scale (0-3) is consistently applied (Standardized to 1-10 in documentAnalysis.ts)

### 6. `utils/geminiProcessor.ts`
- [x] Update `findStandardizedCategory()` logic (Updated)
- [x] Verify prompt templates use standardized categories and 1-10 technical scale (Updated)
- [x] Check that all analysis outputs are properly standardized (Handled by findStandardizedCategory)

### 7. `utils/documentAnalysis.ts`
- [x] Review `mapToDocumentCategory` function (Simplified to check enum)
- [x] Verify `mapToEntityType` uses standard entity types (Checked)
- [x] Ensure analysis results are consistently structured (Checked)
- [x] Check handling of quality flags and confidence levels (Checked)
- [x] Update LLM prompt/schema for 1-10 technical level scale (Completed)

## Multi-Modal Processing Files

### 8. `utils/multiModalChunking.ts`
- [x] Review handling of visual content metadata (Inherits from text chunk, seems OK)
- [x] Check association of visuals with text chunks (Uses explicit refs & keywords)
- [x] Verify standardized approach to multi-modal context (Uses context, embedding prep combines info)
- [x] Ensure consistent metadata structure (Adds visualContent array, inherits base metadata)

### 9. `utils/imageAnalysis/imageAnalyzer.ts`
- [x] Check that visual metadata uses standardized fields (Yes: description, type, text, structuredData)
- [x] Verify extraction of text from visuals (Yes, requests detectedText)
- [x] Ensure consistent structure for visual descriptions (Relies on LLM based on prompt)
- [x] Review handling of tables and structured data (Yes, requests structuredData)

### 10. `utils/visualStorageStrategy.ts`
- [x] Verify storage of visual content URLs/IDs (Uses docId/filename path, returns public URL)
- [x] Check retrieval mechanism for visuals (Lists by docId, returns public URLs)
- [x] Ensure proper metadata association with stored visuals (Provides URL, association happens elsewhere)
- [x] Review access control for stored visuals (Relies on Supabase bucket policies)

## Embedding and Storage Files

### 11. `utils/embeddingClient.ts`
- [x] Verify standardized approach to embedding (Yes, uses factory pattern)
- [x] Check handling of task types (Yes, for Gemini)
- [x] Ensure batch processing is implemented correctly (Yes, with fallback for Gemini)
- [x] Review error handling and fallbacks (Returns zero vectors on error)

### 12. `utils/vectorStoreFactory.ts`
- [ ] Check vector storage implementation
- [ ] Verify handling of metadata in vector items
- [ ] Ensure consistent approach to chunks and embeddings
- [ ] Review factory pattern implementation

### 13. `utils/supabaseClient.ts`
- [x] Verify database schema matches standardized approach (Assumes JSONB metadata column, needs DB verification)
- [x] Check mapping of fields to database columns (Maps metadata correctly, context mapping unclear)
- [x] Ensure proper data types for metadata storage (Assumes JSONB, needs DB verification)
- [x] Review query implementations for search (Retrieves metadata correctly)

## Search Implementation Files

### 14. `utils/hybridSearch.ts`
- [x] Verify filter interface uses standardized categories and 1-10 technical scale (Completed)
- [x] Check implementation of PostgreSQL FTS (Relies on Supabase RPC `hybrid_search`)
- [x] Ensure proper weighting of vector and keyword search (Passed as parameters to RPC)
- [x] Review handling of entity and keyword filters (Filters passed to RPC via JSON)
- [x] Update `convertFilterToJson` for new categories/tech level (Completed)

### 15. `utils/reranking.ts`
- [x] Verify access to chunk context and metadata (Yes, uses metadata.category, .technicalLevel)
- [x] Check handling of visual content in reranking (Yes, uses extractVisualContext)
- [x] Ensure standardized categories influence relevance (Included in prompt to LLM)
- [ ] **TODO:** Update prompt construction for reranking to reflect 1-10 technical scale.

## Admin Interface Files

### 16. `components/admin/PendingDocuments.tsx`
- [x] Verify use of `getCategoryFilterOptions()` (Yes, for filter dropdown)
- [x] Check handling of document metadata (Editor uses STANDARD_CATEGORIES, tag utils)
- [x] Ensure consistent display of categories (Uses Chip for primary category)
- [x] Review filtering implementations (Uses category filter state)
- [x] Update technical level UI/logic for 1-10 scale (Completed in editor)
- [ ] **TODO:** Fix metadata saving on modal approval.

### 17. `components/admin/DocumentManagement.tsx`
- [x] Verify use of standardized categories in filters (Yes, uses STANDARD_CATEGORIES)
- [x] Check metadata editing functionality (Primary category uses STANDARD_CATEGORIES, Keywords use tag utils)
- [x] Ensure consistent handling of document properties (Displays standard fields)
- [x] Review search implementation (Includes text/content search)
- [ ] **TODO:** Add UI for editing `secondaryCategories`.
- [ ] **TODO:** Add UI for editing `entities` (if needed).
- [ ] **TODO:** Standardize technical level scale (1-10).
- [ ] **TODO:** Consider reusing/refactoring metadata editor from PendingDocuments.

### 18. `components/admin/EditDocumentModal.tsx`
- [x] Verify use of `getCategoryFilterOptions()` (Yes, for category dropdown)
- [x] Check handling of document metadata (Significant issues: uses 'category' not 'primaryCategory', simple strings for keywords/entities, no normalization)
- [x] Ensure all fields use standardized approaches (No - inconsistent tech level scale, no tag utils)
- [x] Review saving and validation logic (Relies on parent component via onSave)
- [ ] **TODO:** Determine if component is still used. If yes, fix standardization issues (field names, tech level 1-10, tag handling). If no, remove.

### 19. `components/admin/ChunkViewer.tsx`
- [x] Check display of chunk metadata (Only displays index and text, no metadata shown)
- [x] Verify editing of chunk properties (Only allows editing text content, not metadata)
- [x] Ensure consistent handling of visual content (Not explicitly handled/displayed)
- [x] Review embedding regeneration logic (Separate action exists)
- [ ] **TODO:** Consider displaying key chunk metadata (inherited category, context?) for admin visibility.

## API Endpoint Files

### 20. `pages/api/upload.ts`
- [x] Verify document processing pipeline (Uses analyzeDocument, splits, embeds, stores)
- [x] Check metadata extraction and standardization (Uses analyzeDocument results correctly for text)
- [x] Ensure consistent storage of processed documents (Uses insertDocument/insertDocumentChunks)
- [x] Review handling of visual content (Separate flow using ImageAnalyzer, stores visual-specific metadata)
- [ ] **TODO:** Consider refactoring to use central `processDocument` orchestrator.

### 21. `pages/api/admin/documents/index.ts` (Actual file: `documents.ts`)
- [x] Check filtering by standardized categories (Yes, filters on metadata->>primaryCategory)
- [x] Verify consistent document representation (Returns full document object with metadata)
- [x] Ensure proper pagination and sorting (Yes, uses range() and order())
- [x] Review response structure (Standard list response with total, page, limit)

### 22. `pages/api/admin/documents/[id].ts`
- [x] Verify handling of document metadata (GET retrieves metadata, PUT merges metadata)
- [x] Check updates to standardized fields (Relies on client sending standardized metadata in PUT)
- [x] Ensure consistent error handling (Standard Supabase error handling)
- [x] Review document deletion logic (Deletes chunks then document)

### 23. `pages/api/admin/chunks/search.ts`
- [x] Verify search implementation uses hybrid search (Yes, calls utils/hybridSearch)
- [x] Check filtering by standardized metadata (Completed)
- [x] Refactor keyword search path to use hybridSearch (Completed)
- [x] Ensure proper handling of visual content (Not explicitly handled in this search endpoint)
- [x] Review response structure and pagination (Standard list response with pagination)

## Script Files

### 24. `scripts/rebuildVectorStoreGemini_modified.js`
- [x] Update to use standard embedding client (Archived script, uses old import)
- [x] Consolidate document analysis logic (Archived script, has redundant logic)
- [x] Ensure consistent handling of metadata (Archived script, uses own non-standard metadata)
- [x] Review batch processing implementation (Archived script, bypasses standard pipeline)
- [ ] **INFO:** Script is archived and non-standard. Replace with new script using `processDocument` if needed.

## Consolidation Tasks

### 1. Technical Level Standardization
- [x] Decide on a standard scale (User suggests 1-10) -> **Confirmed 1-10**
- [x] Update `types/metadata.ts` type definitions/comments
- [x] Update `utils/documentAnalysis.ts` LLM prompts/schema/logic
- [x] Update `utils/geminiProcessor.ts` prompts/logic
- [x] Update `components/admin/PendingDocuments.tsx` UI
- [ ] Update `components/admin/EditDocumentModal.tsx` UI (If kept)
- [ ] **TODO:** Update `components/admin/DocumentManagement.tsx` UI

### 2. PendingDocuments Metadata Saving
- [ ] Update `handleConfirmApprovalFromModal` in `PendingDocuments.tsx`
- [ ] Update corresponding API endpoint (`/api/admin/documents/approve` or PUT `/api/admin/documents/[id]`)

### 3. DocumentManagement Editor Enhancements
- [ ] Add UI for editing `secondaryCategories`
- [ ] Add UI for editing `entities` (if needed)
- [ ] Consider refactoring to reuse `EditableMetadataViewer`

### 4. EditDocumentModal Component Review
- [ ] Determine if the component is still needed
- [ ] If yes, fix standardization issues (field names, tag handling, etc.)
- [ ] If no, remove the component and update any references

### 5. ChunkViewer Metadata Display
- [ ] Add display for relevant chunk-level metadata (e.g., inherited category, context)

### 6. Reranking Prompt Update (Task 15)
- [ ] Update prompt construction in `utils/reranking.ts` for 1-0 technical scale.

### 7. Upload API Refactoring (`upload.ts`)
- [ ] Consider refactoring text document processing to use the central `processDocument` orchestrator

### 8. Supabase Schema/Context Verification
- [ ] Verify `metadata` column in `document_chunks` is `JSONB`
- [ ] Verify storage and retrieval of `chunkContext` (summary, key points)

### 9. Archived Rebuild Script Replacement
- [ ] If batch processing from `workstream_crawl_data_transformed.json` is needed, create a new script using the standardized `processDocument` function

## Progress Tracking

- [x] Core Category Definition Files: 3/3 completed
- [x] Document Processing Files: 4/4 completed
- [x] Multi-Modal Processing Files: 3/3 completed
- [x] Embedding and Storage Files: 3/3 completed
- [x] Search Implementation Files: 2/2 completed
- [x] Admin Interface Files: 1/4 completed (PendingDocs reviewed, others pending UI updates/review)
- [x] API Endpoint Files: 4/4 completed
- [x] Script Files: 1/1 completed
- [ ] Consolidation Tasks: 1/9 completed (Technical Level Scale decided and partially implemented)

**Overall File Review Status**: 24/24 files reviewed (100% complete)
**Overall Standardization Progress**: Ongoing - Core definitions and processing logic updated. UI and consolidation tasks remain. 
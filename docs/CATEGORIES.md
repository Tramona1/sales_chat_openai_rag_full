# Document Categories System

## Overview

This document describes the standardized category system used throughout the Sales Chat RAG application. The system ensures that document categories are consistently used across all components, from document ingestion to search and presentation.

## Standardized Categories

The application uses a set of standardized categories defined in `utils/tagUtils.ts` as `STANDARD_CATEGORIES`:

| Category Value | Display Label | Description |
|----------------|---------------|-------------|
| `GENERAL` | General | General information that doesn't fit other categories |
| `PRODUCT` | Product | Product information, overviews, and capabilities |
| `TECHNICAL` | Technical | Technical specifications, APIs, and implementation details |
| `FEATURES` | Features | Information about specific features and functionality |
| `SALES` | Sales | Sales methodologies, processes, and strategies |
| `INDUSTRY` | Industry | Industry trends, analysis, and vertical-specific content |
| `COMPETITIVE` | Competitive | Information about competitors and competitive positioning |
| `REFERENCE` | Reference | Reference information, guides, and support materials |
| `INTERNAL` | Internal | Information for internal use, including policies and procedures |
| `PRICING` | Pricing | Pricing plans, tiers, and special offers |
| `COMPARISON` | Comparison | Comparative analysis between products, features, or companies |
| `CUSTOMER_CASE` | Customer Case | Customer case studies, success stories, and implementations |

## Implementation

The standardized categories are implemented in several key places:

1. **`utils/tagUtils.ts`** - Contains the `STANDARD_CATEGORIES` constant that serves as the source of truth for category values and labels.

2. **`utils/documentCategories.ts`** - Contains the `DocumentCategoryType` enum that aligns with the standardized categories, along with mappings for legacy categories.

3. **`utils/geminiProcessor.ts`** - Uses the `findStandardizedCategory` function to ensure that categories assigned by the Gemini AI model are mapped to standard categories.

4. **UI Components** - Components like `PendingDocuments.tsx` and `EditDocumentModal.tsx` use the `getCategoryFilterOptions()` function to populate category dropdowns with standardized options.

## End-to-End Data Flow - From Unstructured Data to RAG

### 1. Source Data Input

- Document sources include web crawls (processed via `scripts/rebuildVectorStoreGemini_modified.js`) and direct uploads
- Uploads handled through `/api/upload` or `/api/admin/ingest-document` endpoints
- Supported formats: PDF, DOCX, text, and images

### 2. Initial Processing & Text/Visual Extraction

- Raw text extracted using `utils/documentProcessing.ts::extractText` with format-specific parsers
- Visual elements (images) extracted from PDFs/PPTs or processed directly for standalone images
- Multi-modal processing ensures both text and visual content are properly handled

### 3. Multi-Modal Visual Analysis (Using Gemini Vision)

- Extracted images analyzed by `utils/imageAnalysis/imageAnalyzer.ts::analyzeImage` using Gemini Vision
- Generated outputs include visual descriptions, content type identification, and OCR text extraction
- Structured data extraction attempted for tables and charts

### 4. Visual Storage

- Actual image files stored in Supabase Storage via `utils/visualStorageStrategy.ts::uploadImage`
- URLs and IDs linking to stored images are retained for retrieval during search

### 5. Document-Level Analysis & Standardization (Using Gemini Text)

This critical step is where **category standardization** occurs:

- Extracted text sent to Gemini 2.0 for comprehensive analysis via `utils/metadataExtractor.ts::extractMetadata`
- Gemini extracts structured metadata including:
  - **Primary category** - Mapped to standard categories via `mapToDocumentCategory`
  - **Secondary categories** - Each mapped to standard categories
  - **Keywords** - Important terms extracted from the document
  - **Entities** - Named entities like people, organizations, products
  - **Technical level** - Numeric rating (0-3) of content complexity
  - **Quality flags** - Indicators of content quality or issues

- All categories are standardized at this stage using mapping functions to ensure consistency
- Document context is also generated including summary, main topics, and audience type

### 6. Chunking (Text & Multi-Modal)

- Documents split into chunks via `utils/documentProcessing.ts` or `utils/multiModalChunking.ts`
- Multi-modal chunking associates visual elements with relevant text chunks based on proximity

### 7. Chunk-Level Context Generation

- For each chunk, `utils/geminiClient.ts::generateChunkContext` creates chunk-specific context
- Context includes descriptions, key points, related topics, and other semantic information
- This context acts as additional "tagging" at the chunk level

### 8. Text Preparation for Embedding

- `utils/documentProcessing.ts::prepareTextForEmbedding` combines chunk text with document and chunk context
- This enriched text incorporates category information and other standardized metadata

### 9. Vector Creation (Embedding)

- Prepared text sent to embedding model via `utils/embeddingClient.ts::embedBatch`
- 768-dimension vector embeddings generated to represent the semantic content

### 10. Data Storage in Supabase

- Document-level metadata (including standardized categories) stored in `documents` table
- Individual chunks with embeddings stored in `document_chunks` table, linked to parent documents
- Metadata and context stored as JSONB, preserving all standardized categories and tags

### 11. Keyword Indexing (PostgreSQL FTS)

- GIN index created on text columns for efficient keyword searching
- Enables hybrid search combining vector similarity and keyword matching

## Metadata Structure and Search

The following metadata fields are standardized and used in search via `hybridSearch.ts`:

### Primary and Secondary Categories

- **Implementation**: Standardized using the `DocumentCategoryType` enum
- **Storage**: Stored as strings in document metadata
- **Search Usage**: `HybridSearchFilter.primaryCategory` and `HybridSearchFilter.secondaryCategories` fields
- **Example Filter**:
  ```typescript
  {
    primaryCategory: 'TECHNICAL',
    secondaryCategories: ['FEATURES', 'PRODUCT']
  }
  ```

### Keywords

- **Implementation**: Extracted by Gemini, stored as comma-separated strings
- **Standardization**: Processed via `normalizeTags` in `tagUtils.ts`
- **Storage**: Stored in document metadata as an array or comma-separated string
- **Search Usage**: `HybridSearchFilter.keywords` for filtering by specific terms
- **Example Filter**:
  ```typescript
  {
    keywords: ['integration', 'api', 'developer']
  }
  ```

### Technical Level

- **Implementation**: Numeric scale (0-3) assigned by Gemini
- **Meaning**:
  - **0**: Non-technical (general audience)
  - **1**: Basic technical knowledge required
  - **2**: Intermediate technical knowledge required
  - **3**: Advanced technical knowledge required
- **Search Usage**: `HybridSearchFilter.technicalLevelMin` and `HybridSearchFilter.technicalLevelMax`
- **Example Filter**:
  ```typescript
  {
    technicalLevelMin: 1,
    technicalLevelMax: 2
  }
  ```

### Entities

- **Implementation**: Structured objects extracted by Gemini
- **Types**: Defined in `EntityType` enum (PERSON, ORGANIZATION, PRODUCT, FEATURE, etc.)
- **Standardization**: Mapped via `mapToEntityType` function
- **Search Usage**: `HybridSearchFilter.requiredEntities` for entity-based filtering
- **Example Filter**:
  ```typescript
  {
    requiredEntities: ['PRODUCT:CRM Suite', 'FEATURE:Mobile Integration']
  }
  ```

### Custom Filters

- **Implementation**: Free-form key-value pairs for specialized filtering
- **Search Usage**: `HybridSearchFilter.customFilters` for application-specific criteria
- **Example**: Filtering by date range, source type, or other custom metadata

## Legacy Categories

For backward compatibility, the system also supports legacy categories that map to standardized ones:

| Legacy Category | Maps to Standard Category |
|-----------------|---------------------------|
| `CUSTOMER` | `REFERENCE` |
| `CASE_STUDY` | `CUSTOMER_CASE` |
| `TESTIMONIAL` | `CUSTOMER_CASE` |
| `SALES_PROCESS` | `SALES` |
| `COMPETITORS` | `COMPETITIVE` |
| `MARKET` | `INDUSTRY` |
| `INTERNAL_POLICY` | `INTERNAL` |
| `TRAINING` | `REFERENCE` |
| `FAQ` | `REFERENCE` |
| `OTHER` | `GENERAL` |

The `mapToStandardCategory` function in `documentCategories.ts` handles these mappings.

## Implementation Plan

To ensure complete uniformity across the system and proper integration with Supabase for search, the following actions are required:

### 1. Consolidate Document-Level Analysis (Ingestion)

**Problem**: Currently, there are two functions (`extractMetadata` in `metadataExtractor.ts` and `extractDocumentContext` in the rebuild script) that use Gemini to analyze document text for overlapping information.

**Actions**:

- Define a single comprehensive interface (e.g., `FullDocumentAnalysisResult`) that includes all required outputs
- Create one primary function (e.g., `analyzeDocumentContentWithGemini` in `documentAnalyzer.ts`) that takes document text
- Craft a single, detailed prompt for Gemini 2.0 that extracts all required fields in one structured JSON response
- Modify the ingestion pipeline to call only this unified function once per document
- Update storage logic to correctly map fields from `FullDocumentAnalysisResult` to appropriate Supabase columns

**Benefits**: Reduces redundant API calls, ensures consistent analysis results, simplifies the ingestion pipeline

### 2. Verify & Standardize Keyword Search (FTS Implementation)

**Problem**: The system switched from custom BM25 to PostgreSQL FTS, but implementation details need verification.

**Actions**:

- Confirm the GIN index on the tsvector representation of the `document_chunks.text` column exists in Supabase
- Review search logic in `hybridSearch.ts` and the Supabase RPC it calls
- Implement FTS query using standard PostgreSQL functions (`plainto_tsquery`, `websearch_to_tsquery`, `ts_rank`)
- Update `fallbackSearch` to use correct FTS logic instead of old BM25 functions

**Benefits**: Ensures the keyword component of hybrid search works correctly and efficiently using native database capabilities

### 3. Standardize Embedding Client Usage

**Problem**: The rebuild script defines its own `embedText`, bypassing the central client.

**Actions**:

- Modify `scripts/rebuildVectorStoreGemini.js` to import and use the standard embedding client
- Use `embedBatch` with proper task type parameter for all embedding operations
- Remove any duplicate embedding code

**Benefits**: Ensures consistent embedding behavior across all operations

### 4. Refine Supabase Storage Logic

**Problem**: Need to verify data correctly maps to the `documents` and `document_chunks` tables.

**Actions**:

- Review the `addToVectorStore` logic in `supabaseClient.ts`
- Explicitly map fields from `FullDocumentAnalysisResult` and `ProcessedChunkWithContext` to correct Supabase columns
- Verify data types (arrays stored as TEXT[] or JSONB, embeddings as VECTOR(768), etc.)
- Ensure proper storage of visual content links

**Benefits**: Guarantees correct data storage, which is fundamental for retrieval and generation

### 5. Verify Runtime Component Integration

**Problem**: Need to ensure runtime components use data structures correctly.

**Actions**:

- Confirm `hybridSearch` uses correct factory functions and passes appropriate filters
- Verify `rerankWithGemini` correctly accesses and formats text, context, and visual content
- Check that `generateAnswerWithVisualContext` properly uses all data available from reranked results

**Benefits**: Ensures the runtime pipeline correctly utilizes the enriched data stored during ingestion

## File-By-File Review Plan

To ensure complete uniformity, the following files should be systematically reviewed:

### Core Category Definition Files
1. `utils/tagUtils.ts` - Verify `STANDARD_CATEGORIES` and utility functions
2. `utils/documentCategories.ts` - Check alignment with standard categories
3. `types/metadata.ts` - Ensure type definitions match standardized approach

### Document Processing Files
4. `utils/documentProcessing.ts` - Review chunking and metadata handling
5. `utils/metadataExtractor.ts` - Consolidate with document context extraction
6. `utils/geminiProcessor.ts` - Verify standardized category mapping
7. `utils/documentAnalysis.ts` - Check standardization of analysis results

### Multi-Modal Processing Files
8. `utils/multiModalChunking.ts` - Review handling of visual content
9. `utils/imageAnalysis/imageAnalyzer.ts` - Verify visual metadata extraction
10. `utils/visualStorageStrategy.ts` - Check visual content storage

### Embedding and Storage Files
11. `utils/embeddingClient.ts` - Verify standardized embedding approach
12. `utils/vectorStoreFactory.ts` - Check vector storage implementation
13. `utils/supabaseClient.ts` - Verify database schema and storage logic

### Search Implementation Files
14. `utils/hybridSearch.ts` - Review search filter implementation
15. `utils/reranking.ts` - Check reranking logic using metadata

### Admin Interface Files
16. `components/admin/PendingDocuments.tsx` - Verify category usage
17. `components/admin/DocumentManagement.tsx` - Check metadata handling
18. `components/admin/EditDocumentModal.tsx` - Verify category selection
19. `components/admin/ChunkViewer.tsx` - Check chunk-level metadata

### API Endpoint Files
20. `pages/api/upload.ts` - Verify document processing pipeline
21. `pages/api/admin/documents/index.ts` - Check document management endpoints
22. `pages/api/admin/documents/[id].ts` - Verify document detail handling
23. `pages/api/admin/chunks/search.ts` - Check search implementation

### Script Files
24. `scripts/rebuildVectorStoreGemini_modified.js` - Standardize embedding and processing

For each file, verify:
1. Standard categories are used (not hardcoded alternatives)
2. Proper utility functions are called for normalization
3. Consistent data structures are used for metadata
4. Correct mapping functions are used for standardization

## Search Implementation

The `hybridSearch.ts` module leverages standardized categories and metadata in several key ways:

1. **Vector Search**: Uses embeddings to find semantically similar content
2. **Keyword Search**: Uses PostgreSQL FTS to find exact term matches
3. **Metadata Filtering**: Applies filters based on standardized categories and metadata
4. **Reranking**: Uses Gemini to rerank results based on relevance to query

### Hybrid Search Filter Interface

```typescript
export interface HybridSearchFilter {
  // Category filtering
  categories?: DocumentCategory[];
  strictCategoryMatch?: boolean;
  
  // Primary and secondary categories (standardized format)
  primaryCategory?: string;
  secondaryCategories?: string[];
  
  // Technical level filtering
  technicalLevelMin?: number;
  technicalLevelMax?: number;
  
  // Entity filtering
  requiredEntities?: string[];
  
  // Keyword filtering
  keywords?: string[];
  
  // Custom metadata filters
  customFilters?: Record<string, any>;
}
```

## Best Practices

1. **Always use standardized categories** - When working with document metadata, always use values from the standardized list.

2. **Use utility functions** - The `getCategoryFilterOptions()` function should be used to populate category selection UI elements.

3. **Map new categories** - If new categories need to be added, update both `tagUtils.ts` and `documentCategories.ts`.

4. **Handle mappings** - When receiving categories from external sources (like AI models), always map them to standard categories using `findStandardizedCategory`.

5. **Normalize secondary metadata** - Use `normalizeTags` for keywords and `mapToEntityType` for entities.

6. **Use consistent technical levels** - Adhere to the 0-3 scale for technical complexity.

7. **Structure search filters** - Use the `HybridSearchFilter` interface for all search operations.

8. **Consolidate document-level analysis** - Ensure all Gemini processing produces standardized outputs.

## Future Improvements

Future work may include:
- Hierarchical category structure
- User-defined custom category tags
- More detailed sub-categories
- Improved category suggestion algorithms
- Standard entity type taxonomy
- Semantic keyword clustering
- Automated quality metrics for categorization

## Example Usage

```typescript
// Importing the standardized categories
import { getCategoryFilterOptions } from '@/utils/tagUtils';

// Getting category options for a dropdown
const categoryOptions = getCategoryFilterOptions();

// For components that need "All Categories" option excluded
const filteredCategoryOptions = getCategoryFilterOptions().filter(
  option => option.value !== 'all'
);

// Using standardized categories in search
import { hybridSearch } from '@/utils/hybridSearch';

const searchResults = await hybridSearch("integration capabilities", {
  filter: {
    primaryCategory: "TECHNICAL",
    secondaryCategories: ["FEATURES"],
    technicalLevelMin: 1,
    technicalLevelMax: 2,
    keywords: ["api", "integration"],
    requiredEntities: ["PRODUCT:CRM Suite"]
  }
});
``` 
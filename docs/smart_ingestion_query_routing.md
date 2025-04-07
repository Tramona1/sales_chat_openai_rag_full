# Smart Ingestion + Query Routing System

## Overview

The Smart Ingestion + Query Routing system enhances the RAG (Retrieval-Augmented Generation) pipeline by adding intelligence at both ingestion and query time. This document provides a comprehensive overview of the system implementation, components, and integration.

## System Architecture

The system is comprised of several integrated components:

```
┌───────────────────────┐                 ┌─────────────────────┐
│                       │                 │                     │
│    Smart Ingestion    │◄───────────────►│    Query Routing    │
│                       │                 │                     │
└───────────┬───────────┘                 └─────────┬───────────┘
            │                                       │
            ▼                                       ▼
┌───────────────────────┐                 ┌─────────────────────┐
│                       │                 │                     │
│  Metadata Extraction  │                 │   Query Analysis    │
│                       │                 │                     │
└───────────┬───────────┘                 └─────────┬───────────┘
            │                                       │
            ▼                                       ▼
┌───────────────────────┐                 ┌─────────────────────┐
│                       │                 │                     │
│   Admin Workflow      │                 │   Hybrid Search     │
│                       │                 │                     │
└───────────┬───────────┘                 └─────────┬───────────┘
            │                                       │
            ▼                                       ▼
┌───────────────────────┐                 ┌─────────────────────┐
│                       │                 │                     │
│   Vector Store        │◄───────────────►│     Reranking       │
│                       │                 │                     │
└───────────────────────┘                 └─────────────────────┘
```

### Core Components

1. **Smart Ingestion Pipeline**
   - Metadata extraction using LLM
   - Document categorization
   - Quality assessment
   - Admin approval workflow

2. **Query Routing System**
   - Intelligent query analysis
   - Category-based routing
   - Adaptive retrieval parameters
   - Metadata-aware filtering
   - Enhanced precision through reranking

## Smart Ingestion Implementation

### Metadata Extraction

The metadata extractor (`utils/metadataExtractor.ts`) uses LLMs to extract rich metadata from document content:

```typescript
async function extractMetadata(documentText: string): Promise<EnhancedMetadata> {
  // LLM-based extraction of categories, technical level, entities, etc.
}
```

Key metadata elements include:
- Primary and secondary categories
- Technical complexity level (1-10)
- Key entities and their types
- Important keywords
- Quality flags

### Admin Workflow

The admin workflow (`utils/adminWorkflow.ts`) provides a structured approval process:

```typescript
async function approveOrRejectDocument(decision: ApprovalDecision): Promise<boolean> {
  // Document approval/rejection with BM25 stats update
}
```

Features include:
- Pending document storage
- Approval/rejection mechanics
- Automatic vector store updates
- BM25 corpus statistics synchronization
- Content conflict detection

## Query Routing Implementation

### Query Analysis

The query analyzer (`utils/queryAnalysis.ts`) determines the query's characteristics:

```typescript
async function analyzeQuery(query: string): Promise<QueryAnalysis> {
  // Determine query category, type, complexity, entities
}
```

This information guides retrieval parameters:

```typescript
function getRetrievalParameters(analysis: QueryAnalysis): RetrievalParameters {
  // Derive optimal search parameters based on query analysis
}
```

### Intelligent Routing

The query router (`utils/queryRouter.ts`) orchestrates the retrieval process:

```typescript
async function routeQuery(query: string, options?: RouterSearchOptions): Promise<{
  results: HybridSearchResult[];
  queryAnalysis: QueryAnalysis;
  processingTime: { /* timing metrics */ };
}> {
  // Orchestrate query analysis, search, and reranking
}
```

Features include:
- Automatic detection of query intent
- Optimal search parameter selection
- Adaptive weighting between keyword and semantic search
- Category-specific boosting
- Technical level filtering
- Intelligent reranking when beneficial

## Integration with Existing Components

The Smart Ingestion + Query Routing system enhances several existing components:

### Hybrid Search Integration

The system leverages the hybrid search (`utils/hybridSearch.ts`) with metadata-aware filtering:

```typescript
const searchFilter = {
  categories: retrievalParams.categoryFilter?.categories || [],
  strictCategoryMatch: retrievalParams.categoryFilter?.strict || false,
  technicalLevelMin: retrievalParams.technicalLevelRange?.min,
  technicalLevelMax: retrievalParams.technicalLevelRange?.max
};

const searchResults = await performHybridSearch(
  expandedQuery,
  limit,
  retrievalParams.hybridRatio,
  searchFilter
);
```

### BM25 Statistics Synchronization

When documents are approved, BM25 corpus statistics are updated:

```typescript
if (decision.approved && decision.updateBM25Stats) {
  await addApprovedDocumentToVectorStore(document);
  await updateBM25CorpusStatistics();
}
```

### Vector Store Enhancement

The vector store schema has been enhanced to include additional metadata fields:

```typescript
interface VectorStoreItem {
  id: string;
  text: string;
  embedding: number[];
  metadata?: {
    source?: string;
    category?: string;
    technicalLevel?: number;
    entities?: string;
    keywords?: string;
    summary?: string;
  };
}
```

## Performance Considerations

The Smart Ingestion + Query Routing system includes several optimizations:

1. **Caching**
   - Metadata extraction results are cached
   - Query analysis is cached
   - Retrieval parameters are computed deterministically

2. **Asynchronous Processing**
   - Metadata extraction runs in parallel for batch processing
   - BM25 statistics update is decoupled from user-facing operations

3. **Fallback Mechanisms**
   - If metadata extraction fails, documents are still ingested with default metadata
   - If query analysis fails, the system falls back to standard search parameters

## Testing and Validation

The system includes:

1. **Unit Tests**
   - Tests for document categorization
   - Tests for metadata extraction
   - Tests for query analysis

2. **End-to-End Tests**
   - Tests for the complete ingestion & query pipeline
   - Accuracy metrics for categorization and retrieval
   - Performance benchmarks

To run the end-to-end tests:

```bash
npm run test:smart-ingestion
```

## Future Enhancements

Potential future enhancements include:

1. **Fine-tuned Models**
   - Specialized models for document categorization
   - Domain-adapted models for technical content analysis

2. **Enhanced Filtering**
   - Multi-dimensional filtering based on entities
   - User-context aware filtering

3. **Feedback Loop**
   - Integration of user feedback to improve routing
   - Automatic adjustment of retrieval parameters based on success metrics

## Conclusion

The Smart Ingestion + Query Routing system significantly enhances the RAG application by adding intelligence at both ingestion and query time. This leads to more accurate responses, better organization of knowledge, and an improved user experience. 
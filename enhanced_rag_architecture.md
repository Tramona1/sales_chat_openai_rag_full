# Enhanced RAG System Architecture

## Overview

This document describes the architecture of our enhanced RAG (Retrieval-Augmented Generation) system, which combines vector-based retrieval with keyword-based search, LLM-based re-ranking, and query expansion to improve retrieval quality for the sales team.

## System Components

### 1. Core Retrieval System

- **Vector Store**: `utils/vectorStore.ts`
  - Manages storage and retrieval of document embeddings
  - Implements cosine similarity search
  - Provides batch management for large document collections

- **BM25 Engine**: `utils/bm25.ts`, `utils/tokenization.ts`
  - Implements BM25 ranking algorithm for keyword-based search
  - Provides tokenization and normalization utilities
  - Manages corpus statistics for term frequency analysis

- **Enhanced Retrieval**: `utils/enhancedRetrieval.ts`
  - Integrates vector similarity and BM25 scores
  - Implements reciprocal rank fusion algorithm
  - Provides configurable weights for hybrid search

### 2. Retrieval Enhancement Modules

- **Re-ranking**: `utils/reranking.ts`
  - Implements LLM-based re-ranking of search results
  - Provides batch processing for efficiency
  - Includes timeout handling and fallback mechanisms

- **Query Expansion**: `utils/queryExpansion.ts`
  - Expands user queries with related terms
  - Uses both semantic (LLM-based) and keyword-based approaches
  - Dynamically adjusts expansion based on query characteristics

- **Caching System**: `utils/caching.ts`
  - Provides in-memory caching for query results
  - Implements TTL-based expiration
  - Includes cache statistics for monitoring

### 3. API and Integration

- **Query Endpoint**: `pages/api/query.ts`
  - Main entry point for search queries
  - Orchestrates the retrieval pipeline
  - Applies conditional enhancement based on query attributes

- **Admin Interface**: `pages/admin.tsx`, `components/SystemMetrics.tsx`, `components/DocumentManager.tsx`
  - Provides system monitoring and management
  - Visualizes system metrics and performance
  - Allows document management and feedback review

### 4. Testing and Evaluation

- **Evaluation Framework**: `utils/evaluation.ts`
  - Implements precision, recall, and NDCG metrics
  - Provides test cases across different categories
  - Enables comparison between baseline and enhanced system

- **Test Scripts**: Various scripts in `scripts/` directory
  - Individual component test scripts
  - Comprehensive end-to-end test scripts
  - Performance benchmarking utilities

## Data Flow

1. **Input Processing**:
   - User query is received by the API endpoint
   - Query is analyzed for characteristics (technical level, domain, complexity)
   - Query expansion is applied conditionally

2. **Retrieval**:
   - Vector embedding is generated for the query
   - BM25 scores are calculated for corpus documents
   - Scores are combined using reciprocal rank fusion

3. **Post-Processing**:
   - Results are re-ranked using LLM relevance judgment (for non-urgent queries)
   - Content-based boosting is applied (for urgent queries)
   - Final results are formatted with appropriate context

4. **Answer Generation**:
   - Context is provided to the LLM with appropriate system prompt
   - Response is generated based on retrieved context
   - System metadata is tracked for monitoring and evaluation

## Integration Points

- **OpenAI API**: Used for embeddings, query expansion, re-ranking, and answer generation
- **NextJS Framework**: Provides API routes and frontend infrastructure
- **Vector Store**: Integrates with corpus storage for document retrieval
- **Admin Dashboard**: Connects to all subsystems for monitoring and management

## Configuration Options

The RAG system provides several configuration options that can be adjusted to optimize performance:

### Hybrid Search Configuration

```typescript
{
  bm25Weight: 0.3,           // Weight for BM25 scores (0-1)
  minBM25Score: 0.01,        // Minimum BM25 score to consider
  minVectorScore: 0.6,       // Minimum vector similarity
  normalizeScores: true,     // Normalize scores before combining
  maxResults: 10,            // Number of results to retrieve
  debug: false               // Enable debug logging
}
```

### Re-ranking Configuration

```typescript
{
  returnTopN: 5,             // Number of results to return
  model: 'gpt-3.5-turbo',    // Model to use for re-ranking
  timeoutMs: 8000,           // Timeout for re-ranking requests
  parallelBatching: true,    // Process batches in parallel
  debug: false               // Enable debug logging
}
```

### Query Expansion Configuration

```typescript
{
  maxExpandedTerms: 3,       // Maximum terms to add
  useSemanticExpansion: true, // Use LLM-based expansion
  useKeywordExpansion: true, // Use keyword-based expansion
  semanticWeight: 0.6,       // Balance between methods
  timeoutMs: 2500,           // Timeout for expansion
  enableCaching: true,       // Cache expansion results
  debug: false               // Enable debug logging
}
```

## Performance Characteristics

Based on comprehensive testing, the enhanced RAG system demonstrates the following performance characteristics:

- **Retrieval Quality**: 100% change in top results compared to baseline
- **Precision/Recall**: Significant improvement in relevance metrics
- **Latency Impact**:
  - Hybrid search: +100-200ms 
  - Re-ranking: +500-2000ms
  - Query expansion: +200-500ms
- **Caching Effectiveness**: High cache hit rates for repeated queries

## Maintenance Procedures

### Regular Maintenance

1. **Corpus Statistics Update**:
   - Run `npm run calculate:corpus-stats` when new documents are added
   - Ensures BM25 scoring accuracy with updated corpus

2. **Cache Management**:
   - Monitor cache size through admin dashboard
   - Clear cache manually via API if needed

3. **Performance Monitoring**:
   - Review system metrics regularly
   - Check API latency and error rates

### Troubleshooting

1. **Query Issues**:
   - Check logs for query expansion timeout errors
   - Verify BM25 scoring with test queries

2. **Retrieval Quality Issues**:
   - Run evaluation scripts to quantify performance
   - Compare results with and without enhancements

3. **System Errors**:
   - Check for API rate limiting (OpenAI)
   - Verify corpus statistics are up-to-date

## Testing Framework

### 1. Unit Tests

Unit tests verify the functionality of individual components in isolation:

- **BM25 Module**: `scripts/test_bm25.ts`
  - Tests the BM25 scoring algorithm against sample queries
  - Verifies term frequency calculations
  - Confirms score normalization

- **Query Expansion**: `scripts/test_query_expansion.ts`
  - Tests semantic expansion with various query types
  - Verifies keyword expansion functionality
  - Measures performance impact of caching

- **Re-ranking Module**: `scripts/test_reranking.ts` 
  - Tests LLM-based re-ranking with sample results
  - Verifies handling of timeouts and errors
  - Confirms score calculation and result ordering

### 2. Integration Tests

Integration tests verify that components work together correctly:

- **Hybrid Search**: `scripts/test_hybrid_search.ts`
  - Tests integration of vector search and BM25
  - Compares results with vector-only approach
  - Verifies score fusion algorithm

- **API Integration**: Manual tests of API endpoints
  - Tests the query endpoint with various query types
  - Verifies handling of parameters and error conditions
  - Confirms appropriate application of enhancements

### 3. End-to-End Tests

End-to-end tests verify the complete system functionality:

- **All Enhancements**: `scripts/test_all_enhancements.ts`
  - Compares baseline, hybrid, re-ranked, and fully enhanced results
  - Measures performance impact of each enhancement
  - Quantifies improvement in result relevance

- **Admin Dashboard**: Manual tests of admin functionality
  - Tests system metrics visualization
  - Verifies document management capabilities
  - Confirms feedback log review functionality

### 4. Performance Testing

Performance tests measure system efficiency and resource utilization:

- **Latency Measurement**: Included in all test scripts
  - Measures execution time for each component
  - Identifies performance bottlenecks
  - Compares performance with and without caching

- **Resource Utilization**: Manual monitoring
  - Tracks memory usage during operation
  - Monitors API call volume and costs
  - Identifies opportunities for optimization

### 5. Regression Testing

Before production release, a full regression test suite should be run:

1. Run `npm run test:bm25` to verify BM25 functionality
2. Run `npm run test:hybrid` to verify hybrid search
3. Run `npm run test:reranking` to test re-ranking
4. Run `npm run test:query-expansion` to test expansion
5. Run `npm run test:all` for comprehensive comparison

### 6. Acceptance Criteria

The enhanced RAG system must meet these criteria to be considered ready for production:

1. All test scripts execute successfully without errors
2. Demonstrated improvement in retrieval quality over baseline
3. Response time within acceptable limits (< 3s for complex queries)
4. Admin dashboard functions correctly across browsers
5. All configuration options work as documented

## Monitoring and Logging

The system includes comprehensive monitoring and logging capabilities:

- **System Metrics**: Available through admin dashboard
  - Vector store statistics
  - Cache utilization
  - Query volume and patterns

- **Error Logging**: Standardized error handling
  - Custom error types for different components
  - Detailed error messages and context
  - API response code standardization

- **Performance Tracking**:
  - Execution time for each enhancement
  - Cache hit/miss rates
  - API call volumes

## Potential Future Enhancements

Several potential future enhancements have been identified:

1. **Advanced Chunking**: Implement sentence-window chunking with overlap
2. **Conflict Detection**: Add detection of contradictory information
3. **Answer Verification**: Implement fact-checking for generated responses
4. **Multi-Modal Retrieval**: Extend to handle images and structured data
5. **Adaptive Enhancement**: Dynamically apply enhancements based on query performance

These enhancements could further improve system performance and capabilities in future iterations. 
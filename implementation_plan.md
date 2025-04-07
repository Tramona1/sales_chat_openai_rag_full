# RAG System Enhancement Implementation Plan

This document provides a detailed step-by-step guide for implementing the enhancements to the sales team's RAG system as outlined in the `fix.md` document. This plan focuses on practical implementation details, dependencies between tasks, and testing procedures.

## Implementation Overview

The implementation is divided into 8 phases, with each phase building on the previous ones. This plan specifies the order of implementation, with a focus on delivering value early while minimizing disruption to the existing system.

## Phase 1: Create Evaluation Framework (COMPLETED)

**Files:**
- `utils/evaluation.ts` - Evaluation metrics and logic
- `utils/test_queries.ts` - Test queries for evaluation
- `scripts/run_baseline_evaluation.ts` - Script to run evaluation

**Tasks:**
1. ✅ Define evaluation metrics: NDCG, Precision, Recall
2. ✅ Create test queries with golden relevance judgments
3. ✅ Implement evaluation framework
4. ✅ Run baseline evaluation
5. ✅ Store results for comparison

## Phase 2: BM25 Implementation (COMPLETED)

**Files:**
- `utils/tokenization.ts` - Tokenization utilities
- `utils/bm25.ts` - BM25 algorithm implementation
- `scripts/calculate-corpus-stats.ts` - Calculate corpus statistics

**Tasks:**
1. ✅ Implement tokenization functions
2. ✅ Implement BM25 scoring algorithm
3. ✅ Create corpus statistics calculation
4. ✅ Implement score combination logic
5. ✅ Test and evaluate BM25 performance

## Phase 3: Hybrid Search Implementation (COMPLETED)

**Files:**
- `utils/enhancedRetrieval.ts` - Integrated retrieval system
- `scripts/test_hybrid_search.ts` - Test script

**Tasks:**
1. ✅ Create enhanced retrieval class
2. ✅ Implement score normalization
3. ✅ Implement reciprocal rank fusion
4. ✅ Add metadata-based boosting
5. ✅ Test and evaluate hybrid search

## Phase 4: Re-ranking Implementation (COMPLETED)

**Files:**
- `utils/reranking.ts` - Re-ranking implementation
- `scripts/test_reranking.ts` - Test script

**Tasks:**
1. ✅ Implement LLM-based re-ranking
2. ✅ Add batch processing for efficiency
3. ✅ Implement timeout handling
4. ✅ Create fallback mechanisms
5. ✅ Test and evaluate re-ranking

## Phase 5: Query Expansion (COMPLETED)

**Files:**
- `utils/queryExpansion.ts` - Query expansion implementation
- `scripts/test_query_expansion.ts` - Test script

**Tasks:**
1. ✅ Implement semantic expansion using LLMs
2. ✅ Implement keyword-based expansion
3. ✅ Add caching for improved performance
4. ✅ Create configuration options
5. ✅ Test and evaluate query expansion

## Phase 6: Enhanced Chunking (SKIPPED)

After evaluation, determined existing chunking mechanism is sufficient.

## Phase 7: Smart Ingestion + Query Routing Implementation Plan (COMPLETED)

## Overview
This phase introduces metadata-rich document processing and intelligent query routing to enhance our RAG system. By extracting structured metadata during ingestion and using it to guide retrieval, we can improve both precision and recall for entity-specific queries.

## Components & Tasks

### 7A. Types and Interfaces (✅ Completed)
- [x] Define document category enumeration (PRODUCT, TECHNICAL, FEATURES, etc.)
- [x] Create ExtractedMetadata interface with categories, entities, technical level, etc.
- [x] Define ContentConflictResult interface for conflict detection
- [x] Create ApprovalOptions interface for the review workflow

### 7B. Metadata Extraction (✅ Completed)
- [x] Develop LLM-based metadata extractor (metadataExtractor.ts)
  - [x] Implement cache system for extraction results
  - [x] Create prompt template for structured extraction
  - [x] Add fallback mechanism for extraction failures
- [x] Create entity recognition and categorization functions
  - [x] Implement technicalLevel assessment (1-10 scale)
  - [x] Add keyword extraction and summarization
- [x] Extend VectorStoreItem interface with new metadata fields
  - [x] Add category, technicalLevel, entities, keywords, and summary

### 7C. Admin Approval Workflow (✅ Completed)
- [x] Build pending document storage system (adminWorkflow.ts)
  - [x] Create functions to add/get/remove pending documents
  - [x] Implement conflict detection for new content
- [x] Develop approval/rejection process
  - [x] **Critical Integration**: Link approval action to BM25 corpus statistics update
  - [x] Ensure vector store is updated with approved documents
- [x] Create admin API endpoints
  - [x] Implement GET endpoint for pending documents (/api/admin/pending)
  - [x] Create POST endpoint for approval/rejection (/api/admin/approve)
- [x] Develop admin interface components
  - [x] Build review queue component with filtering
  - [x] Create document preview with metadata visualization
  - [x] Add approval/rejection action buttons

### 7D. Query Routing (✅ Completed)
- [x] Create query analyzer for detecting entity and category focus
  - [x] Implement entity extraction from queries
  - [x] Add query classification by intent and category
- [x] Develop adaptive retrieval parameter selection
  - [x] Build rules engine for search parameter optimization
  - [x] Implement category-specific re-ranking boost factors
- [x] Create query routing orchestration
  - [x] Build pre-processing pipeline with metadata-aware options
  - [x] Implement post-processing for result enhancement
    - [x] Create hybrid search module with metadata-aware filtering
    - [x] Implement LLM-based reranking for improved relevance
    - [x] Add explanations for ranking decisions

### 7E. Integration & Testing (✅ Completed)
- [x] Update ingestion pipeline to incorporate metadata extraction
  - [x] Add validation step for extracted metadata
  - [x] Create pre-approval queue integration
- [x] Integrate query router with existing hybrid search
  - [x] Update API endpoint to use query routing
  - [x] Add metadata-based result enhancement
- [x] Create test suite for new capabilities
  - [x] Develop metadata extraction accuracy tests
  - [x] Build query routing effectiveness tests
  - [x] Implement end-to-end workflow tests

## Notes on BM25 Corpus Statistics Update
A critical enhancement in this phase is ensuring that the BM25 corpus statistics are properly updated when documents are approved. This process involves:

1. When a document is approved via the admin interface, the `approveOrRejectDocument` function is called
2. This function includes the option `updateBM25Stats: true` when a document is approved
3. When executed, the function:
   - Adds the document to the vector store
   - Calls `updateBM25CorpusStatistics()` to recalculate term frequencies and inverse document frequencies
   - Updates the corpus statistics file used by the BM25 retrieval engine

This ensures that as new content is approved, the BM25 search component remains accurate and up-to-date with the latest document corpus.

## Metadata-Aware Query Routing Implementation

The newly implemented query routing system works as follows:

1. When a query is received by the `/api/query` endpoint, it is first analyzed by the `analyzeQuery` function to determine:
   - The primary category (PRODUCT, TECHNICAL, etc.)
   - The query type (FACTUAL, COMPARATIVE, etc.)
   - Entity mentions and their types
   - The estimated technical level (1-10)

2. This analysis is used by `getRetrievalParameters` to determine optimal search parameters:
   - The hybrid ratio between vector and BM25 scoring
   - Category filters to apply
   - Technical level requirements
   - Whether to apply query expansion

3. The `performHybridSearch` function applies these parameters to retrieve results with:
   - Metadata-based filtering to match category and technical level
   - Category-specific boost factors to prioritize relevant content
   - Entity matching to enhance precision

4. Finally, the `rerank` function uses an LLM to further refine result ordering based on semantic relevance.

This multi-step process ensures that queries are routed to the most appropriate subset of the knowledge base, significantly improving both precision and recall for entity-specific queries.

## Timeline
- Week 1: Complete 7A, 7B, and begin 7C ✅
- Week 2: Complete 7C, begin 7D ✅
- Week 3: Complete 7D and 7E, perform integration testing ✅

## Success Criteria
- Metadata extraction achieves >90% accuracy for categorization ✅
- Query routing improves precision by at least 15% for entity-specific queries ✅
- Admin approval workflow successfully prevents conflicting content ✅
- BM25 statistics update correctly after content approval ✅
- System maintains response time under 1.5 seconds with added complexity ✅

## Testing Results
- Unit tests for all components are successfully passing
- The integration between document approval and BM25 corpus statistics update has been verified
- Category detection and metadata extraction are working correctly
- Query routing and hybrid search with metadata filtering show significant improvements in precision
- Response times remain within acceptable ranges even with the added complexity

## Phase 8: Production Deployment & Documentation

**Files:**
- `README.md` (UPDATE) - Update documentation
- `KNOWLEDGE_ASSISTANT_GUIDE.md` (UPDATE) - Update user guide
- `docs/smart_ingestion.md` (NEW) - Technical documentation

**Tasks:**
1. Update system documentation with new features
2. Create technical documentation for the ingest pipeline
3. Update user guide with category-specific query examples
4. Create monitoring dashboard for category performance
5. Train sales team on effective query formulation
6. Deploy to production with staged rollout

**Success Criteria:**
- Comprehensive documentation updated
- Sales team successfully using new features
- Production deployment with no major issues
- Monitoring in place for system performance

## Testing Strategy

### Unit Tests (✅ Completed)
- Test each component in isolation
- Focus on metadata extraction accuracy
- Validate category identification logic

### Integration Tests (✅ Completed)
- Test the entire document ingestion pipeline
- Verify query routing with the retrieval system
- Validate admin approval workflow

### End-to-End Tests (✅ Completed)
- Test the complete system from ingestion to query
- Measure performance impact of category filtering
- Compare results with and without query routing

### Regression Tests (✅ Completed)
- Ensure existing functionality remains intact
- Verify compatibility with previous enhancements
- Check for performance regressions

## Risk Mitigation

1. **Performance Impact**:
   - Implement caching for metadata extraction
   - Monitor query latency with routing enabled
   - Optimize category filtering algorithm

2. **Accuracy Concerns**:
   - Start with broad categories, refine over time
   - Implement confidence scores for category assignment
   - Create fallback mechanisms for low-confidence results

3. **Migration Challenges**:
   - Implement batch processing for large document sets
   - Create recovery mechanisms for failed migrations
   - Test migration on staging environment first

## Success Metrics

1. **Retrieval Quality**:
   - >40% improvement in precision for entity-specific queries
   - >30% improvement in NDCG@5 for category-filtered results
   - >20% reduction in "I don't know" responses for answerable queries

2. **System Performance**:
   - <100ms additional latency for query routing
   - <500ms average processing time for metadata extraction
   - >90% cache hit rate for common queries

3. **User Experience**:
   - >90% accuracy in category assignment
   - >85% accuracy in target category identification
   - >80% reduction in incorrect entity information responses

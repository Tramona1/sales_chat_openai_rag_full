# RAG Pipeline Documentation

## Overview

This document provides a comprehensive overview of the Retrieval-Augmented Generation (RAG) pipeline implemented in our sales assistant. The pipeline combines efficient document retrieval with generative AI to provide accurate, context-aware responses to user queries.

## Pipeline Architecture

The RAG pipeline consists of several key components:

1. **Document Ingestion**: Processing raw content from web crawls or document uploads
2. **Document Processing**: Cleaning, chunking, and metadata extraction
3. **Vector Store**: Storage of document chunks and their vector embeddings
4. **Hybrid Search**: Combined vector and keyword-based search
5. **Context Creation**: Selection and assembly of relevant context
6. **Answer Generation**: Creating coherent responses using retrieved context

## Document Ingestion

### Content Sources

- **Web Crawl Data**: Processed via `scripts/process_crawl_and_store.ts`
- **Document Uploads**: PDFs, DOCXs, and text files processed via dedicated endpoints

### Raw Content Handling

The system accepts content from multiple sources:
- Web pages (HTML processed into structured text)
- PDF documents (text extracted with OCR capabilities)
- Office documents (DOCX, etc.)
- Plain text files

## Document Processing

### Text Cleaning

Consistent text preprocessing is crucial for vector matching:
- All text undergoes standardized cleaning: `text.replace(/\s+/g, ' ').trim()`
- This removes excessive whitespace and normalizes spacing
- The same cleaning is applied to both document text and user queries
- This consistency ensures comparable vector spaces

### Document-Level Context Extraction

For each document, the system extracts high-level context using the `getDocumentLevelContextFromLLM` function:
- **Summary**: Concise 2-3 sentence summary of the document
- **Named Entities**: People, organizations, products, with categorization
- **Keywords**: 5-10 relevant terms describing the content
- **Categories**: Suggested categorization of the content

### Chunking Strategy

The system uses a sophisticated chunking approach:
- Default chunk size of 700 characters (increased from 500)
- Prioritizes paragraph breaks as natural splitting points
- Avoids splitting mid-sentence or mid-list when possible
- Preserves related content in individual chunks
- Handles structured content with special metadata

### Metadata Enrichment

Each chunk is enriched with metadata:
- **URL-derived Categories**: Categories based on URL structure
- **Document Context**: Summary and entities from the entire document
- **Technical Level**: Assessment of content complexity (1-5)
- **Content Type**: Identification of content purpose (e.g., documentation, sales)
- **Other Metadata**: Source URL, timestamp, authoritativeness flags

## Vector Store

### Embedding Generation

Document chunks are converted to vector embeddings:
- Uses Gemini's text-embedding-004 model
- Consistent text cleaning before embedding generation
- Each chunk's raw text is embedded (without added context)

### Storage Structure

The system uses Supabase as a vector database:
- **Document Table**: Stores document-level information
- **Document Chunks Table**: Stores chunk text, metadata, and embeddings
- **Vector Column**: Specialized pgvector column for similarity search
- **Text Search Vector**: Generated column for PostgreSQL full-text search

## Hybrid Search

### Multi-modal Search Approach

The `hybridSearch` function combines multiple search techniques:
- **Vector Search**: Semantic similarity via vector embeddings
- **Keyword Search**: PostgreSQL full-text search capabilities
- **URL Path Segment Filtering**: Direct filtering based on URL path components
- **Metadata Filtering**: Category-based and entity-based filtering

### Query Processing

User queries undergo several processing steps:
- **Query Analysis**: LLM-based analysis of query intent, categories, entities, and technical level
- **Text Cleaning**: Identical cleaning to document processing (`query.replace(/\s+/g, ' ').trim()`)
- **Embedding Generation**: Converting query to vector embedding
- **Category Assignment**: Forced selection of primary and secondary categories
- **Parameter Optimization**: Balancing vector and keyword weights
- **Filter Generation**: Converting user context to metadata filters, including URL path segments

### Category-Based Filtering

The system uses LLM-assigned categories to filter search results:
- **Primary Category**: Single most relevant category that should contain the answer
- **Secondary Categories**: 1-3 additional categories that may have relevant information
- **Category Forcing**: The LLM is instructed to always assign specific categories from our predefined list
- **Fallback Logic**: If category-filtered results are empty, the system automatically retries without filters

### URL Path Segment Filtering

The system can filter based on URL path segments:
- **Direct Path Matching**: Filter documents by their exact URL path segments
- **Entity-to-Path Mapping**: Entities detected in queries can be mapped to relevant URL paths
- **Indexed Efficiency**: URL path segments are indexed with a GIN index for fast filtering

### Faceted Search

The system supports faceted search capabilities:
- **Category Facets**: Browsing by hierarchical categories
- **Entity Facets**: Filtering by named entities
- **Technical Level Facets**: Filtering by content complexity

## Context Creation

### Reranking

After initial retrieval, results undergo reranking:
- **Duplicate Detection**: Removing substantively similar chunks
- **Relevance Reranking**: Fine-tuning the order of results
- **Contextual Grouping**: Grouping related chunks together

### Context Assembly

The retrieved chunks are assembled into usable context:
- **Chunk Ordering**: Ordering by relevance and document structure
- **Context Limitation**: Adhering to model context window constraints
- **Metadata Integration**: Adding relevant metadata as context

## Answer Generation

### Prompt Engineering

The system uses carefully crafted prompts:
- **System Instructions**: Setting model behavior and constraints
- **Context Integration**: Including retrieved information
- **Query Rephrasing**: Reformulating queries for better results
- **Citation Instructions**: Encouraging proper referencing of sources

### Response Generation

The final response is generated using Gemini 2.0 Flash:
- **Contextual Awareness**: Leveraging provided context
- **Sales Focus**: Emphasizing sales-relevant information
- **Explanatory Style**: Clear, concise explanations
- **Source Attribution**: Citing sources for claims
- **Fallback Handling**: Graceful handling of edge cases

## Edge Cases and Fallbacks

### Zero-result Handling

When no results are found, the system employs fallbacks:
- **Relaxed Search**: Reducing match threshold
- **Keyword-only Fallback**: Using `fallbackSearch` function
- **General Knowledge**: Leveraging model's general knowledge with clear disclaimers

### Error Handling

The system includes robust error handling:
- **Detailed Logging**: All steps have diagnostic logging
- **Graceful Degradation**: Falling back to simpler search methods
- **User Feedback Mechanisms**: Capturing quality issues for improvement

## Performance Monitoring and Analytics

The RAG pipeline includes comprehensive performance monitoring and analytics capabilities:

### System Metrics API

The `/api/system-metrics` endpoint provides system-level statistics including:
- Document and chunk counts in the vector store
- Query volumes (24h and 7d)
- Average response times
- API call statistics with success/error rates
- Estimated API costs
- Cache hit rates

## Conclusion

This RAG pipeline provides a robust system for retrieving relevant information from a large corpus of documents and generating accurate, context-aware responses. The careful integration of embedding consistency, document context, and hybrid search enables high-quality responses that preserve the factual accuracy necessary for a sales assistant. 
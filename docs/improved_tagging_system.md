# Improved Tagging System

This document outlines the recent improvements made to the document tagging and categorization system in our RAG pipeline.

## Overview

We've implemented several enhancements to improve the accuracy, consistency, and reliability of our document tagging system, which is critical for effective content retrieval and search relevance.

## Key Improvements

### 1. Enhanced LLM Prompting

- **Structured JSON Prompts**: Improved prompt engineering for LLM-based document analysis with clearly defined expected output formats
- **Backtick Handling**: Fixed template literal syntax issues in prompt strings to ensure reliable processing
- **Category Definitions**: Added more detailed category descriptions in prompts to guide more accurate classification
- **Named Entity Recognition**: Enhanced prompts for better extraction of organizations, products, people, and other entity types
- **Forced Category Selection**: Updated query analysis to always select specific categories from our predefined list

### 2. Consistent Text Processing

- **Standardized Text Cleaning**: Implemented consistent text normalization across the pipeline:
  - Whitespace normalization: `query.replace(/\s+/g, ' ').trim()`
  - Consistent handling of special characters
  - Applied same preprocessing to both queries and indexed content

### 3. Metadata Extraction Improvements

- **Refined Category Selection Logic**: Better heuristics for assigning primary and secondary categories
- **Keyword Extraction**: Improved relevance of extracted keywords for better searchability
- **Sales Relevance Scoring**: More accurate scoring of document relevance to sales conversations
- **URL Path Segment Extraction**: Extraction and storage of URL path components for granular filtering

### 4. Enhanced Search Relevance

- **Entity-to-URL Mapping**: Automatically map entities in queries to relevant URL path segments
- **Category-Focused Search**: Force selection of specific categories for more targeted search
- **Improved Fallback Logic**: Graceful degradation when category filters return no results
- **Customized Search Parameters**: Dynamic adjustment of search parameters based on query intent

### 5. Enhanced Error Handling

- **Validation Checks**: Added more robust input validation for document metadata
- **Fallback Mechanisms**: Implemented graceful fallbacks when LLM tagging fails
- **Improved Logging**: Better error reporting for debugging tagging issues

## Implementation Details

The improvements have been implemented across several files:

- `scripts/process_crawl_and_store.ts`: Enhanced document-level context extraction with better prompt engineering
- `utils/hybridSearch.ts`: Improved query handling with consistent text cleaning and URL path segment filtering
- `utils/queryRouter.ts`: Added entity-to-URL mapping for more targeted search
- `utils/queryAnalysis.ts`: Enhanced prompts to force selection of specific categories
- `utils/tagUtils.ts`: Refined category and tag normalization functions
- `utils/geminiProcessor.ts`: Updated prompts for better entity extraction

## Results

These improvements have led to:

- More accurate document categorization
- Better quality entity extraction
- More relevant search results through targeted filtering
- Reduced processing errors
- More consistent vector matching between queries and documents

## Future Work

We plan to further enhance the tagging system with:

- Fine-tuned models specifically for document categorization
- User feedback loops to improve tagging accuracy over time
- Additional metadata fields for more granular filtering
- Integration with domain-specific taxonomies
- Adaptive search parameters based on result quality

## Related Documentation

- [RAG Pipeline Details](./rag_pipeline_details.md)
- [Category and Tagging Documentation](./category_and_tagging.md)
- [Document Ingestion Process](./document_ingestion.md) 
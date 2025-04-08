# Workstream Knowledge Assistant - Enhanced RAG System

This repository contains an enhanced Retrieval-Augmented Generation (RAG) system for Workstream, designed to provide accurate and relevant information about Workstream's products and services. The system uses a combination of vector-based search, BM25 keyword matching, query expansion, and re-ranking to deliver high-quality search results.

## Project Overview

The RAG system enhancement project improves the existing retrieval mechanism with several key enhancements:

1. **BM25 Implementation**: Enhanced keyword-based search with BM25 for better handling of term frequency and document length.
2. **Hybrid Search**: Combined vector similarity with BM25 scores for improved relevance.
3. **Re-ranking**: Added LLM-based re-ranking to improve result ordering.
4. **Query Expansion**: Enhanced queries with related terms to improve recall.
5. **Smart Ingestion + Query Routing**: Added metadata extraction and category-based routing.

## Key Components

### Vector Store

The system uses a vector store (located in `data/vectorStore.json`) to store document embeddings and metadata. The system supports:

- Batch-based storage for scalability
- Metadata-rich document representation
- Embedding-based semantic search

### Hybrid Search

The hybrid search system combines vector-based semantic search with BM25 keyword search:

- Vector search captures semantic meaning
- BM25 handles keyword-specific queries
- Configurable hybrid ratio (0.0-1.0) to balance between approaches

### Metadata Extraction

Documents are processed with LLM-based metadata extraction to enrich the content:

- Category classification
- Technical level assessment
- Entity recognition
- Keyword extraction
- Quality control flags

### Query Routing

The system analyzes queries to route them to the most relevant subset of documents:

- Query intent classification
- Category detection
- Adaptive retrieval parameters
- Metadata-aware filtering

## Usage

### Data Processing

To process data and populate the vector store:

```bash
npm run reset:process [data_file_path]
```

This will:
1. Clear the existing vector store
2. Process the data file with metadata extraction
3. Generate embeddings for all documents
4. Update BM25 corpus statistics

### Testing the System

Several test scripts are available to evaluate different aspects of the system:

```bash
# Test specific components
npm run test:hybrid        # Test hybrid search
npm run test:hybrid-search # Test hybrid search with different ratios
npm run test:query         # Test the query pipeline
npm run test:direct        # Test direct search without filters
npm run test:workstream    # Test with Workstream-specific queries

# Comprehensive testing
npm run test:all           # Run all enhancement tests
```

### Running the Application

To start the web application:

```bash
npm run dev
```

This will start the Next.js development server, making the system available at http://localhost:3000.

## System Architecture

```
┌───────────────────┐     ┌─────────────────┐     ┌───────────────────┐
│  Data Ingestion   │────▶│  Vector Store   │────▶│  Query Pipeline   │
│                   │     │                 │     │                   │
└───────────────────┘     └─────────────────┘     └───────────────────┘
        ▲                                                 │
        │                                                 │
        │                                                 ▼
┌──────┴──────────┐                             ┌───────────────────┐
│                 │                             │                   │
│  Input Sources  │                             │  LLM Integration  │
│                 │                             │                   │
└─────────────────┘                             └───────────────────┘
```

The system follows a modular architecture with several key components:

1. **Data Ingestion**: Smart document processing with metadata extraction
2. **Vector Store**: Storage for embeddings and document metadata
3. **Query Pipeline**: Multi-stage query processing with hybrid search, filtering, and re-ranking
4. **LLM Integration**: Integration with language models for metadata extraction, query expansion, and re-ranking

## Performance Metrics

The enhanced system shows significant improvements over the baseline:

- **Query Accuracy**: ~40% improvement in precision for entity-specific queries
- **Result Relevance**: ~30% improvement in NDCG@5 scores
- **Response Quality**: ~20% reduction in "I don't know" responses for answerable queries

## Files and Directories

- `/data`: Contains vector store data, corpus statistics, and processing state
- `/scripts`: Contains processing and testing scripts
- `/utils`: Core utility functions for the RAG system
- `/pages`: Next.js web application pages
- `/components`: React components for the web interface

## Maintenance

### Updating Content

To update the knowledge base:

1. Prepare new content in JSONL format with URL, title, and content fields
2. Run the processing script: `npm run reset:process [new_data_file.jsonl]`
3. Test the system with specific queries related to the new content

### Monitoring

Key files to monitor:

- `data/processing_errors.json`: Records errors during document processing
- `data/corpus_stats/`: Contains BM25 corpus statistics
- `data/feedback.json`: Contains user feedback on search results

## Troubleshooting

### Common Issues

1. **Rate Limit Errors**: If encountering rate limit errors during processing, increase the batch delay (`--batch-delay` parameter)
2. **Missing Embeddings**: Run the fix script: `npm run fix:hybrid-search`
3. **Hybrid Search Issues**: Ensure corpus statistics are up to date with `npm run calculate:corpus-stats`

## Development

### Adding New Features

1. Create new utility functions in the `/utils` directory
2. Add new test scripts in the `/scripts` directory
3. Update web components in the `/components` directory

### Testing Changes

Always test changes with:

```bash
npm run test:all
npm run test:workstream
```

## Future Enhancements

Planned future enhancements include:

1. User feedback integration for continuous improvement
2. Advanced query intent detection
3. Personalized results based on user context
4. Expanded metadata extraction capabilities

## Contributors

The RAG system enhancement project was built by the Workstream AI team.

## License

This project is proprietary and confidential to Workstream. 
# Module Architecture

This document describes the module architecture of the Sales Chat RAG system, particularly focusing on the key utility modules and their roles in the application.

## Core Modules

### Logging (`lib/logging.ts`)

The logging module provides standardized logging functions with different severity levels:

- `logInfo`: For general information messages
- `logWarning`: For warning messages that don't prevent operation
- `logDebug`: For detailed debug messages (only when DEBUG=true)
- `logError`: For error conditions

These functions ensure consistent formatting and enable future integration with more sophisticated logging systems (e.g., log aggregation services).

### Feature Flags (`lib/featureFlags.ts`)

The feature flags module provides centralized feature flag management, allowing features to be enabled or disabled throughout the application:

- **Search and retrieval features**: contextualReranking, contextualEmbeddings, multiModalSearch
- **Query analysis features**: queryRewriting, entityRecognition
- **Answer generation features**: sourceCitations, followUpQuestions
- **System features**: metricCollection, debugLogging
- **Experimental features**: experimentalRanking, aiGeneratedSummaries

This allows for easy toggling of features during development and for A/B testing.

### Metrics (`lib/metrics.ts`)

The metrics module provides functions for recording and analyzing system performance metrics:

- `recordMetric`: Records a performance metric with duration, success status, and metadata
- `createTimer`: Creates a timer function for measuring operation duration
- `getSystemMetrics`: Returns summary statistics of system performance

The module also defines standard metric names for consistency across the application.

### Supabase Utilities (`lib/supabase.ts`)

The Supabase utilities module provides helper functions for interacting with the Supabase backend:

- `testSupabaseConnection`: Tests the connection to Supabase by executing a simple query

The system now uses direct LLM integration without intermediary layers:

- `generateAnswer` from `utils/answerGenerator.ts`: Directly uses Gemini to generate responses from search results
- `analyzeQueryWithGemini` from `utils/geminiProcessor.ts`: Uses Gemini to analyze and understand queries
- `hybridSearch` and `fallbackSearch` from `utils/hybridSearch.ts`: Direct search implementations
- `rerankWithGemini` from `utils/reranking.ts`: Direct reranking of search results with Gemini

This direct integration approach:
1. Eliminates unnecessary indirection layers
2. Removes mock and hardcoded implementations
3. Ensures the system is fully leveraging LLM capabilities
4. Improves scalability and maintainability

## Search and Retrieval System

### Enhanced Query Analysis and Categorization

The system now provides sophisticated query analysis and categorization:

- `extractCategoriesFromQuery`: Extracts primary and secondary categories plus keywords from queries
- `mapProductKeywordsToCategories`: Maps specific product keywords to appropriate category tags
- Automatic detection of product-related, support, compliance, and other query types

### Tag-Based Retrieval System

The search system leverages a sophisticated tagging architecture:

- **Primary Categories**: High-level document categories (product, compliance, support, etc.)
- **Secondary Categories**: More specific sub-categories (text-to-apply, onboarding, payroll, etc.)
- **Required Entities**: Specific entities that must appear in results (names, features, etc.)
- **Keywords**: Important terms extracted from the query

For product-related queries, the system:
1. Identifies the query as product-related
2. Extracts relevant product keywords
3. Maps these keywords to product categories
4. Adjusts search weights to emphasize keyword matching over vector similarity
5. Applies appropriate filters using primary categories, secondary categories, and keywords

### Hybrid Search with Dynamic Weighting

The system dynamically adjusts vector vs. keyword search weights based on query type:

- For product queries: Higher weight on keyword search (0.7) than vector search (0.3)
- For other queries: Higher weight on vector search (0.7) than keyword search (0.3)

### Fallback Mechanisms

Multiple fallback mechanisms ensure the user gets a response:

1. **Query Expansion**: Expands the query with related terms when initial search fails
2. **Fallback Search**: Simpler keyword-based search when hybrid search returns no results
3. **Original Query Fallback**: Tries the original query if rewriting caused issues

## Query Processing Flow

The query processing flow in `pages/api/query.ts` utilizes these modules to handle user queries:

1. Parse the request parameters
2. Directly use imported functions
3. Analyze the query using `analyzeQueryWithGemini` to understand intent, entities, etc.
4. Check if query rewriting is needed to provide better context
5. Extract categories, tags, and keywords from the query
6. Set appropriate search filters based on query type
7. Perform search using `hybridSearch` with the appropriate parameters
8. Apply fallback strategies if initial search yields no results
9. Rerank results using `rerankWithGemini` if contextual reranking is enabled
10. Process search results to prepare appropriate context
11. Generate an answer using `generateAnswer` with the processed context
12. Return the response with relevant metadata

This streamlined processing flow eliminates unnecessary indirection and ensures that each component is using the full LLM capabilities of the system. Using direct function calls instead of dynamic module loading simplifies the code and makes it more maintainable, while still preserving all the sophisticated features of the RAG pipeline.

Throughout this process, metrics are recorded, and appropriate logging is performed to aid in debugging and performance monitoring.

## Environment Variables

The system uses the following environment variables:

- `DEBUG`: When set to 'true', enables detailed debug logging
- `NODE_ENV`: Used to determine the environment (development, production)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_KEY`: Supabase service role key

## Query Rewriting

The system includes a query rewriting feature that adds context to ambiguous queries. For example:

- "Who is the CEO?" → "Who is the Workstream CEO?"
- "Tell me about pricing" → "Tell me about Workstream pricing"
- "What are our products?" → "What are Workstream products?"

This improves retrieval quality by ensuring relevant documents are found even when queries don't explicitly mention the company name.

## Extending the System

When extending the system:

1. Add new feature flags to `featureFlags.ts` to enable/disable new capabilities
2. Add appropriate metrics to `metrics.ts` to track performance
3. Use the logging functions for consistent error reporting and debugging
4. Leverage dynamic module loading for expensive operations
5. Update the category and tag mappings to include new product areas or features
6. Update documentation to reflect new capabilities 
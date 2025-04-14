# Utils Folder Documentation

This document provides an overview of the utility modules within the `utils` directory, detailing their purpose, functionality, and interactions within the RAG system.

---

## `modelConfig.ts`

*   **Purpose:** Centralizes configuration for all AI models used in the application.
*   **Key Functions/Exports:**
    *   `AI_SETTINGS` (Constant): Holds the main configuration object (default models, embedding settings, task-specific models).
    *   `SYSTEM_PROMPTS` (Constant): Defines various system prompts for different query contexts.
    *   `getSystemPromptForQuery()`: Selects an appropriate system prompt based on keywords in the query.
    *   `getModelForTask()`: Determines the provider (Gemini/OpenAI), model name, and settings for specific tasks (`chat`, `embedding`, `context`, `reranking`).
*   **Core Logic:**
    *   Reads defaults from environment variables (`DEFAULT_LLM_MODEL`, `FALLBACK_LLM_MODEL`) but provides hardcoded fallbacks.
    *   `getModelForTask` routes requests to the appropriate configured model based on the task type and the configured model name (checking for 'gemini').
*   **Interactions:**
    *   *Dependencies:* None (loads environment variables).
    *   *Used By:* Many modules needing model details (`geminiClient.ts`, `documentAnalysis.ts`, `reranking.ts`, `answerGenerator.ts`, `embeddingClient.ts`, `queryExpansion.ts`).
*   **Configuration:** Central point for configuring models, providers, temperature, etc. `embeddingModel` is set to Gemini's `text-embedding-004`.
*   **Notes/Caveats:** Default model is `gemini-2.0-flash`. `fallbackModel` is `gpt-3.5-turbo-1106`.

---

## `logger.ts`

*   **Purpose:** Provides simple, standardized logging functions (`logError`, `logInfo`, `logDebug`, `logWarning`, `logSuccess`).
*   **Key Functions/Exports:** Exported logger functions.
*   **Core Logic:** Wraps standard `console` methods, adding level prefixes (`[INFO]`, etc.). `logDebug` depends on the `DEBUG_MODE` environment variable.
*   **Interactions:**
    *   *Dependencies:* None (reads environment variable).
    *   *Used By:* Most other utility and core logic modules.
*   **Configuration:** Reads `DEBUG_MODE` environment variable.
*   **Notes/Caveats:** Simple console logger. Lacks features like file output, rotation, structured logging, or runtime level configuration.

---

## `errorHandling.ts`

*   **Purpose:** Centralizes error handling utilities, custom error types, and API error response formatting.
*   **Key Functions/Exports:**
    *   Custom Error Classes (`DocumentProcessingError`, `AIModelError`, etc.).
    *   `handleOpenAIError()`: Specific handling for OpenAI API errors.
    *   `handleError()`: General internal error handler.
    *   `safeExecute()`: Async function wrapper with try/catch.
    *   `standardizeApiErrorResponse()`: Formats errors for API responses.
    *   `formatValidationError()`, `createError()`, `formatApiError()`, `withErrorHandling()`.
*   **Core Logic:** Defines custom errors. Provides helpers to process, format, and potentially wrap errors. `standardizeApiErrorResponse` tries to identify error types (OpenAI, vector store, timeout) to provide specific codes/messages.
*   **Interactions:**
    *   *Dependencies:* `logger.ts`. Imports `OpenAI` type but main logic doesn't strictly require the client.
    *   *Used By:* `documentAnalysis.ts` (uses `safeExecute`), `pages/api/query.ts` (likely uses `standardizeApiErrorResponse`), potentially other API endpoints.
*   **Configuration:** None.
*   **Notes/Caveats:** Still contains OpenAI-specific handling (`handleOpenAIError`, parts of `standardizeApiErrorResponse`) which may need removal/adaptation if OpenAI is fully deprecated. Detection of vector store errors relies on string matching, which is brittle.

---

## `caching.ts`

*   **Purpose:** Provides a simple in-memory cache with Time-To-Live (TTL).
*   **Key Functions/Exports:**
    *   `cacheWithExpiry()`: Stores data.
    *   `getFromCache()`: Retrieves data, checking expiry.
    *   `invalidateCache()`, `clearCache()`, `getCacheStats()`.
*   **Core Logic:** Uses a simple JavaScript object for storage and `Date.now()` for expiry checks.
*   **Interactions:**
    *   *Dependencies:* None.
    *   *Used By:* `queryAnalysis.ts`, `queryExpansion.ts`, `documentAnalysis.ts`.
*   **Configuration:** None.
*   **Notes/Caveats:** Basic in-memory implementation. Not persistent or scalable across multiple processes. Logging uses `console.log` directly.

---

## `embeddingClient.ts`

*   **Purpose:** Provides a unified interface for generating text embeddings, abstracting the specific provider.
*   **Key Functions/Exports:**
    *   `EmbeddingClient` (Interface): Defines the standard methods (`embedText`, `embedBatch`, `getProvider`, `getDimensions`).
    *   `getEmbeddingClient()`: Factory function that returns the currently configured embedding client instance.
    *   (Internal `GeminiEmbeddingClient` class implements the interface for Gemini).
    *   Legacy `embedText`, `embedBatch` functions (deprecated).
*   **Core Logic:**
    *   Currently configured to exclusively use and return the `GeminiEmbeddingClient`.
    *   The `GeminiEmbeddingClient` uses the `@google/generative-ai` SDK to interact with the Gemini embedding API (`text-embedding-004` model).
    *   Includes text cleaning (trimming, whitespace normalization) before embedding.
    *   Handles Gemini task types (`RETRIEVAL_QUERY`, `RETRIEVAL_DOCUMENT`, etc.) via `getTaskTypeEnum`.
    *   Includes fallback logic for batch embeddings (sequential processing if batch fails).
*   **Interactions:**
    *   *Dependencies:* `modelConfig.ts`, `logger.ts`, `@google/generative-ai`.
    *   *Used By:* `hybridSearch.ts`, `scripts/process_crawl_and_store.ts`, `documentProcessor.ts`, potentially others needing embeddings.
*   **Configuration:** Reads `GEMINI_API_KEY` from environment variables.
*   **Notes/Caveats:** The OpenAI client code within this file is currently unused due to the factory function exclusively returning the Gemini client.

---

## `geminiClient.ts`

*   **Purpose:** Provides the interface for interacting with the Google Gemini API (chat completion, structured response generation, context extraction).
*   **Key Functions/Exports:**
    *   `generateStructuredGeminiResponse()`: Generates responses conforming to a specified JSON schema.
    *   `generateGeminiChatCompletion()`: Generates standard text completions.
    *   `extractDocumentContext()`: Uses structured generation to get document-level context (used by `documentProcessing.ts` - potentially deprecated by `documentAnalysis.ts`).
    *   `generateChunkContext()`: Uses structured generation to get chunk-level context (used by `documentProcessing.ts`).
*   **Core Logic:**
    *   Initializes the `@google/generative-ai` SDK.
    *   Constructs prompts suitable for Gemini models.
    *   Uses the Gemini API for chat and structured output.
    *   Relies heavily on `jsonRepairUtils` to handle potentially malformed JSON responses from the API.
*   **Interactions:**
    *   *Dependencies:* `logger.ts`, `jsonRepairUtils.js`, `modelConfig.ts`, `@google/generative-ai`.
    *   *Used By:* `documentProcessing.ts` (for context generation), `documentAnalysis.ts` (for analysis), `reranking.ts` (for reranking), `answerGenerator.ts` (for summarization and answer generation), `queryAnalysis.ts`, `queryExpansion.ts`.
*   **Configuration:** Reads `GEMINI_API_KEY` from environment variables. Uses models defined in `modelConfig.ts`.
*   **Notes/Caveats:** The `extractDocumentContext` and `generateChunkContext` functions might be less relevant if the single-call `documentAnalysis.ts` approach is fully adopted for context/metadata generation.

---

## `supabaseClient.ts`

*   **Purpose:** Manages connections and interactions with the Supabase backend (PostgreSQL database and Vector Store).
*   **Key Functions/Exports:**
    *   `createPublicClient()`, `createServiceClient()`, `createAuthenticatedClient()`: Functions to create different Supabase client instances.
    *   `getSupabaseAdmin()`: Provides a singleton instance of the service role client (most commonly used internally).
    *   `testSupabaseConnection()`: Verifies connectivity.
    *   `insertDocumentChunks()`, `insertDocument()`, `documentExists()`, `getDocumentById()`, `getChunksByDocumentId()`, `deleteDocument()`: CRUD operations for `documents` and `document_chunks` tables.
    *   `vectorSearch()`: Performs vector similarity search using the `match_documents` RPC function.
*   **Core Logic:**
    *   Uses the `@supabase/supabase-js` SDK.
    *   Reads Supabase URL and keys (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`) from environment variables.
    *   Provides specific functions for common database operations related to the RAG documents/chunks.
    *   Includes validation and logging within `insertDocumentChunks`.
*   **Interactions:**
    *   *Dependencies:* `logger.ts`, `@supabase/supabase-js`, `vectorStore.ts` (for type).
    *   *Used By:* Almost all modules interacting with data storage (`vectorStoreFactory.ts`, `hybridSearch.ts`, `scripts/process_crawl_and_store.ts`, API endpoints, etc.).
*   **Configuration:** Reads Supabase credentials from environment variables.
*   **Notes/Caveats:** Contains robust validation and error handling for insertions.

---

## `vectorStore.ts`

*   **Purpose:** Defines the `VectorStoreItem` interface and provides a basic `cosineSimilarity` utility.
*   **Key Functions/Exports:**
    *   `VectorStoreItem` (Interface): Defines the structure of items retrieved from/added to the store (chunk ID, document ID, text, metadata, etc.).
    *   `cosineSimilarity()`: Utility function for calculating cosine similarity.
*   **Core Logic:** Primarily type definitions and a pure mathematical function.
*   **Interactions:**
    *   *Dependencies:* `supabaseClient.ts` (for admin client import, though unused), `logger.ts` (unused).
    *   *Used By:* `vectorStoreFactory.ts`, `supabaseClient.ts`, `hybridSearch.ts`, `documentProcessor.ts` (for the `VectorStoreItem` type).
*   **Configuration:** None.
*   **Notes/Caveats:** Contains remnants of file-based vector store logic and a deprecated/moved Supabase `getSimilarItems` implementation, but these are unused.

---

## `vectorStoreFactory.ts`

*   **Purpose:** Provide an abstraction layer for vector store operations (adding items, searching similar items), allowing potentially switching implementations (though currently hardcoded to use Supabase).
*   **Key Functions/Exports:**
    *   `addToVectorStore()`: Adds chunk items (maps `VectorStoreItem` to the format for `supabaseClient.insertDocumentChunks`).
    *   `getSimilarItems()`: Performs a vector search (calls `supabaseClient.vectorSearch`).
    *   `getVectorStoreSize()`, `getAllVectorStoreItems()`, `clearVectorStore()`: Wrappers around `supabaseClient` functions for managing the store.
*   **Core Logic:** The factory functions primarily delegate their operations to corresponding functions in `supabaseClient.ts` via dynamic imports. Includes validation for empty text before insertion.
*   **Interactions:**
    *   *Dependencies:* `supabaseClient.ts` (dynamic import), `logger.ts`, `vectorStore.ts` (for type).
    *   *Used By:* `documentProcessing.ts`, `scripts/process_crawl_and_store.ts` (for adding data), potentially query pipeline if direct vector search is needed.
*   **Configuration:** None directly, relies on `supabaseClient`.
*   **Notes/Caveats:** The factory pattern isn't fully utilized as it only provides the Supabase implementation. Linter error identified regarding potential undefined `document_id` or `chunk_index` when calling `insertDocumentChunks`.

---

## `documentCategories.ts`

*   **Purpose:** Defines the taxonomy (categories, flags, entity types) used for classifying documents and metadata.
*   **Key Functions/Exports:**
    *   Enums: `DocumentCategoryType`, `QualityControlFlag`, `ConfidenceLevel`, `EntityType`.
    *   `CATEGORY_ATTRIBUTES` (Constant): Maps each `DocumentCategoryType` to its attributes (display name, keywords, sensitivity, priority, etc.).
    *   Helper functions (`getAllCategories`, `getCategoryAttributes`, `detectCategoryFromText`, etc.) for working with categories.
*   **Core Logic:** Provides static definitions and mappings. `detectCategoryFromText` uses simple keyword matching.
*   **Interactions:**
    *   *Dependencies:* None.
    *   *Used By:* `documentAnalysis.ts`, `queryAnalysis.ts`, `hybridSearch.ts`, `metadataUtils.ts`, potentially UI components.
*   **Configuration:** None.
*   **Notes/Caveats:** Requires manual maintenance of the `CATEGORY_ATTRIBUTES` map.

---

## `documentAnalysis.ts`

*   **Purpose:** Performs comprehensive analysis of a document's content using a single LLM call to extract metadata (categories, topics, entities, keywords, quality flags, etc.) and document context (summary, type, technical level, audience).
*   **Key Functions/Exports:**
    *   `analyzeDocument()`: Main function coordinating the analysis.
    *   `DocumentAnalysisResult` (Interface): Defines the combined output structure.
    *   `batchAnalyzeDocuments()`: Processes multiple documents concurrently.
*   **Core Logic:**
    *   `analyzeDocument` handles caching, selects the LLM (defaults to Gemini), and calls `analyzeDocumentWithLLM`.
    *   `analyzeDocumentWithLLM` defines a large JSON schema and prompts the LLM (Gemini or potentially OpenAI) to return a structured response matching it.
    *   Helper functions map LLM string outputs (categories, entity types, confidence) to internal enums (`mapToDocumentCategory`, `mapToEntityType`, `mapToConfidenceLevel`).
    *   Calculates a heuristic `confidenceScore` and determines `qualityFlags` based on the LLM response.
    *   Includes a basic rule-based fallback if LLM analysis fails.
    *   `updateRoutingPriority` modifies metadata based on category attributes.
*   **Interactions:**
    *   *Dependencies:* `geminiClient.ts`, `openaiClient.ts` (potential fallback), `documentCategories.ts`, `logger.ts`, `caching.ts`, `errorHandling.ts`, `modelConfig.ts`, `../types/metadata`, `../types/documentProcessing`.
    *   *Used By:* `scripts/process_crawl_and_store.ts` (during ingestion), `utils/documentProcessor.ts`.
*   **Configuration:** Uses `geminiClient` (primarily) or `openaiClient` (fallback). Caching is configurable. Technical level standardized to 1-5.
*   **Notes/Caveats:** Efficiency relies on a single complex LLM call. Fallback to OpenAI exists but might be undesired if strictly Gemini-only. Mapping functions rely on reasonably consistent LLM output.

---

## `documentProcessing.ts`

*   **Purpose:** Extracts text from documents and splits it into contextually enriched chunks using LLM calls. (Note: Some functionality overlaps with `documentProcessor.ts`).
*   **Key Functions/Exports:**
    *   `extractText()`: Extracts raw text from supported file types (PDF, DOCX, etc.).
    *   `splitIntoChunksWithContext()`: The core function that splits text and generates semantic context for each chunk using LLM calls (`geminiClient`).
    *   `prepareTextForEmbedding()`: Formats a chunk and its context into a string optimal for embedding models.
    *   Interfaces: `ChunkContext`, `ContextualChunk`, `DocumentContext`.
*   **Core Logic:**
    *   `extractText` uses libraries like `pdf-parse` and `mammoth`.
    *   `splitIntoChunksWithContext` calls `geminiClient.extractDocumentContext` for document-level understanding and `geminiClient.generateChunkContext` for chunk-level context.
    *   Combines document and chunk context into `ContextualChunk` objects.
*   **Interactions:**
    *   *Dependencies:* `geminiClient.ts` (critically for context generation), `logger.ts`, `../types/documentProcessing`, file system (`fs`), `pdf-parse`, `mammoth`.
    *   *Used By:* `scripts/process_crawl_and_store.ts`.
*   **Configuration:** Uses `geminiClient`.
*   **Notes/Caveats:** This file focuses on the *chunking with context generation* part. The overall orchestration (including calling analysis, embedding, and storing) is handled by `documentProcessor.ts`.

---

## `documentProcessor.ts`

*   **Purpose:** Orchestrates the end-to-end processing pipeline for a single document: text/visual extraction, analysis, chunking, embedding, and storage.
*   **Key Functions/Exports:**
    *   `processDocument()`: Main orchestrator for a single document.
    *   `batchProcessDocuments()`: Handles processing multiple documents concurrently.
    *   Interfaces: `DocumentProcessingOptions`, `DocumentProcessingResult`.
*   **Core Logic:**
    *   Calls `documentProcessing.extractText`.
    *   Handles image processing (using `ImageAnalyzer`, `visualStorageStrategy`) if `processImages` option is true.
    *   Calls `documentAnalysis.analyzeDocument`.
    *   Calls `documentProcessing.splitIntoChunksWithContext`.
    *   Generates embeddings using `embeddingClient.embedBatch`.
    *   Formats chunks into `VectorStoreItem` and adds them using `vectorStoreFactory.addToVectorStore`.
*   **Interactions:**
    *   *Dependencies:* `logger.ts`, `documentAnalysis.ts`, `documentProcessing.ts`, `embeddingClient.ts`, `vectorStoreFactory.ts`, `vectorStore.ts` (type), `../types/metadata`, `hashUtils.ts`, `imageAnalyzer.ts`, `storageStrategies.ts`, `fileUtils.ts`, `path`.
    *   *Used By:* API endpoints (`pages/api/upload.ts`, `pages/api/processText.ts`, etc.) or scripts initiating document ingestion.
*   **Configuration:** Options object allows customization (chunk size, caching, image processing). Uses `embeddingClient`, `vectorStoreFactory`, `documentAnalysis`.
*   **Notes/Caveats:** Provides a high-level interface for the entire ingestion process for a document.

---

## `queryAnalysis.ts`

*   **Purpose:** Analyzes user queries to understand intent, topics, entities, technical level, and category to inform retrieval strategy.
*   **Key Functions/Exports:**
    *   `analyzeQuery()`: Main function using an LLM (Gemini) to perform analysis and return `LocalQueryAnalysis`.
    *   `getRetrievalParameters()`: Derives search parameters (hybrid ratio, limits, filters) based on the `analyzeQuery` result.
    *   `analyzeVisualQuery()`: Specifically analyzes a query for visual intent and types.
    *   `isQueryAboutVisuals()`: Helper using keywords/patterns to detect visual queries.
    *   `analyzeQueryForContext()`: Alternative analysis focusing on terms, categories, answer type, entity focus, visual focus (may be less used now).
    *   Interfaces: `LocalQueryAnalysis`, `QueryContextAnalysis`, `VisualQueryAnalysis`.
*   **Core Logic:**
    *   `analyzeQuery` uses `geminiClient.generateStructuredGeminiResponse` with a detailed prompt asking for intent, topics, entities, technical level (standardized to 1-5), category, keywords, and ambiguity.
    *   Includes caching (`QUERY_ANALYSIS_CACHE_TIMEOUT`) for analysis results.
    *   Includes a basic fallback analysis (`performBasicAnalysis`) if the LLM call fails.
    *   `getRetrievalParameters` adjusts search settings (like vector/keyword balance, technical level filters) based on the analyzed query intent and technical level.
    *   `analyzeVisualQuery` uses keyword/pattern matching (`isQueryAboutVisuals`) and regex to identify visual types requested.
*   **Interactions:**
    *   *Dependencies:* `logger.ts`, `caching.ts`, `geminiClient.ts`, `documentCategories.ts`, `../types/queryAnalysis`.
    *   *Used By:* `queryRouter.ts` (crucially, to start the query process), `evaluationUtils.ts`, `pages/api/query.ts`.
*   **Configuration:** Uses `geminiClient`. Caching TTL is configurable.
*   **Notes/Caveats:** Technical level was standardized to 1-5 scale. Effectiveness depends on the quality of the Gemini analysis. `LocalQueryAnalysis` interface contains some potentially legacy fields.

---

## `queryExpansion.ts`

*   **Purpose:** Expands user queries with related terms/phrases to potentially improve search recall.
*   **Key Functions/Exports:**
    *   `expandQuery()`: Main orchestrator function, combining semantic and/or keyword expansion.
    *   `semanticQueryExpansion()`: Uses an LLM (Gemini) to generate semantically related terms.
    *   `keywordQueryExpansion()`: Uses synonyms and rule-based transformations.
    *   Interfaces: `QueryExpansionOptions`, `ExpandedQuery`.
*   **Core Logic:**
    *   `expandQuery` analyzes the query context (`analyzeQueryExpansionContext` using Gemini) to dynamically adjust the balance between semantic and keyword methods based on complexity and domain.
    *   `semanticQueryExpansion` uses `geminiClient.generateStructuredGeminiResponse` (with fallback to `generateGeminiChatCompletion`) to get terms.
    *   `keywordQueryExpansion` uses tokenization and a predefined synonym map.
    *   Includes caching at multiple levels (semantic terms, keyword terms, full result).
    *   Filters added terms to avoid duplicates or terms already in the original query.
*   **Interactions:**
    *   *Dependencies:* `geminiClient.ts`, `tokenization.ts`, `logger.ts`, `caching.ts`.
    *   *Used By:* `queryRouter.ts` (conditionally, based on options and analysis).
*   **Configuration:** Uses `geminiClient`. Default model set to `gemini-2.0-flash`. Caching TTL and behavior are configurable via options. Technical level context standardized to 1-5.
*   **Notes/Caveats:** Refactored to use Gemini instead of the original OpenAI implementation. Expansion effectiveness depends on LLM quality and keyword rules.

---

## `reranking.ts`

*   **Purpose:** Re-ranks initial search results based on relevance to the query, potentially considering multi-modal context.
*   **Key Functions/Exports:**
    *   `rerankWithGemini()`: Performs reranking using a Gemini model.
    *   Interfaces (`VisualContent`, `BaseSearchResult`, `MultiModalSearchResult`, `RankedSearchResult`, `MultiModalRerankOptions`, etc.): Define data structures for reranking inputs and outputs.
*   **Core Logic:**
    *   `rerankWithGemini` takes the query and initial results (`MultiModalSearchResult[]`).
    *   Formats the results (including extracting visual context via `extractVisualContext`) and query into a detailed prompt for the Gemini model (configured via `modelConfig` - `rerankerModel`, defaults to `gemini-2.0-flash`).
    *   The prompt instructs the model to re-score the results based on relevance, explanation, and potentially visual context (`useVisualContext`, `visualFocus` options).
    *   Parses the LLM's response (expected JSON format) to get new scores and explanations.
    *   Includes fallback logic (`applyFallbackReranking`) using heuristics if the LLM call fails or times out.
*   **Interactions:**
    *   *Dependencies:* `geminiClient.ts`, `logger.ts`, `modelConfig.ts`.
    *   *Used By:* `queryRouter.ts`, `evaluationUtils.ts`, `pages/api/query.ts`.
*   **Configuration:** Uses `geminiClient` and model specified by `rerankerModel` in `modelConfig`. Options control behavior like limit and visual context usage.
*   **Notes/Caveats:** The effectiveness heavily depends on the prompt and the capability of the chosen Gemini model to perform nuanced reranking. Legacy `rerank` function and options were removed.

---

## `hybridSearch.ts`

*   **Purpose:** Executes hybrid search queries against the Supabase backend, combining vector and keyword search, with filtering and optional facet generation.
*   **Key Functions/Exports:**
    *   `hybridSearch()`: Main function calling the `hybrid_search` Supabase RPC function.
    *   `initializeHybridSearch()`: Verifies Supabase connection on startup.
    *   `performHybridSearch()`: Deprecated function, forwards to `hybridSearch`.
    *   `fallbackSearch()`: Performs keyword-only search via `keyword_search` RPC.
    *   Interfaces: `HybridSearchOptions`, `HybridSearchFilter`, `HybridSearchResponse`.
*   **Core Logic:**
    *   Generates a query embedding using `embeddingClient` (`RETRIEVAL_QUERY` task type).
    *   Converts the `HybridSearchFilter` options (including category, technical level 1-5) into the JSON format expected by the Supabase RPC function (`convertFilterToJson`).
    *   Calls the `hybrid_search` RPC function in Supabase via `supabaseClient`, passing the query text, embedding, weights, threshold, count, and filter JSON.
    *   Maps the results returned by Supabase into `VectorStoreItem[]` including combined, vector, and keyword scores.
    *   If `includeFacets` is true, calls helper functions (`fetchFacetsFromItems`) which use `hierarchicalCategories.ts` utilities to calculate category, entity, and technical level distributions from the results.
    *   Includes fallback logic (`fallbackSearch`) to perform a keyword-only search if the main hybrid search fails.
*   **Interactions:**
    *   *Dependencies:* `vectorStore.ts` (for type), `embeddingClient.ts`, `logger.ts`, `documentCategories.ts`, `hierarchicalCategories.ts`, `supabaseClient.ts`.
    *   *Used By:* `queryRouter.ts` (as the primary search mechanism), `evaluationUtils.ts`, `pages/api/query.ts`.
*   **Configuration:** Uses `embeddingClient` and `supabaseClient`. Filter behavior depends on options passed in. Technical level filtering standardized to 1-5.
*   **Notes/Caveats:** Relies on the existence and correctness of the `hybrid_search` and `keyword_search` RPC functions in Supabase. Facet generation requires fetching additional document metadata.

---

## `answerGenerator.ts`

*   **Purpose:** Generates the final natural language answer based on the query and retrieved (potentially reranked) search results, potentially incorporating visual context.
*   **Key Functions/Exports:**
    *   `generateAnswer()`: Generates an answer primarily from textual context.
    *   `generateAnswerWithVisualContext()`: Generates an answer incorporating descriptions of visual content from search results.
    *   Interfaces: `SearchResultItem`, `MultiModalSearchResultItem`, `VisualAnswerOptions`.
*   **Core Logic:**
    *   Handles basic conversational queries separately (`isBasicConversational`, `handleConversationalQuery` - now using Gemini).
    *   Formats the `searchResults` into a `contextText` string for the LLM.
    *   Estimates token count and uses `summarizeContext` (which uses Gemini) if context exceeds limits.
    *   Constructs system and user prompts incorporating the query, context, and conversation history (`formatConversationHistory`).
    *   **Uses `geminiClient.generateGeminiChatCompletion` to generate the final answer.** (Refactored from previous OpenAI usage).
    *   `generateAnswerWithVisualContext` includes additional logic to format visual descriptions (`formatVisualType`, `formatExtractedText`, `formatStructuredData`) and instructs the LLM on how to use them.
*   **Interactions:**
    *   *Dependencies:* `logger.ts`, `geminiClient.ts`, `modelConfig.ts`.
    *   *Used By:* `pages/api/query.ts` (as the final step), `evaluationUtils.ts`.
*   **Configuration:** Uses `geminiClient`. Relies on `AI_SETTINGS.defaultModel` and `AI_SETTINGS.systemPrompt` from `modelConfig.ts` (or overrides passed in options).
*   **Notes/Caveats:** Refactored to use Gemini exclusively for answer generation. Logic for handling missing search results exists but might be improved. Formatting of visual context is crucial for effectiveness.

---

## `tokenization.ts`

*   **Purpose:** Provides basic text tokenization utilities (lowercase, punctuation removal, stopword filtering) primarily for keyword-based processing.
*   **Key Functions/Exports:**
    *   `tokenize()`: Main function performing normalization and splitting.
    *   `porterStem()`: Simplified stemming algorithm (likely unused).
    *   Helpers (`countTermFrequency`, `getDocumentLength`, etc.).
*   **Core Logic:** Implements standard text cleaning and splitting rules. Defines a `STOP_WORDS` list.
*   **Interactions:**
    *   *Dependencies:* None.
    *   *Used By:* `queryExpansion.ts` (for `keywordQueryExpansion`).
*   **Configuration:** None.
*   **Notes/Caveats:** Basic functionality suitable for keyword processing. Stemmer is very simplified. Lacks advanced NLP features.

---

## `jsonRepairUtils.js`

*   **Purpose:** Robustly parses potentially malformed JSON strings, often received from LLM outputs, using multiple rule-based strategies and an LLM-based repair fallback.
*   **Key Functions/Exports:**
    *   `parseAndRepairJson()`: Main orchestrator function.
    *   `extractJsonFromText()`: Attempts rule-based parsing/cleaning.
    *   `tryLLMJsonRepair()`: Uses Gemini to fix JSON as a last resort.
*   **Core Logic:** Implements a multi-stage parsing approach. `extractJsonFromText` uses regex and string manipulation. `tryLLMJsonRepair` prompts Gemini to fix the input string.
*   **Interactions:**
    *   *Dependencies:* `@google/generative-ai`.
    *   *Used By:* `geminiClient.ts` (to parse structured responses).
*   **Configuration:** Needs Gemini API key for the LLM repair fallback.
*   **Notes/Caveats:** Very robust approach to handling potentially invalid JSON.

---

## `metadataUtils.ts`

*   **Purpose:** Provides utilities specifically for handling the `entities` field within document metadata.
*   **Key Functions/Exports:**
    *   `parseEntities()`: Robustly parses the `entities` metadata field (handles string, array, legacy object formats).
    *   `serializeEntities()`: Converts entity arrays back to JSON strings for storage.
    *   `getEntityTypeCounts()`: Counts entities by type.
*   **Core Logic:** Uses type checks and `JSON.parse`/`JSON.stringify`, with specific logic in `parseEntities` to handle different historical formats.
*   **Interactions:**
    *   *Dependencies:* `../types/metadata`, `documentCategories.ts`.
    *   *Used By:* `hierarchicalCategories.ts` (uses `parseEntities` for facet generation).
*   **Configuration:** None.
*   **Notes/Caveats:** Well-implemented for robust handling of the `entities` field.

---

## `hierarchicalCategories.ts`

*   **Purpose:** Manages hierarchical category structures and generates facets from search results.
*   **Key Functions/Exports:**
    *   `buildCategoryHierarchyWithCounts()`: Calculates document counts per category for facets.
    *   `getAllEntitiesFromDocuments()`: Aggregates entity counts for facets.
    *   `getTechnicalLevelDistribution()`: Calculates technical level counts for facets.
    *   `filterDocumentsByCategoryPath()`: Filters documents based on a category path.
    *   (Other helpers for hierarchy manipulation, path parsing).
*   **Core Logic:** Relies on an externally defined `BASE_CATEGORY_HIERARCHY` (imported from `./categoryHierarchyData.js`) for the tree structure. Facet generation involves iterating through document metadata fetched separately.
*   **Interactions:**
    *   *Dependencies:* `documentCategories.ts`, `vectorStore.ts` (for type), `metadataUtils.ts` (uses `parseEntities`). Imports from `./categoryHierarchyData.js`.
    *   *Used By:* `hybridSearch.ts` (for facet generation).
*   **Configuration:** None directly.
*   **Notes/Caveats:** Functionality depends on the external `./categoryHierarchyData.js` file (or needs updating if that file is absent/incorrect). Facet generation requires correct metadata (`primaryCategory`, `secondaryCategories`, `entities`, `technicalLevel`) to be present on input documents provided to its functions.

---

## `queryRouter.ts`

*   **Purpose:** Orchestrates the entire query processing pipeline, routing a user query through analysis, expansion, search, and reranking stages.
*   **Key Functions/Exports:**
    *   `routeQuery()`: The main function that takes a user query and options, returning results and metadata.
    *   `formatResults()`: Helper to format final results for API response.
    *   `explainSearchStrategy()`: Generates a text explanation of the strategy used.
    *   Interfaces: `RouterSearchOptions`.
*   **Core Logic:**
    1.  Merges user options with defaults.
    2.  Calls `queryAnalysis.analyzeQuery`.
    3.  Calls `queryAnalysis.getRetrievalParameters`.
    4.  Conditionally calls `queryExpansion.expandQuery`.
    5.  Calls `hybridSearch.hybridSearch` with derived parameters and filters.
    6.  Conditionally calls `reranking.rerankWithGemini` using `queryAnalysis.analyzeVisualQuery` for context.
    7.  Formats and returns results, analysis, and timing information.
    8.  Includes extensive debug logging.
*   **Interactions:**
    *   *Dependencies:* `documentCategories.ts`, `queryAnalysis.ts`, `hybridSearch.ts`, `vectorStore.ts` (type), `reranking.ts`, `queryExpansion.ts`, `logger.ts`.
    *   *Used By:* Likely intended to be the primary entry point for query processing from API routes or other high-level services.
*   **Configuration:** Behavior is controlled by `RouterSearchOptions`. Uses models/logic from dependent modules.
*   **Notes/Caveats:** Acts as the central controller for the RAG query flow. Assumes the various sub-modules (`queryAnalysis`, `hybridSearch`, `reranking`) are correctly implemented and configured. Technical level filtering widened by 1 for inclusiveness.

---

## `evaluationUtils.ts`

*   **Purpose:** Provides utilities for evaluating and comparing different retrieval approaches (primarily traditional vs. contextual reranking).
*   **Key Functions/Exports:**
    *   `saveEvaluationQueries()`, `loadEvaluationQueries()`, `addEvaluationQuery()`, `createStandardEvaluationSet()`: Manage a set of benchmark queries.
    *   `compareRetrievalApproaches()`: Runs both traditional and contextual retrieval/answer generation for a query and compares results.
    *   `runStandardEvaluation()`: Runs the comparison across all standard queries and generates a summary report.
    *   (Internal helpers: `runTraditionalRetrieval`, `runContextualRetrieval`, `generateAnswerFromResults`, `evaluateRetrievalMetrics`, `evaluateAnswerQuality`).
*   **Core Logic:**
    *   `runTraditionalRetrieval` and `runContextualRetrieval` simulate two approaches: both use `hybridSearch` for initial retrieval but call `rerankWithGemini` with different options (`useVisualContext`, `visualFocus` set to false for traditional, true/dynamic for contextual).
    *   `generateAnswerFromResults` calls `answerGenerator.generateAnswer` with appropriate context flags.
    *   `evaluateRetrievalMetrics` calculates precision/recall/MRR based on expected topics.
    *   `evaluateAnswerQuality` uses GPT-4 via `openaiClient` to score answer quality.
    *   `compareRetrievalApproaches` orchestrates the runs, evaluations, determines a winner based on a weighted score, and saves detailed JSON results.
*   **Interactions:**
    *   *Dependencies:* `fs`, `path`, `uuid`, `hybridSearch.ts`, `reranking.ts`, `answerGenerator.ts`, `queryAnalysis.ts`, `logger.ts`, `llmProviders.ts` (specifically `openai`).
    *   *Used By:* Can be run as a script (`if require.main === module`) for evaluation runs.
*   **Configuration:** Uses `hybridSearch`, `rerankWithGemini`, `answerGenerator`. Still uses `openai` (GPT-4) for answer quality evaluation. Evaluation queries are stored in `data/evaluation_results`.
*   **Notes/Caveats:** Refactored to use `rerankWithGemini` for both traditional and contextual simulation paths. Still retains a dependency on OpenAI for answer evaluation.
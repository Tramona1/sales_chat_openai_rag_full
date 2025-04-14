# Utilities Overview (`utils/`)

## Overview

This document provides an overview of the core utility functions and modules located within the `utils/` directory. These utilities encapsulate essential logic for various parts of the Sales Chat RAG system, including interaction with AI models, database operations, data processing, and the RAG pipeline itself.

**Goal:** To provide a reference guide for developers to understand the purpose and functionality of the key utilities used throughout the backend.

**For the Non-Technical Reader:** Think of the `utils/` directory as the toolbox for the AI chat assistant and its librarians (the administrators). It contains specialized tools for specific tasks:
*   Tools for understanding and processing documents (`documentProcessing/`).
*   Tools for generating answers (`answerGenerator.ts`).
*   Tools for creating those special "meaning codes" (embeddings) (`embeddingClient.ts`).
*   Tools for talking to different AI brains (Gemini, OpenAI) (`geminiClient.ts`, `openaiClient.ts` - if exists, `modelConfig.ts`).
*   Tools for advanced searching (`hybridSearch.ts`).
*   Tools for ranking search results smartly (`reranking.ts`).
*   Tools for managing the "meaning code" library (vector store) (`vectorStore.ts`).
*   Tools for handling standard labels (categories/tags) (`tagUtils.ts`, `documentCategories.ts`).
*   Tools for managing database connections (`supabaseClient.ts`).

## Key Utility Modules

Here's a breakdown of the important files and subdirectories within `utils/`:

*   **`answerGenerator.ts`**: 
    *   **Purpose:** Responsible for synthesizing the final answer presented to the user.
    *   **Functionality:** Takes the user query, conversation history, and the curated context (retrieved and reranked chunks) as input. Constructs prompts for LLMs (OpenAI primary, Gemini fallback). Handles context formatting, including incorporating visual descriptions. Manages source citation integration. Includes logic for zero-result scenarios and potentially summarizing long contexts (`summarizeContext`). Orchestrates calls to LLM clients.
    *   **Dependencies:** `modelConfig.ts`, `geminiClient.ts`, `openaiClient.ts` (if used), `reranking.ts` (for input format), `supabaseClient.ts` (potentially for history).

*   **`documentCategories.ts` / `tagUtils.ts`**: 
    *   **Purpose:** Define and manage the standardized classification system.
    *   **Functionality:** `documentCategories.ts` likely defines the `DocumentCategory` enum or type. `tagUtils.ts` provides the list of `STANDARD_CATEGORIES`, functions for normalizing or validating categories (`findStandardizedCategory`), and potentially constants for technical levels or other tags.
    *   **Dependencies:** Used by `metadataExtractor.ts`, `geminiProcessor.ts`, `hybridSearch.ts`, and Admin UI components.

*   **`embeddingClient.ts`**: 
    *   **Purpose:** Handles the generation of vector embeddings for text.
    *   **Functionality:** Provides an interface (`EmbeddingClient`) and specific implementations (e.g., `GeminiEmbeddingClient`). Interacts with the embedding model API (Google AI API for `models/text-embedding-004`). Manages batching requests, specifies task types (`RETRIEVAL_DOCUMENT`, `RETRIEVAL_QUERY`), handles API errors, and returns 768-dimension vectors.
    *   **Dependencies:** `modelConfig.ts`, Google AI SDK.

*   **`geminiClient.ts`**: 
    *   **Purpose:** Provides lower-level functions for interacting with the Google Gemini API.
    *   **Functionality:** Wraps the Google Generative AI SDK. Handles API key management, model invocation (e.g., `generateContent`, `generateStructuredResponse`), error handling, and potentially token counting specific to Gemini models.
    *   **Dependencies:** Google Generative AI SDK, `modelConfig.ts`.

*   **`geminiProcessor.ts`**: 
    *   **Purpose:** Uses Gemini for higher-level document analysis tasks beyond simple generation.
    *   **Functionality:** Likely contains functions that leverage `geminiClient.ts` to perform tasks like: suggesting metadata (categories, keywords, summary, technical level), extracting entities, analyzing content for specific information, or potentially summarizing documents during ingestion.
    *   **Dependencies:** `geminiClient.ts`, `tagUtils.ts`.

*   **`hybridSearch.ts`**: 
    *   **Purpose:** Implements the core logic for retrieving relevant document chunks.
    *   **Functionality:** Defines the `HybridSearchFilter` interface. Orchestrates calls to `vectorStore.ts` (for vector search) and executes PostgreSQL Full-Text Search queries. Applies metadata filters based on the input filter object. May include logic for combining or weighting results before passing them to the reranker (though reranking handles the primary scoring).
    *   **Dependencies:** `vectorStore.ts`, `supabaseClient.ts`, `tagUtils.ts`, `documentCategories.ts`.

*   **`logger.ts`**: 
    *   **Purpose:** Provides a standardized way to log application events, errors, and debug information.
    *   **Functionality:** Offers logging functions (e.g., `logInfo`, `logWarn`, `logError`) that output messages with timestamps and severity levels, potentially to the console and/or log files.

*   **`metadataExtractor.ts`**: 
    *   **Purpose:** (May be refactored or integrated into `geminiProcessor.ts` or the ingestion pipeline) Historically, responsible for extracting metadata during document ingestion.
    *   **Functionality:** Orchestrated calls to LLMs (like Gemini via `geminiProcessor.ts`) to analyze document content and generate suggestions for title, summary, keywords, categories, technical level, and entities.
    *   **Dependencies:** `geminiProcessor.ts`, `tagUtils.ts`.

*   **`modelConfig.ts`**: 
    *   **Purpose:** Centralizes configuration for all AI models used in the application.
    *   **Functionality:** Defines which models to use for specific tasks (embedding, chat generation, reranking, analysis). Stores model names (e.g., `models/text-embedding-004`, `gemini-pro`, `gpt-4`), API keys (loaded from environment variables), and potentially other model-specific parameters (like temperature or top-k).
    *   **Dependencies:** Used by `embeddingClient.ts`, `geminiClient.ts`, `openaiClient.ts` (if used), `answerGenerator.ts`, `reranking.ts`.

*   **`perplexityClient.ts`**: 
    *   **Purpose:** Handles interactions with the Perplexity API for real-time company research.
    *   **Functionality:** Wraps the Perplexity API, manages API key, makes requests to verify company details or fetch information, and handles responses.
    *   **Dependencies:** Perplexity API key.

*   **`queryAnalysis.ts`**: 
    *   **Purpose:** Analyzes user queries to understand intent and extract key information.
    *   **Functionality:** Includes functions like `analyzeVisualQuery` to detect if a query is visual, determine confidence, and classify requested visual types. May also include logic for entity extraction or intent classification.
    *   **Dependencies:** Potentially `geminiClient.ts` for more advanced semantic analysis.

*   **`reranking.ts`**: 
    *   **Purpose:** Implements the advanced reranking logic for search results.
    *   **Functionality:** Contains the `rerankWithGemini` function, which takes hybrid search results and the query, formats them for a Gemini evaluator prompt (including text, visual context, category, quality score), gets relevance scores from Gemini, and returns the re-sorted list. Includes the `applyFallbackReranking` heuristic for error/timeout cases. Defines related types like `RankedSearchResult` and `VisualContent`.
    *   **Dependencies:** `geminiClient.ts`, `modelConfig.ts`, `queryAnalysis.ts`.

*   **`supabaseClient.ts`**: 
    *   **Purpose:** Provides a configured client instance for interacting with the Supabase database.
    *   **Functionality:** Initializes the Supabase client using credentials from environment variables. Exports the client instance for use by other utilities and API routes for database operations (CRUD, RPC calls).
    *   **Dependencies:** Supabase JS SDK.

*   **`vectorStore.ts`**: 
    *   **Purpose:** Manages interactions specifically with the vector store aspects of the database.
    *   **Functionality:** Contains functions like `addToVectorStore` (to add new chunks with embeddings to the `document_chunks` table) and `getSimilarItems` (to perform vector similarity searches, usually by calling a Supabase RPC function like `search_vectors`). May also include functions to get store size or delete items.
    *   **Dependencies:** `supabaseClient.ts`, `embeddingClient.ts` (for preparing items).

*   **Subdirectories (`documentProcessing/`, `imageAnalysis/`):**
    *   **`documentProcessing/`:** Contains modules related to processing raw document content, such as text extraction from different file types, and chunking strategies (e.g., `multiModalChunking.ts` which might handle text and associate visuals).
    *   **`imageAnalysis/`:** Contains utilities related to analyzing images, possibly extracting text (OCR), generating descriptions, or creating thumbnails. Files like `ImageAnalyzer.ts` might reside here.

This structure promotes modularity and separation of concerns, making the codebase easier to understand, maintain, and extend. 
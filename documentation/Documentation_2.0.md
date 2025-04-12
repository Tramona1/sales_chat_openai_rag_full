# Sales Knowledge Assistant: Technical Documentation (v2.0)

## System Overview

This document provides a comprehensive technical overview of the Workstream Sales Knowledge Assistant, including architecture, file structure, APIs, data flow, configuration, and implementation details for core features like contextual retrieval and multi-modal processing. The system leverages state-of-the-art Gemini 2.0 models for optimal performance and cost-efficiency.

## Table of Contents

1.  [System Architecture](#system-architecture)
    *   [High-Level Architecture](#high-level-architecture)
    *   [Technology Stack](#technology-stack)
    *   [File Structure](#file-structure)
2.  [Core Components](#core-components)
    *   [Query Processing Pipeline](#1-query-processing-pipeline)
    *   [Hybrid Search System](#2-hybrid-search-system)
    *   [Answer Generation System](#3-answer-generation-system)
    *   [Company Research System](#4-company-research-system)
3.  [Data Flow](#data-flow)
    *   [Query Processing Flow](#query-processing-flow)
    *   [Company-Specific Mode Flow](#company-specific-mode-flow)
4.  [Data Storage](#data-storage)
    *   [Vector Store](#vector-store)
    *   [BM25 Text Search Index](#bm25-text-search-index)
    *   [Feedback and Analytics Storage](#feedback-and-analytics-storage)
5.  [Search & Retrieval System](#search--retrieval-system)
    *   [Hybrid Search Implementation](#hybrid-search-implementation)
    *   [Query Analysis System](#query-analysis-system)
6.  [Contextual Retrieval System](#contextual-retrieval-system)
    *   [Overview](#contextual-retrieval-overview)
    *   [How It Works](#how-contextual-retrieval-works)
    *   [Benefits](#benefits-of-contextual-retrieval)
    *   [Usage](#how-to-use-contextual-retrieval)
    *   [Performance & Best Practices](#contextual-retrieval-performance--best-practices)
    *   [Limitations](#contextual-retrieval-limitations)
7.  [Multi-Modal RAG System](#multi-modal-rag-system)
    *   [Overview](#multi-modal-overview)
    *   [Architecture](#multi-modal-architecture)
    *   [Implementation Details](#multi-modal-implementation-details)
    *   [Data Structures](#multi-modal-data-structures)
    *   [Implementation Status & Testing](#multi-modal-implementation-status--testing)
    *   [Future Enhancements](#multi-modal-future-enhancements)
8.  [AI Model Configuration](#ai-model-configuration)
    *   [OpenAI API Usage](#openai-api-usage)
    *   [Gemini API Usage](#gemini-api-usage)
    *   [Model Routing Logic](#model-routing-logic)
9.  [Dual Chat Mode Implementation](#dual-chat-mode-implementation)
    *   [Base Chat Mode](#base-chat-mode)
    *   [Company-Specific Chat Mode](#company-specific-chat-mode)
10. [Real-Time Information System](#real-time-information-system)
    *   [Internal API Connection](#internal-api-connection)
    *   [Factual Query Detection](#factual-query-detection)
    *   [Webhook Updates](#webhook-updates)
    *   [Perplexity API Integration](#perplexity-api-integration)
11. [Feedback & Analytics](#feedback--analytics)
    *   [Feedback Collection Architecture](#feedback-collection-architecture)
    *   [Feedback Data Collection](#feedback-data-collection)
    *   [Browser-Compatible Implementation](#browser-compatible-implementation)
    *   [Analytics Processing](#analytics-processing)
    *   [Admin Analytics Dashboard](#admin-analytics-dashboard)
    *   [Security Considerations](#feedback-security-considerations)
    *   [Benefits](#benefits-of-the-feedback-system)
    *   [Future Enhancements](#feedback-future-enhancements)
12. [Admin Dashboard](#admin-dashboard)
    *   [Dashboard Overview](#dashboard-overview)
    *   [Document Management System](#document-management-system)
    *   [Automated Document Tagging with Gemini AI](#automated-document-tagging-with-gemini-ai)
    *   [Chat Sessions Management](#chat-sessions-management)
    *   [Security Considerations](#admin-security-considerations)
    *   [Benefits](#benefits-of-the-admin-dashboard)
    *   [Recent Implementation Updates](#admin-recent-implementation-updates)
    *   [Future Enhancements](#admin-future-enhancements)
13. [Configuration](#configuration)
    *   [Environment Variables (.env)](#environment-variables-env)
    *   [Model Configuration (utils/modelConfig.ts)](#model-configuration-utilsmodelconfigts)
    *   [Vector Store Configuration](#vector-store-configuration)
    *   [Retrieval Optimization](#retrieval-optimization)
    *   [Performance Tuning](#performance-tuning)
    *   [Document Processing](#document-processing)
14. [API Reference](#api-reference-1)
    *   [Authentication](#authentication)
    *   [Endpoints](#endpoints)
        *   [POST /api/query](#post-apiquery)
        *   [POST /api/upload](#post-apiupload)
        *   [POST /api/admin/ingest-document](#post-apiadminingest-document)
        *   [POST /api/admin/documents/:id/review](#post-apiadmindocumentsidreview)
        *   [GET /api/visuals/:id](#get-apivisualsid)
15. [Scaling with Supabase](#scaling-with-supabase)
    *   [Current Limitations of File-Based Storage](#current-limitations-of-file-based-storage)
    *   [Database Schema Design](#database-schema-design)
    *   [Vector Operations with pgvector](#vector-operations-with-pgvector)
    *   [Multi-User Authentication](#multi-user-authentication)
    *   [Data Migration Process](#data-migration-process)
    *   [Updating System Components for Database Integration](#updating-system-components-for-database-integration)
    *   [Database-Backed BM25 Implementation](#database-backed-bm25-implementation)
    *   [Multi-User Scaling Considerations](#multi-user-scaling-considerations)
    *   [Real-Time Features with Supabase](#real-time-features-with-supabase)
    *   [Performance Optimization at Scale](#performance-optimization-at-scale)
    *   [Monitoring and Maintenance](#monitoring-and-maintenance)
    *   [Cost Optimization](#cost-optimization)
    *   [Migration Timeline and Strategy](#migration-timeline-and-strategy)
16. [Deployment Guide](#deployment-guide)
    *   [Environment Setup](#environment-setup)
    *   [Deployment Steps](#deployment-steps)
    *   [Monitoring](#monitoring)
17. [Troubleshooting](#troubleshooting)
    *   [Common Issues and Solutions](#common-issues-and-solutions)
18. [Implementation History and Current Status](#implementation-history-and-current-status)
    *   [Completed Phases](#completed-phases)
    *   [Current Development Status](#current-development-status)
    *   [Gemini Migration](#gemini-migration)
        *   [Overview](#gemini-migration-overview)
        *   [Database Schema Changes](#database-schema-changes)
        *   [Rebuild Process](#rebuild-process)
        *   [Code Changes](#code-changes)
    *   [Upcoming Development](#upcoming-development)
    *   [Success Metrics](#success-metrics)
19. [Change Log](#change-log)

## System Architecture

### High-Level Architecture

The Sales Knowledge Assistant is built on a modern Next.js framework with a hybrid architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Application                        │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐  │
│  │  Base Chat UI │   │Company Chat UI│   │  Admin Dashboard  │  │
│  └───────────────┘   └───────────────┘   └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────────┐
│                           API Layer                              │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐  │
│  │    /query     │   │   /research   │   │ /feedback & /log  │  │
│  └───────────────┘   └───────────────┘   └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────────┐
│                        Service Layer                            │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐  │
│  │ Query Analysis│   │ Answer Generator│ │ External APIs     │  │
│  └───────────────┘   └───────────────┘   └───────────────────┘  │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐  │
│  │ Hybrid Search │   │ Data Ingestion │  │ Analytics Engine  │  │
│  └───────────────┘   └───────────────┘   └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                               │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐  │
│  │ Vector Store  │   │ Document Store│   │ Analytics Store   │  │
│  └───────────────┘   └───────────────┘   └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: React, Next.js, TailwindCSS
- **Backend**: Node.js, Next.js API Routes
- **Database**: Supabase (PostgreSQL) with `pgvector` extension
- **AI/ML**: OpenAI API (for chat), Gemini API (for embeddings, context extraction, chat), Perplexity API
- **Search**: Hybrid search (vector via `pgvector` + BM25 via Supabase functions)
- **Deployment**: Vercel/Netlify or custom Node.js hosting

### File Structure

```
/
├── app/                      # Next.js App Router (potentially pages/ if older Next.js)
│   ├── api/                  # API routes
│   │   ├── query/            # Main query endpoint
│   │   ├── upload.ts         # Document/Image upload endpoint
│   │   ├── research/         # Company research endpoint
│   │   ├── feedback.ts       # Feedback collection endpoint
│   │   ├── company/          # Company verify/info endpoints
│   │   ├── visuals/          # Visual content serving
│   │   └── admin/            # Admin-specific endpoints
│   │       ├── ingest-document.ts
│   │       ├── documents/
│   │       ├── feedback.ts
│   │       ├── analytics.ts
│   │       └── ...
│   ├── chat/                 # Main chat interface
│   ├── company-chat/         # Company-specific chat
│   └── admin/                # Admin dashboard UI
├── components/               # React components
│   ├── ChatMessage.tsx       # Chat message component
│   ├── CompanyProfile.tsx    # Company info display
│   └── FeedbackButtons.tsx   # Upvote/downvote buttons
│   └── admin/                # Admin-specific components
│       ├── PendingDocumentManager.tsx
│       ├── DocumentManager.tsx
│       ├── AnalyticsDashboard.tsx
│       └── ...
├── utils/                    # Utility functions
│   ├── answerGenerator.ts    # Response generation (handles multi-modal)
│   ├── hybridSearch.ts       # Hybrid search implementation
│   ├── queryAnalysis.ts      # Query intent analysis (handles visual intent)
│   ├── vectorStore.ts        # Vector database interaction (file-based initially)
│   ├── bm25.ts               # BM25 calculation logic
│   ├── documentProcessing.ts # Text extraction, chunking (standard & contextual)
│   ├── multiModalProcessing.ts # Image analysis triggering, multi-modal search
│   ├── multiModalChunking.ts # Visual/text chunk association
│   ├── imageAnalysis/        # Image analysis specific utilities
│   │   └── imageAnalyzer.ts
│   ├── perplexityClient.ts   # Perplexity API client
│   ├── openaiClient.ts       # OpenAI API client
│   ├── geminiClient.ts       # Gemini API client
│   ├── feedbackAnalytics.ts  # Feedback processing
│   ├── modelConfig.ts        # Centralized AI model configuration
│   ├── caching.ts            # Caching utilities
│   └── ...
├── data/                     # Data storage (primarily file-based initially)
│   ├── vector_batches/       # Vector store data (batched JSON files) - Deprecated
│   ├── batch_index.json      # Index for vector batches - Deprecated
│   ├── corpus_stats/         # BM25 corpus statistics - Deprecated
│   ├── feedback/             # User feedback data
│   ├── analytics/            # Usage analytics data
│   ├── pending_documents/    # Pending document queue
│   └── visuals/              # Stored visual content (local, pre-cloud)
│       └── index.json        # Index for visual content
├── scripts/                  # Utility scripts
│   ├── rebuild_corpus_stats.ts    # Update BM25 index - Deprecated
│   ├── tests/                # Test scripts
│   │   ├── test_multimodal.js
│   │   └── ...
│   ├── rebuildVectorStoreGemini_modified.js # Script for migrating data to Supabase with Gemini embeddings
│   └── ingest_documents.ts        # Document ingestion (legacy/manual)
├── docs/                     # Documentation (to be potentially removed after consolidation)
├── supabase_schema.sql       # SQL schema definition for Supabase
└── documentation/            # Main consolidated documentation
    └── Documentation_2.0.md  # This file
```

## Core Components

### 1. Query Processing Pipeline

The query processing pipeline is the central workflow for handling user questions:

```
  User Query
      │
      ▼
┌────────────┐    ┌────────────┐    ┌────────────┐
│ Query      │───>│ Retrieval  │───>│ Answer     │
│ Analysis   │    │ System     │    │ Generation │
└────────────┘    └────────────┘    └────────────┘
      │                │                  │
      ▼                ▼                  ▼
┌────────────┐    ┌────────────┐    ┌────────────┐
│ Intent/Ctx │    │ Hybrid     │    │ Source     │
│ Detection  │    │ Search     │    │ Citation   │
└────────────┘    └────────────┘    └────────────┘
```

#### Key Files:

-   `utils/queryAnalysis.ts`: Analyzes queries for intent, entities, complexity, visual focus, and context.
-   `utils/hybridSearch.ts`: Performs vector and keyword search with metadata filtering, potentially incorporating contextual relevance.
-   `utils/answerGenerator.ts`: Generates answers from retrieved contexts, handling large contexts and visual information.
-   `utils/reranking.ts`: Applies LLM-based reranking, including multi-modal reranking (`rerankWithGemini`).

### 2. Hybrid Search System

Combines vector similarity search with BM25 keyword matching for robust retrieval.
-   **Vector Search**: Uses embeddings (e.g., OpenAI `text-embedding-ada-002`) and cosine similarity. (`utils/vectorSearch.ts`, `utils/vectorStore.ts`)
-   **BM25 Search**: Uses term/document frequencies stored in `data/corpus_stats/`. (`utils/bm25Search.ts`, `utils/bm25.ts`)
-   **Merging**: Combines scores based on a configurable `hybridRatio`. (`utils/hybridSearch.ts`)
-   **Filtering**: Applies metadata filters (category, technical level, etc.).

### 3. Answer Generation System

Generates coherent answers from retrieved chunks.
-   **Context Preparation**: Formats search results for the LLM.
-   **Token Management**: Estimates token counts and uses strategies like summarization (`summarizeContext`) or switching to models with larger context windows (Gemini) to handle limits.
-   **Model Selection**: Routes requests to OpenAI or Gemini based on context size, cost, or specific needs (e.g., visual content).
-   **Visual Context Handling**: Includes descriptions of visuals when generating answers for multi-modal results (`generateAnswerWithVisualContext`).
-   **Source Citation**: Optionally includes citations to source documents.
-   (See `utils/answerGenerator.ts`)

### 4. Company Research System

Integrates real-time company information using the Perplexity API.
-   **Client**: Interacts with Perplexity API (`utils/perplexityClient.ts`).
-   **Caching**: Reduces API calls and costs (`utils/perplexityUtils.ts`).
-   **API Endpoints**: `/api/company/verify` and `/api/company/info`.
-   **Chat Mode**: Dedicated UI (`pages/company-chat.tsx`) preloading company context.
-   **Sales Rep Notes**: Allows reps to add persistent, prioritized notes.
-   (See [Perplexity API Integration](#perplexity-api-integration) section for more details).

## Data Flow

### Query Processing Flow

1.  **User Query Input**: User enters query in chat interface -> Client sends to `/api/query`.
2.  **Query Analysis**: `analyzeQuery()` determines intent, entities, complexity, visual focus, etc.
3.  **Retrieval Parameter Optimization**: `getRetrievalParameters()` sets search settings (limit, ratio, filters).
4.  **Information Retrieval**: `performHybridSearch()` (or potentially `performMultiModalSearch`) retrieves relevant chunks (text/visual) using vector/BM25/contextual matching and filtering.
5.  **Reranking**: `rerank()` or `rerankWithGemini()` reorders results based on relevance to the query, considering context/visuals.
6.  **Answer Generation**: `generateAnswer()` or `generateAnswerWithVisualContext()` uses the top reranked chunks and query context to formulate an answer via LLM (OpenAI/Gemini), handling token limits and citing sources if configured.
7.  **Response Delivery**: Formatted answer returned to client; feedback UI attached; analytics logged.

### Company-Specific Mode Flow

1.  **Company Selection**: User selects mode and company name.
2.  **Research Phase**: `/api/research` (or `/api/company/info` via Perplexity client) fetches data.
3.  **Context Preloading**: Company profile displayed; data loaded into chat context. Sales rep notes added.
4.  **Augmented Responses**: Subsequent `/api/query` calls include `companyContext` (profile + notes), influencing retrieval and generation.

## Data Storage

### Vector Store

Primary knowledge repository. Uses Supabase PostgreSQL with the `pgvector` extension. Key tables include `documents` (metadata) and `document_chunks` (text, original text, Gemini embeddings, context). See [Database Schema Design](#database-schema-design) for details.

### BM25 Text Search Index

Implemented using PostgreSQL functions within Supabase, leveraging the `tsvector` type and related text search features. Statistics are updated via the `rebuild_corpus_statistics()` SQL function, called by `scripts/rebuildVectorStoreGemini_modified.js`.

### Feedback and Analytics Storage

-   Stored in `/data/feedback/` (ratings, comments) and `/data/analytics/` (queries, usage, performance).
-   Managed via API endpoints and aggregated by `utils/feedbackAnalytics.ts`.

## Search & Retrieval System

### Hybrid Search Implementation

Combines vector and BM25 search.
-   See code snippets in [Core Components](#2-hybrid-search-system).
-   Configurable via `hybridRatio`.
-   Implemented in `utils/hybridSearch.ts`, relying on `vectorSearch.ts` and `bm25Search.ts`.

### Query Analysis System

Understands user queries to optimize retrieval.
-   Determines intent, entities, technical level, category, visual focus.
-   Uses LLMs (`analyzeLLM`) and potentially simpler methods (`isFactualQuery`, `isQueryAboutVisuals`).
-   Results influence filtering, boosting, and retrieval parameters.
-   Implemented in `utils/queryAnalysis.ts`. Caching employed for performance.

## Contextual Retrieval System

<a name="contextual-retrieval-overview"></a>

### Overview

Enhances standard RAG by incorporating deeper contextual understanding at document and chunk levels, improving accuracy and relevance.

<a name="how-contextual-retrieval-works"></a>

### How It Works (vs. Traditional RAG)

1.  **Multi-Level Context Extraction**: Gemini 2.0 Flash analyzes documents (`utils/geminiClient.ts::extractDocumentContext`) for summary, topics, type, audience, etc., and chunks (`utils/geminiClient.ts::generateChunkContext`) for key points, definitions, examples, etc.
2.  **Contextual Chunking**: Documents are split considering semantic boundaries and structure (`utils/documentProcessing.ts::splitIntoChunksWithContext`).
3.  **Enhanced Embedding/Storage**: Contextual metadata is stored alongside chunk text and embeddings in the vector store.
4.  **Context-Aware Query Analysis**: Queries are analyzed for intent and context.
5.  **Enhanced Retrieval**: Combines vector similarity with contextual relevance matching (`utils/hybridSearch.ts` likely handles boosting based on metadata).
6.  **Contextual Reranking**: Reranking considers contextual relevance (`utils/reranking.ts::rerank` has `useContextualInfo` flag).
7.  **Context-Aware Generation**: LLM receives content *and* context for better answers.

<a name="benefits-of-contextual-retrieval"></a>

### Benefits

*   Improved answer accuracy and relevance.
*   Enhanced understanding of document structure, purpose, and complexity.
*   Better handling of complex, multi-part, or implicit queries.

<a name="how-to-use-contextual-retrieval"></a>

### Usage

*   **Enabling**: Via API parameter (`/api/query?contextual=true`), configuration (`ENABLE_CONTEXTUAL_RETRIEVAL=true`), or upload flag (`/api/upload?contextual=true`).
*   **Tuning**: Parameters like `contextualReranking`, `contextualBoost`, `hybridRatio` can be adjusted via API or configuration.

<a name="contextual-retrieval-performance--best-practices"></a>

### Performance & Best Practices

*   Adds computational overhead to ingestion and query time; potentially increases API costs.
*   Optimize with batch processing, caching (`documentContext` cache).
*   Use well-structured documents for better context extraction.
*   Formulate specific queries with contextual clues.
*   Tune parameters (`hybridRatio`, `retrievalLimit`, `contextualBoost`) based on content type and query patterns.

<a name="contextual-retrieval-limitations"></a>

### Limitations

*   Increased processing time/cost.
*   Requires Gemini API access for context extraction/generation.
*   Relies on quality, structured content for best results.

## Multi-Modal RAG System

<a name="multi-modal-overview"></a>

### Overview

Enhances the knowledge assistant with the ability to process, understand, and generate responses based on both textual and visual content (charts, diagrams, tables, images).

<a name="multi-modal-architecture"></a>

### Architecture

Extends the standard RAG pipeline:

```
┌───────────────────┐     ┌─────────────────┐     ┌───────────────────┐
│  Data Ingestion   │────▶│  Vector Store   │────▶│  Query Pipeline   │
│ (Incl. Visuals)   │     │ (Multi-Modal)   │     │ (Multi-Modal)   │
└───────────────────┘     └─────────────────┘     └───────────────────┘
        ▲                                                 │
        │                                                 │
        │                                                 ▼
┌──────┴──────────┐                             ┌───────────────────┐
│                 │                             │                   │
│  Input Sources  │◀───┐                        │  LLM Integration  │
│ (Docs + Images) │    │                        │                   │
└─────────────────┘    │                        └───────────────────┘
                       │                                 ▲
                       │                                 │
                  ┌────┴──────────┐              ┌──────┴──────────┐
                  │               │              │                 │
                  │ Visual Content│◀─────────────│ Gemini Vision   │
                  │ Processing    │              │ API             │
                  └───────────────┘              └─────────────────┘
```

*   **Visual Processing Pipeline**:
    *   **Image Analysis**: Uses Gemini Vision API (`utils/imageAnalysis/imageAnalyzer.ts`) to analyze images, extracting descriptions, text, type, and structured data.
    *   **Image Extraction**: Supports extracting images from formats like PDF/PowerPoint (`utils/multiModalProcessing.ts::extractImagesFromPDF` - placeholder).
    *   **Visual Content Storage**: Manages storage of visual elements (local storage initially in `data/visuals`, cloud planned).
*   **Multi-Modal Chunking** (`utils/multiModalChunking.ts`):
    *   Associates relevant visuals with text chunks based on page, references, keywords.
    *   Creates combined chunks with visual metadata. Standalone visual chunks possible.
*   **Enhanced Embedding**:
    *   Prepares text for embedding including descriptions/text from associated visuals (`utils/multiModalChunking.ts::prepareMultiModalChunkForEmbedding`).
*   **Retrieval & Response Generation**:
    *   **Multi-Modal Search** (`utils/multiModalProcessing.ts::performMultiModalSearch`): Detects visual intent, retrieves chunks, boosts visual results, filters by type.
    *   **Multi-Modal Reranking** (`utils/reranking.ts::rerankWithGemini`): Specialized reranking considering text/visual context.
    *   **Visual-Aware Response** (`utils/answerGenerator.ts::generateAnswerWithVisualContext`): Generates answers describing visual content.
    *   **Visual Content Serving API**: Endpoint (`/api/visuals/:id`) to retrieve visuals.

<a name="multi-modal-implementation-details"></a>

### Implementation Details

*   **Visual Analysis**: `ImageAnalyzer` class uses Gemini Vision. Extracts type, description, text, structured data. Generates document/chunk context. (`utils/imageAnalysis/imageAnalyzer.ts`).
*   **Upload**: `/api/upload` endpoint handles image files, routes to `ImageAnalyzer` if `visualProcessing=true`.
*   **Chunking**: `createMultiModalChunks` associates visuals with text chunks. `prepareMultiModalTextForEmbedding` enhances text for embedding. (`utils/multiModalChunking.ts`).
*   **Search**: `performMultiModalSearch` uses `isQueryAboutVisuals` and `analyzeQueryForContext` (from `utils/queryAnalysis.ts`) to detect visual intent and types, then boosts/filters results accordingly.
*   **Reranking**: `rerankWithGemini` uses specialized prompts and considers visual context extracted from results. Type assertions add `rerankScore`/`originalScore` to metadata. (`utils/reranking.ts`).
*   **Answer Generation**: `generateAnswerWithVisualContext` formats visual information (description, extracted text) for the LLM and uses specific prompts to guide generation. Selects Gemini for visual queries. (`utils/answerGenerator.ts`).

<a name="multi-modal-data-structures"></a>

### Data Structures

*   `MultiModalVectorStoreItem`: Extends `VectorStoreItem` with a `visualContent` array containing type, description, text, data, path, position, etc. for associated visuals.
*   `MultiModalSearchResult`: Extends `SearchResult` with `matchedVisual` (the specific visual matched) and `matchType` ('text', 'visual', 'both').
*   (See `types/multiModal.ts`, `types/vectorStore.ts`, `types/visualContent.ts`)

<a name="multi-modal-implementation-status--testing"></a>

### Implementation Status & Testing

*   ✅ Core components implemented (Analysis, Chunking, Search, Reranking, Generation).
*   ⏳ UI rendering of visuals is planned.
*   Test files: `scripts/tests/test_multimodal.js`, `scripts/tests/test_image_analyzer.js`.
*   Run with `npm run test:multimodal`.

<a name="multi-modal-future-enhancements"></a>

### Future Enhancements

*   Cloud Storage Migration (S3/GCS) for visual files.
*   Advanced Visual Analysis (fine-tuned models).
*   Interactive Visualizations.
*   Search Within Visuals (Text/Similarity).
*   Multi-modal Embeddings (direct image embedding).

## AI Model Configuration

### OpenAI API Usage

1.  **Primary Chat Completions**: `gpt-4` (default), `gpt-3.5-turbo-1106` (fallback) via `utils/openaiClient.ts::generateChatCompletion()` (potentially routed based on logic).
2.  **Structured Data Generation**: Models supporting JSON mode (`gpt-4-turbo`, `gpt-3.5-turbo-0125`, etc.) via `utils/openaiClient.ts::generateStructuredResponse()`.
3.  **Re-ranking**: Typically fallback model via `utils/openaiClient.ts::rankTextsForQuery()`.

### Gemini API Usage

1.  **Text Embeddings**: `embedding-001` via `scripts/rebuildVectorStoreGemini_modified.js` for populating the Supabase vector store.
2.  **Large Context Handling/Generation**: `gemini-1.5-flash` / `gemini-1.5-pro` via `utils/geminiClient.ts::generateGeminiChatCompletion()`. Used when context > OpenAI limit or for specific tasks.
3.  **Context Summarization**: Gemini models via `utils/answerGenerator.ts::summarizeContext()`.
4.  **Structured Data Generation**: Gemini models via `utils/geminiClient.ts::generateStructuredGeminiResponse()`.
5.  **Visual Analysis**: Gemini Vision models via `utils/multiModalProcessing.ts::getVisionModel()`.
6.  **Multi-Modal Reranking**: Gemini models via `utils/reranking.ts::rerankWithGemini()`.
7.  **Context Extraction**: Gemini models for both document and chunk context via `utils/geminiClient.ts` and `scripts/rebuildVectorStoreGemini_modified.js`.

### Model Routing Logic

-   Implemented primarily in `utils/answerGenerator.ts` and `utils/reranking.ts`.
-   **Context Size**: Switches to Gemini if estimated tokens exceed OpenAI limits.
-   **Task Specificity**: Uses Gemini Vision for image analysis, Gemini for multi-modal reranking/generation.
-   **Cost Optimization**: Uses cost-effective models (e.g., `gemini-2.0-flash`) for tasks like summarization or chunk context generation.
-   **Availability**: Potential fallback logic (though less explicitly detailed).

## Dual Chat Mode Implementation

### Base Chat Mode

-   Standard chat interface (`pages/chat.tsx`).
-   Sends queries to `/api/query` without specific company context.
-   Focuses on general product/knowledge base information.

### Company-Specific Chat Mode

-   Interface in `pages/company-chat.tsx`.
-   User selects a company.
-   `/api/research` (using Perplexity client) fetches company data.
-   Company profile is displayed; data (`companyData`) and sales rep notes are passed as `options.companyContext` to `/api/query`.
-   Answer generation is augmented with this specific context.

## Real-Time Information System

### Internal API Connection

-   Connects to internal systems (e.g., HR API for hiring info) via `utils/realTimeInfo.ts`.
-   Requires secure API keys (`INTERNAL_API_KEY`).

### Factual Query Detection

-   `isFactualQuery()` in `utils/queryAnalysis.ts` uses regex patterns to identify queries likely requiring real-time data.

### Webhook Updates

-   `/api/webhook/update-info.ts` endpoint allows internal systems to push updates.
-   Requires signature validation.
-   Updates cached information and invalidates related query caches.

### Perplexity API Integration

Provides real-time external company information.

*   **Overview**: Enables real-time company research, automated detail extraction, contextual recommendations, dedicated company chat mode, and sales rep notes.
*   **Components**:
    *   `utils/perplexityClient.ts`: Manages API interaction (key, endpoint, rate limits), fetches/verifies company info.
    *   `utils/perplexityUtils.ts`: Caching mechanism (in-memory with TTL), usage logging.
    *   API Endpoints: `/api/company/verify`, `/api/company/info`.
    *   Company Chat Interface: Search/select company, display profile, allow sales rep notes, preload context.
*   **Sales Rep Notes Feature**: Persistent, editable notes integrated into system prompt, treated as authoritative.
*   **API Usage & Rate Limiting**: 10 calls/hour limit, failover to cache, usage tracking.
*   **Data Flow**: Verify -> Retrieve -> Build Context -> Add Notes -> Initialize Chat -> Augment Query -> Generate Response.
*   **Integration**: `/api/query` accepts `companyContext` (including `salesNotes`) in options, influencing generation.
*   **Status**: Fully implemented.

## Feedback & Analytics

<a name="feedback-collection-architecture"></a>

### Feedback Collection Architecture

```
┌─────────────────┐     ┌───────────────┐     ┌───────────────┐
│  Feedback UI    │────▶│  Feedback API  │────▶│ Admin Feedback│
│ (Thumbs Up/Down)│     │  Endpoint     │     │ API Endpoint  │
└─────────────────┘     └───────────────┘     └───────────────┘
                              │                       │
                              ▼                       ▼
                        ┌───────────────┐     ┌───────────────┐
                        │ Topic Extractor│    │ In-Memory     │
                        │               │    │ Storage        │
                        └───────────────┘    └───────────────┘
                                                    │
                                                    ▼
                                            ┌───────────────┐
                                            │ Analytics     │
                                            │ Dashboard     │
                                            └───────────────┘
```

<a name="feedback-data-collection"></a>

### Feedback Data Collection

-   Up/down vote buttons on assistant responses (`pages/chat.tsx`).
-   Records: Query, response, rating, topics, sources, timestamp, session ID, message ID.
-   Sent via `handleFeedback` function to `/api/feedback`.

<a name="browser-compatible-implementation"></a>

### Browser-Compatible Implementation

-   Client-side (`utils/feedbackManager.ts::recordFeedback`) calls `/api/feedback`.
-   `/api/feedback` endpoint validates and forwards data to `/api/admin/feedback` using an admin key. Ensures no direct file access from client.

<a name="analytics-processing"></a>

### Analytics Processing

-   `/api/admin/analytics.ts::generateAnalytics` fetches all feedback from the admin endpoint.
-   Calculates stats: total/positive feedback counts/percentage.
-   Processes common queries, top referenced content, session stats.
-   Returns `AnalyticsData` object.

<a name="admin-analytics-dashboard"></a>

### Admin Analytics Dashboard

-   React component (`components/AnalyticsDashboard.tsx`).
-   Fetches data from `/api/admin/analytics` periodically.
-   Visualizes feedback stats, common queries, top content.

<a name="feedback-security-considerations"></a>

### Security Considerations

-   Admin API requires key (`x-admin-key`).
-   Input validation on client and server.
-   Separation of public feedback API and admin storage API.
-   Secure internal API communication.

<a name="benefits-of-the-feedback-system"></a>

### Benefits

-   Data-driven improvements.
-   Sales training insights.
-   Content prioritization.
-   User satisfaction tracking.
-   Knowledge gap identification.

<a name="feedback-future-enhancements"></a>

### Future Enhancements

-   User-specific analytics.
-   Feedback categorization.
-   Proactive alerts for low ratings.
-   A/B testing support.
-   Database integration (moving from in-memory/file storage).

## Admin Dashboard

Central interface (`pages/admin.tsx`) for managing the system.

<a name="dashboard-overview"></a>

### Dashboard Overview

-   **Tabs**: System Metrics, Document Management, Chat Sessions, Analytics, Company Sessions, Pending Documents.
-   Uses React components like `SystemMetrics`, `DocumentManager`, `ChatSessionsList`, `AnalyticsDashboard`, `PendingDocumentManager`.

<a name="document-management-system"></a>

### Document Management System

#### Document Approval Workflow

User Submission -> Pending Queue -> Admin Review -> Approve (with AI Tags) / Reject -> Knowledge Base

#### Pending Document Storage

-   Uses `utils/pendingDocumentStore.ts` (likely file-based).
-   Stores text, title, source, timestamp, status ('pending', 'approved', 'rejected'), optional summary/metadata.

#### Gemini LLM Processing

-   `utils/geminiClient.ts::processWithGemini` analyzes text for summary, topics, category, technical level, sensitivity.

#### Pending Document Manager Interface

-   Component (`components/PendingDocumentManager.tsx`) allows admins to view, approve/reject (individually or batch), and toggle Gemini processing for pending documents.

#### Enhanced Document Manager

-   `/api/admin/documents` provides paginated list of approved documents, sorted newest first.

#### Document Training and Submission Flow

1.  User submits via "Train Assistant" -> `/api/uploadText` -> Pending queue.
2.  Admin reviews content and AI tags in dashboard.
3.  Admin approves (with/without Gemini summarization) or rejects.
4.  Approved docs processed (Gemini analysis, chunking, embedding) -> Vector store.

### Automated Document Tagging with Gemini AI

*   **Overview**: Fully automated process using Gemini; admins review, not tag.
*   **Process**: Upload -> Gemini Processing -> Pending Queue -> Admin Review -> Approve/Reject -> Vector Store (with AI tags preserved).
*   **Gemini Processor**: (`utils/geminiProcessor.ts` - not provided but implied) generates rich metadata (categories, levels, entities, keywords, summary, use cases, etc.). See `EnhancedGeminiDocumentAnalysis` interface for schema.
*   **Ingestion API**: `/api/admin/ingest-document.ts` handles ingestion and triggers Gemini processing.
*   **Approval Workflow**: `utils/adminWorkflow.ts::addApprovedDocumentToVectorStore` explicitly preserves all AI metadata fields during approval, performs necessary conversions (e.g., arrays to strings).
*   **Admin UI**: Emphasizes review-only role with info alerts, metadata viewers, explicit button labels ("Approve AI Tags"), and confirmation dialogs. Help panels explain the process.
*   **Metadata Types**: Table lists generated types (primary/secondary/industry/function categories, tech level, entities, keywords, summary, use cases).
*   **Benefits**: Consistency, efficiency, accuracy, searchability, scalability.
*   **Improvements**: UI clarity, help docs, metadata preservation, error handling, confirmation dialogs.
*   **Roadmap**: Feedback loop, custom taxonomies, tag suggestions, batch processing, version tracking.

### Chat Sessions Management

-   Component (`components/admin/ChatSessionsList.tsx` - simplified view provided).
-   Fetches sessions from `/api/admin/chat-sessions`.
-   Supports searching by query or message content.
-   Displays list and allows viewing detailed message thread for a selected session.
-   Button to open the session in the main chat interface.

<a name="admin-security-considerations"></a>

### Security Considerations

-   Admin API key (`x-admin-key`) required.
-   Input validation.
-   Separation of concerns.

<a name="benefits-of-the-admin-dashboard"></a>

### Benefits

-   Centralized management.
-   Data-driven insights via analytics.
-   Content optimization and gap identification.
-   User satisfaction tracking.
-   Debugging/Troubleshooting tool.

<a name="admin-recent-implementation-updates"></a>

### Recent Implementation Updates

-   Resolved browser compatibility issues (removed client-side FS access, updated utils).
-   Implemented proper API-based feedback system.

<a name="admin-future-enhancements"></a>

### Future Enhancements

-   User Management.
-   Advanced Analytics/Reporting.
-   Bulk Operations (sessions/documents).
-   Data Export/Import.
-   Admin Activity Logging.

## Configuration

<a name="environment-variables-env"></a>

### Environment Variables (.env)

**Required:**

*   `NODE_ENV`: `development` or `production`
*   `PORT`: Application port (e.g., `3000`)
*   `LOG_LEVEL`: Logging level (e.g., `info`)
*   `OPENAI_API_KEY`: OpenAI API key
*   `GEMINI_API_KEY`: Google AI Gemini API key
*   `PERPLEXITY_API_KEY`: Perplexity API key (if used)
*   `VECTOR_DB_TYPE`: Vector database type (e.g., `pinecone`, `weaviate`, `supabase`)
*   *(DB Specific Keys/URLs)*: `PINECONE_*`, `WEAVIATE_*`, `SUPABASE_URL`, `SUPABASE_KEY`, etc.
*   `DEFAULT_MODEL`: Default LLM for generation (e.g., `gemini-2.0-flash`)
*   `EMBEDDING_MODEL`: Model for text embeddings (e.g., `embedding-001`)
*   `MAX_TOKENS`: Default max tokens for LLM responses (e.g., `1024`)
*   `TEMPERATURE`: Default temperature for LLM responses (e.g., `0.2`)
*   `ENABLE_CONTEXTUAL_RETRIEVAL`: `true` or `false`
*   `CONTEXT_EXTRACTION_MODEL`: Model for document context (e.g., `gemini-2.0-flash`)
*   `DEFAULT_CONTEXTUAL_BOOST`: Default boost for contextual chunks (e.g., `1.2`)

**Optional (Examples):**

*   `CHUNK_CACHE_SIZE`, `EMBEDDING_CACHE_SIZE`, `SEARCH_CACHE_SIZE`, `DOC_CONTEXT_CACHE_SIZE`: Cache sizes.
*   `REQUEST_TIMEOUT_MS`, `MAX_CONCURRENT_REQUESTS`, `REQUEST_RETRIES`: Request handling.
*   `DEFAULT_CHUNK_SIZE`, `DEFAULT_CHUNK_OVERLAP`, `PREPROCESS_DOCUMENTS`, `MAX_DOCUMENT_SIZE_MB`, `CONTEXTUAL_CHUNKING`: Document processing.
*   `RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW_MS`, `API_KEY_EXPIRY_DAYS`: Security/Limits.
*   `CHUNK_CONTEXT_MODEL`, `RERANKING_MODEL`: Specific task models.
*   `PINECONE_NAMESPACE`: DB specific settings.

### Configuration Profiles

You can create different configuration profiles for various use cases:

#### High Precision Profile

```typescript
// High precision configuration profile
export const HIGH_PRECISION_PROFILE = {
  modelConfig: {
    queryModel: 'gemini-2.0-flash',
    temperature: 0.1,
    topP: 0.95
  },
  retrievalConfig: {
    contextualRetrieval: true,
    hybridRatio: 0.8,
    retrievalLimit: 20,
    contextualBoost: 1.5,
    reranking: true
  },
  chunkingConfig: {
    chunkSize: 400,
    chunkOverlap: 100,
    contextualChunking: true
  }
};
```

#### Performance Profile

```typescript
// Performance-optimized configuration profile
export const PERFORMANCE_PROFILE = {
  modelConfig: {
    queryModel: 'gemini-2.0-flash',
    temperature: 0.3,
    topP: 0.85
  },
  retrievalConfig: {
    contextualRetrieval: true,
    hybridRatio: 0.6,
    retrievalLimit: 10,
    contextualBoost: 1.0,
    reranking: false
  },
  chunkingConfig: {
    chunkSize: 600,
    chunkOverlap: 30,
    contextualChunking: false
  }
};
```

### Monitoring Configuration

```typescript
// Monitoring configuration
export const MONITORING_CONFIG = {
  logLevel: process.env.LOG_LEVEL || 'info',
  trackMetrics: true,
  trackLatency: true,
  trackTokenUsage: true,
  trackErrorRates: true,
  samplingRate: 0.1, // Sample 10% of requests for detailed logging
  exportMetrics: false
};
```

### Logging Configuration

```typescript
// Logging configuration
export const LOGGING_CONFIG = {
  level: process.env.LOG_LEVEL || 'info',
  format: 'json',
  outputFile: process.env.LOG_FILE || './logs/app.log',
  console: true,
  redactSecrets: true,
  includeTimestamp: true
};
```

### Security Configuration

```typescript
// Security configuration
export const SECURITY_CONFIG = {
  apiKeyRequired: true,
  apiKeyHeaderName: 'X-API-Key',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiry: '7d',
  rateLimiting: true,
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  contentSecurityPolicy: true,
  xssProtection: true
};
```

### Deployment-Specific Configuration

#### Production Settings
```
NODE_ENV=production
LOG_LEVEL=warn
CHUNK_CACHE_SIZE=5000
REQUEST_TIMEOUT_MS=60000
MAX_CONCURRENT_REQUESTS=100
RATE_LIMIT_REQUESTS=500
RATE_LIMIT_WINDOW_MS=60000
```

#### Development Settings
```
NODE_ENV=development
LOG_LEVEL=debug
CHUNK_CACHE_SIZE=500
REQUEST_TIMEOUT_MS=10000
MAX_CONCURRENT_REQUESTS=10
RATE_LIMIT_REQUESTS=unlimited
```

<a name="model-configuration-utilsmodelconfigts"></a>

### Model Configuration (`utils/modelConfig.ts`)

Defines models used for specific tasks (query, embedding, context extraction, chunk context, reranking). Allows selecting different models (Gemini, OpenAI, etc.) based on cost/performance.

## API Reference

<a name="authentication"></a>

### Authentication

API requests must include an authentication token in the header:

```
Authorization: Bearer YOUR_API_KEY
```

API keys can be managed in the admin dashboard.

### Error Handling

All API endpoints use standardized error responses:

```javascript
{
  "error": {
    "message": "Human-readable error message",
    "code": "error_code",
    "details": {
      // Additional error details if available
    }
  }
}
```

#### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_request` | 400 | Invalid request parameters |
| `authentication_required` | 401 | Missing or invalid API key |
| `permission_denied` | 403 | Insufficient permissions |
| `not_found` | 404 | Resource not found |
| `method_not_allowed` | 405 | HTTP method not allowed |
| `conflict` | 409 | Resource conflict |
| `rate_limit_exceeded` | 429 | Too many requests |
| `server_error` | 500 | Internal server error |

### API Versioning

The API version is specified in the URL path:

```
https://your-deployment-url.com/api/v1/query
```

The current version is `v1`. When making requests without a version specified, the latest version is used.

### Batch Operations

For processing multiple operations efficiently, use the batch endpoints:

- Batch document upload: `POST /batch-upload`
- Batch document deletion: `POST /admin/documents/batch-delete`
- Batch document update: `POST /admin/documents/batch-update`

These endpoints follow similar parameter structures as their single-operation counterparts but accept arrays of items.

### Rate Limits

API rate limits are applied as follows:

| Endpoint | Rate Limit |
|----------|------------|
| `/query` | 100 requests per minute |
| `/upload` | 60 requests per minute |
| Admin endpoints | 30 requests per minute |

When rate limits are exceeded, the API returns a `429 Too Many Requests` response with information about when the limit will reset.

<a name="endpoints"></a>

### Endpoints

## Visual Document Processing Implementation

### ImageAnalyzer Core Component

The `ImageAnalyzer` class in `utils/imageAnalysis/imageAnalyzer.ts` is the central component for visual content analysis:

```typescript
// Core methods of the ImageAnalyzer class
export class ImageAnalyzer {
  // Analyze an image using Gemini Vision API
  static async analyze(imagePath: string): Promise<ImageAnalysisResult> { ... }
  
  // Generate document-level context from image analysis
  static generateDocumentContext(analysis: ImageAnalysisResult): DocumentContext { ... }
  
  // Generate chunk-level context from image analysis
  static generateChunkContext(analysis: ImageAnalysisResult): ChunkContext { ... }
  
  // Prepare text for embedding from image analysis
  static prepareTextForEmbedding(analysis: ImageAnalysisResult): string { ... }
}
```

### Supported Visual Content Types

| Type | Description | Examples |
|------|-------------|----------|
| Charts | Visualizations of data | Bar charts, line graphs, pie charts |
| Tables | Structured data in grid format | Data tables, comparison charts |
| Diagrams | Visual representations of systems or concepts | Flowcharts, network diagrams, architecture diagrams |
| Screenshots | Captures of software interfaces | UI screenshots, application images |
| Photos | Photographic images | Product images, location photos |

### Visual Processing Workflow

1. **Upload & Detection**: User uploads an image file via the UploadForm component
2. **Initial Handling**: System identifies the MIME type and stores the file securely
3. **Gemini Vision Analysis**:
   - The image is sent to Gemini 2.0 Flash Vision API
   - API returns a detailed description, detected text, and content type
   - For charts/tables, structured data is extracted when possible
4. **Context Generation**:
   - Document-level context is extracted (summary, topics, entities, etc.)
   - Chunk-level context is generated (key points, related topics)
5. **Text Preparation**:
   - Context and analysis are combined into a searchable text representation
   - Original content is preserved for display/reranking
6. **Embedding & Storage**:
   - The prepared text is embedded using the embedding model
   - The embedding, text, and all metadata are stored in the vector store

## Troubleshooting

### Common Issues and Solutions

**Query and Retrieval Issues:**
-   **No search results**: Check vector store/BM25 index, query specificity.
-   **Slow response times**: Check context size, API limits, search parameters, caching.
-   **Incorrect company info**: Check cache TTL, API limits, research queries.
-   **Feedback Analytics Issues**: Check API endpoints, storage, aggregation logic.

**Configuration Issues:**
-   **High latency**: Reduce `DEFAULT_CHUNK_SIZE`, increase cache sizes, use faster models.
-   **Memory usage spikes**: Reduce `MAX_CONCURRENT_REQUESTS` and cache sizes.
-   **Poor retrieval quality**: Increase `hybridRatio`, enable `reranking`, adjust `contextualBoost`.
-   **API errors**: Check API key configuration, verify request format, check rate limits.
-   **Slow document processing**: Adjust preprocessing options, use batch processing, optimize chunking settings.

**Visual Processing Issues:**
-   **Image fails to analyze**: Check file format and size, ensure Gemini API key is valid.
-   **Poor analysis quality**: Try a different image format or improve image quality.
-   **Missing text extraction**: For text-heavy images, consider pre-processing for better contrast.
-   **API quota exceeded**: Implement rate limiting or request API quota increase.

## Implementation History and Current Status

### Completed Phases

*   **Phase 1**: Gemini-Based Document Processing (Processor, Prompts, Schema, Ingestion).
*   **Phase 2**: Enhanced Document Labeling (Categories, Topics, Entities, Hierarchical Search).
*   **Phase 3**: Fully Automated Document Tagging (Eliminated manual tagging, improved workflow/UI, metadata preservation).
*   **Phase 4**: Enhanced Conflict Detection (Semantic checks, recency/reliability, resolution suggestions).
*   **Phase 5**: Improved Search & Hierarchical Navigation (Category integration, optimized params, presentation, entity filtering).
*   **Multi-Modal**: Added visual processing (Analysis, Chunking, Search, Reranking, Generation).
*   **Backend Migration Planning**: Defined Supabase schema and migration strategy.

### Current Development Status

Core systems implemented. Currently migrating the vector store backend from file-based OpenAI embeddings to Supabase/`pgvector` with Google Gemini (`embedding-001`) embeddings. The `scripts/rebuildVectorStoreGemini_modified.js` script is actively running this migration. Initial work on updating the frontend UI/application code to connect to the new Supabase backend has begun.

### Gemini Migration

<a name="gemini-migration-overview"></a>

#### Overview

The system has been migrated from OpenAI's 1536-dimension embeddings to Google's Gemini 768-dimension embeddings. This migration offers cost advantages, improved performance for domain-specific content, and better integration with multi-modal capabilities.

#### Database Schema Changes

The new Supabase schema has been implemented with the following key tables:

1. **documents**: Stores document metadata and status information
   ```sql
   CREATE TABLE IF NOT EXISTS documents (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       title TEXT NOT NULL,
       source_url TEXT,
       file_path TEXT,
       mime_type TEXT NOT NULL,
       content_hash TEXT,
       is_approved BOOLEAN DEFAULT TRUE,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       metadata JSONB DEFAULT '{}'::jsonb
   );
   ```

2. **document_chunks**: Stores text chunks with references to parent documents
   ```sql
   CREATE TABLE IF NOT EXISTS document_chunks (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
       chunk_index INTEGER NOT NULL,
       content TEXT NOT NULL,
       metadata JSONB DEFAULT '{}'::jsonb,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       UNIQUE (document_id, chunk_index)
   );
   ```

3. **Vector operations**: The schema includes functions for vector similarity search using PostgreSQL's pgvector extension:
   ```sql
   CREATE OR REPLACE FUNCTION search_vectors(
     query_embedding VECTOR(768),
     match_threshold FLOAT, 
     match_count INT
   )
   RETURNS TABLE (
       id UUID,
       chunk_id UUID,
       content TEXT,
       metadata JSONB,
       similarity FLOAT
   ) AS $$
   BEGIN
       RETURN QUERY
       SELECT
           v.id,
           v.chunk_id,
           v.content,
           v.metadata,
           1 - (v.embedding <=> query_embedding) as similarity
       FROM
           vector_items v
       WHERE
           1 - (v.embedding <=> query_embedding) > match_threshold
       ORDER BY
           v.embedding <=> query_embedding
       LIMIT match_count;
   END;
   $$ LANGUAGE plpgsql;
   ```

4. **Hybrid search**: The schema includes a function for hybrid search that combines vector similarity with BM25 text search:
   ```sql
   CREATE OR REPLACE FUNCTION hybrid_search(
       query_text TEXT,
       query_embedding VECTOR(768),
       match_threshold FLOAT DEFAULT 0.78,
       match_count INT DEFAULT 10,
       min_content_length INT DEFAULT 20,
       bm25_weight FLOAT DEFAULT 0.25
   )
   RETURNS TABLE (
       id TEXT,
       chunk_id TEXT,
       document_id TEXT,
       score FLOAT,
       text TEXT,
       metadata JSONB
   ) AS $$
   -- Function implementation...
   $$ LANGUAGE plpgsql;
   ```

#### Rebuild Process

The migration includes a rebuild script (`scripts/rebuildVectorStoreGemini_modified.js`) that:

1. **Reads crawl data** from a local file (`data/workstream_crawl_data_transformed.json`)
2. **Processes documents** in batches, generating contextual embeddings with Gemini
3. **Stores documents and chunks** in Supabase using the new schema
4. **Updates BM25 statistics** for hybrid search functionality

Key features of the rebuild script:

- Comprehensive error handling with detailed logging
- Contextual embedding generation that incorporates document summaries and topics
- Fallback mechanisms for when insertion fails
- Progress tracking and verification of results

#### Code Changes

Several key components were modified to support the Gemini migration:

1. **Embedding dimension change**: Changed from 1536-dimension OpenAI embeddings to 768-dimension Gemini embeddings
2. **Database schema modification**: Updated schema to store embeddings directly in the `document_chunks` table
3. **Embedding client**: Implemented a new `GeminiEmbeddingClient` class that fulfills the `EmbeddingClient` interface
4. **Search functionality**: Updated vector similarity functions to work with the new embedding dimensions
5. **Temporary fixes**: Implemented workarounds in the chat interface to handle the transition period

#### Upcoming Development

1.  Complete Supabase/Gemini data migration.
2.  Implement connection pooling and performance optimizations.
3.  Enhance content conflict detection in the database.
4.  Set up proper multi-user auth and permissions.
5.  Deploy a scalable production environment.
6.  Refine SQL functions for performance and features.

#### Success Metrics

Lists target/achieved metrics for search success, conflict resolution, tagging accuracy, user satisfaction, classification coverage, search precision.

## Change Log

-   **v1.0.0** (2023-06-15): Initial documentation
-   **v1.1.0** (2023-07-20): Added dual chat mode documentation
-   **v1.2.0** (2023-08-12): Added feedback system details
-   **v1.3.0** (2023-09-05): Added real-time information system
-   **v1.4.0** (2023-10-18): Consolidated all documentation
-   **v2.0.0** (YYYY-MM-DD): Integrated Multi-Modal, Contextual Retrieval, Configuration, API Reference details. Added initial Supabase scaling plan.
-   **v2.1.0** (Current Date): Migrated vector store backend to Supabase/pgvector with Google Gemini embeddings (`embedding-001`). Implemented new database schema (`supabase_schema.sql`) and data migration script (`rebuildVectorStoreGemini_modified.js`). Updated relevant system components and documentation. Backend migration currently in progress. Started UI update planning.

### Multi-Modal Answer Generation

One of the key enhancements to the system is the improved multi-modal answer generation capability. The `generateAnswerWithVisualContext` function in `utils/answerGenerator.ts` has been completely redesigned to better handle visual content and provide more accurate, relevant answers that incorporate visual elements.

#### Enhanced Visual Content Features

1. **Advanced Visual Type Detection**:
   - Automatically identifies specific visual types mentioned in queries (charts, diagrams, tables, etc.)
   - Maps common terms (e.g., "graph", "plot") to standardized visual types
   - Prioritizes visual content that matches the query intent
   - Supports multiple visual type requests in a single query

2. **Structured Visual Content Formatting**:
   - Implements consistent structure for displaying visual information
   - Uses helper functions (`formatVisualType`, `formatExtractedText`, `formatStructuredData`) to standardize presentation
   - Provides type-specific formatting for charts, diagrams, tables, and screenshots
   - Clearly marks visual content that is directly relevant to the query

3. **Image Reference System**:
   - Generates unique reference IDs for each visual element (`visual-{index}-{counter}`)
   - Includes image URLs in a dedicated section of the prompt
   - Enables the frontend to render actual images alongside text descriptions
   - Maintains clear association between text references and visual elements

4. **Intelligent Model Selection**:
   - Automatically routes visual queries to Gemini models which excel at handling visual content
   - Uses OpenAI models for standard text queries for cost efficiency
   - Implements graceful fallback to Gemini when token limits are exceeded
   - Includes timeout handling to prevent excessive wait times

5. **Specialized Prompting Strategies**:
   - Provides tailored system prompts based on query type and visual content
   - Includes specific instructions for handling different visual types
   - Guides models to reference visuals appropriately ("our chart showing...")
   - Prevents misleading phrases like "as shown in the image"

#### Implementation Details

The multi-modal answer generation process follows these steps:

1. **Query Analysis**: 
   ```typescript
   // Enhanced visual type detection
   const visualTypeMapping = [
     { terms: ['chart', 'graph', 'plot'], type: 'chart' },
     { terms: ['table', 'grid', 'spreadsheet'], type: 'table' },
     // Additional mappings...
   ];
   
   // Check query for visual type references
   visualTypeMapping.forEach(mapping => {
     if (mapping.terms.some(term => queryLower.includes(term))) {
       requestedVisualTypes.add(mapping.type);
     }
   });
   ```

2. **Visual Content Formatting**:
   ```typescript
   // Build the formatted visual information
   let visualInfo = `[${formattedType}]: ${visual.description}`;
   
   // Add extracted text if available, with cleaner formatting
   if (visual.extractedText && visual.extractedText.trim()) {
     const cleanedText = formatExtractedText(visual.extractedText, 150);
     visualInfo += `\nText content: ${cleanedText}`;
   }
   
   // Add image URL reference
   if (includeImageUrls && visual.imageUrl) {
     imageUrls.push(`${visualRefId}: ${visual.imageUrl}`);
     visualInfo += `\nImage reference: ${visualRefId}`;
   }
   ```

3. **Context Preparation**:
   ```typescript
   // Extract the text and image URLs
   const contextTextArray = formattedContextItems.map(item => item.text);
   const allImageUrls = formattedContextItems.flatMap(item => item.imageUrls);
   
   // Complete context text with image URLs
   const fullContextText = contextText + imageUrlsText;
   ```

4. **Model Selection**:
   ```typescript
   // We'll use Gemini for:
   // 1. Multi-modal content (has visual focus)
   // 2. Large context
   // 3. When specific visual types are requested
   const useGemini = totalEstimatedTokens > MAX_TOKENS_OPENAI || 
                    visualFocus || 
                    requestedVisualTypes.size > 0;
   ```

5. **Prompt Engineering**:
   ```typescript
   const systemPrompt = `You are a knowledgeable AI assistant...
   
   VISUAL CONTENT GUIDELINES:
   ${visualFocus ? '- This query is specifically about visual content, so prioritize information from the visual descriptions' : '- Include visual information where relevant to the query'}
   - When referencing visuals, use their type and a brief description: "our chart showing monthly sales trends"
   - If image references are provided, mention them when discussing related visuals: "You can refer to the chart (image-reference-id) showing..."
   ...
   ```

#### Helper Functions

The implementation includes several helper functions for consistent formatting:

1. **formatVisualType**: Standardizes visual type names
   ```typescript
   function formatVisualType(type: string): string {
     if (!type) return 'VISUAL';
     
     // Handle common type variations
     const lowerType = type.toLowerCase();
     
     // Map type to standardized format
     const typeMap: Record<string, string> = {
       'chart': 'CHART',
       'graph': 'CHART',
       // Additional mappings...
     };
     
     return typeMap[lowerType] || type.toUpperCase();
   }
   ```

2. **formatExtractedText**: Cleans and truncates text for better readability
   ```typescript
   function formatExtractedText(text: string, maxLength: number = 150): string {
     // Clean up the text
     let cleanedText = text
       .replace(/\s+/g, ' ')
       .replace(/\n+/g, ' ')
       .trim();
     
     // Truncate if needed
     if (cleanedText.length > maxLength) {
       cleanedText = cleanedText.substring(0, maxLength) + '...';
     }
     
     return cleanedText;
   }
   ```

3. **formatStructuredData**: Presents complex data in a human-readable format
   ```typescript
   function formatStructuredData(data: any): string {
     // Handle arrays differently than objects
     if (Array.isArray(data)) {
       // If it's a simple array, join with commas
       if (data.length <= 5 && data.every(item => typeof item !== 'object')) {
         return `[${data.join(', ')}]`;
       }
       
       // For longer or complex arrays, summarize
       return `Array with ${data.length} items`;
     }
     
     // Additional formatting logic...
   }
   ```

#### Testing Framework

To ensure the reliability and performance of the multi-modal answer generation system, a comprehensive testing framework has been implemented:

1. **Unit Tests**: Test individual components like formatters and analysis functions
2. **Integration Tests**: Test the interaction between components, such as query analysis and content formatting
3. **End-to-End Tests**: Test the complete pipeline from query to answer

The testing scripts include:
- `scripts/tests/test_visual_answer_generator.js`: Tests various visual query types with mock data
- `scripts/test_enhanced_answer_generator.js`: Simplified test for quick validation

Example of testing with different visual query types:
```javascript
const testQueries = [
  {
    type: "Chart Query",
    query: "How have our sales performed over the past year?",
    visualFocus: true,
    visualTypes: ["chart"]
  },
  {
    type: "Diagram Query",
    query: "What is the architecture of our product?",
    visualFocus: true,
    visualTypes: ["diagram"]
  },
  // Additional test cases...
];
```

#### Frontend Integration Requirements

To fully utilize the enhanced visual content capabilities, the frontend needs to be updated:

1. **Image Display**:
   - Extract image references from the answer
   - Make API calls to retrieve actual images
   - Render images alongside the text response

2. **Reference Handling**:
   - Parse image reference IDs in the text
   - Link text references to displayed images
   - Provide interactive elements for viewing larger images

3. **Visual Context UX**:
   - Update the chat UI to accommodate visual elements
   - Implement responsive design for various screen sizes
   - Add loading states for image retrieval

#### Next Steps

The next phase of implementation involves:

1. **Comprehensive Test Suite**:
   - Expand test coverage to include all edge cases
   - Implement automated metrics collection
   - Create benchmarking system for performance evaluation

2. **Data Migration**:
   - Execute database schema changes for new embedding dimensions
   - Rebuild vector store with contextual embeddings
   - Update BM25 keyword indices

3. **Frontend Implementation**:
   - Implement image display in chat UI
   - Add reference handling in message rendering
   - Create interactive elements for visual content

### Testing Framework Requirements

A robust testing framework is essential for ensuring the reliability and performance of the RAG system. The following components are required:

#### 1. Unit Testing

The unit testing framework should cover:

- **Query Analysis**: Test the detection of visual queries and extraction of requested visual types
- **Content Formatting**: Test the formatting of visual content and structuring of context
- **Model Selection**: Test the logic for choosing between OpenAI and Gemini models
- **Helper Functions**: Test the formatting functions for visual types, extracted text, and structured data

#### 2. Integration Testing

Integration tests should verify the interaction between components:

- **Embedding Generation**: Test the creation of embeddings with contextual information
- **Retrieval Pipeline**: Test the retrieval of relevant documents and their ranking
- **Visual Content Processing**: Test the extraction and formatting of visual elements
- **Answer Generation**: Test the generation of answers with visual context

#### 3. System Testing

System tests should validate end-to-end functionality:

- **Visual Query Handling**: Test the complete pipeline from visual query to answer
- **Error Handling**: Test recovery from API failures and token limit issues
- **Performance Benchmarking**: Test system response times for various query types
- **Resource Utilization**: Test CPU, memory, and API usage under load

#### 4. Evaluation Metrics

The following metrics should be collected for system evaluation:

- **Retrieval Accuracy**: Measure the precision and recall of retrieved documents
- **Answer Quality**: Evaluate the relevance and correctness of generated answers
- **Visual Reference Accuracy**: Assess the accuracy of visual content references
- **Response Time**: Measure the latency for different query types
- **Cost Efficiency**: Track token usage and API costs

#### Implementation Plan

The testing framework should be implemented in the following order:

1. **Setup Test Environment**:
   - Configure test databases and vector stores
   - Create mock data for various test cases
   - Implement logging and metrics collection

2. **Implement Test Suites**:
   - Develop unit tests for core components
   - Create integration tests for component interactions
   - Build end-to-end tests for complete workflows

3. **Establish Benchmarks**:
   - Define baseline performance metrics
   - Create comparison mechanisms for different configurations
   - Implement regression testing to detect performance degradation

4. **Automate Test Execution**:
   - Set up continuous integration for automated testing
   - Configure test reporting and alerting
   - Implement test coverage tracking

This comprehensive testing framework will ensure the stability and performance of the multi-modal RAG system, particularly as data migration and frontend integration proceed.
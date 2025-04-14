# Sales Chat RAG System

A comprehensive RAG (Retrieval-Augmented Generation) system for sales and customer support. This application integrates advanced search techniques, dynamic chunking, multi-modal reasoning, and real-time company research to provide accurate, context-aware responses.

## Executive Summary

This project implements a Retrieval-Augmented Generation (RAG) system tailored for sales and customer support scenarios. It leverages a sophisticated pipeline including web data ingestion (`Stagehand`), document management, hybrid search (combining semantic vector search via Supabase `pgvector` and keyword full-text search), advanced multi-modal reranking (using Gemini to consider text, visuals, and content quality), and context-aware answer generation (using OpenAI/Gemini with support for conversational queries and visual context). Key features include real-time company research via Perplexity API, standardized metadata management, and comprehensive admin tools for document and chunk management.

## Table of Contents

- [Executive Summary](#executive-summary)
- [Core Features](#core-features)
- [System Architecture](#system-architecture)
  - [Frontend](#frontend)
  - [Backend](#backend)
  - [RAG Pipeline](#rag-pipeline)
- [Key Components](#key-components)
  - [Web Crawler (Stagehand)](#web-crawler-stagehand)
  - [Document Management System (DMS)](#document-management-system-dms)
  - [Document Ingestion Process](#document-ingestion-process)
  - [Vector Store Management](#vector-store-management)
  - [Chunk Management System](#chunk-management-system)
  - [Chat Interfaces](#chat-interfaces)
  - [Perplexity API Integration](#perplexity-api-integration)
  - [Admin Dashboard](#admin-dashboard)
- [Standardized Categories & Tagging](#standardized-categories--tagging)
- [Authentication](#authentication)
- [Utilities Overview](#utilities-overview)
- [Supabase Integration](#supabase-integration)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [API Documentation](#api-documentation)
- [Folder Structure](#folder-structure)
- [UI and Styling](#ui-and-styling)
- [Contributing](#contributing)
- [License](#license)

## Core Features

- 📄 **Data Ingestion**: Flexible web crawler (`Stagehand`) and document upload workflow. [See Document Ingestion Details](./docs/document_ingestion.md)
- 📂 **Document Management**: Complete workflow for document upload, processing, approval, and management. [See DMS Details](./docs/dms_details.md)
- 🧩 **Chunk Management**: Fine-grained control over document chunks with advanced editing and metadata filtering. [See DMS Details](./docs/dms_details.md)
- 💾 **Vector Store**: Efficient storage and retrieval of semantic embeddings using Supabase and `pgvector`. [See Vector Store Details](./docs/vector_store_management.md)
- 🔍 **Hybrid Search & RAG Pipeline**: Combines vector similarity (semantic) and full-text keyword search, followed by advanced reranking and answer generation. [See RAG Pipeline Details](./docs/rag_pipeline_details.md)
- ✨ **Advanced Reranking**: LLM-based (Gemini) reranking of search results considering text relevance, visual context, and content quality scores.
- 🏢 **Company Research**: Automatic company information retrieval and verification using Perplexity API integration. [See Perplexity Integration Details](./docs/perplexity_integration.md)
- 💬 **Chat Interface**: Separate interfaces for general knowledge base queries and specific company research chat. [See Chat System Overview](./docs/chat_system.md)
- 📊 **Admin Dashboard**: Comprehensive analytics and system management tools. [See Admin Dashboard Overview](./docs/admin_dashboard.md)
- 🏷️ **Standardized Metadata**: Consistent use of categories, keywords, technical levels, and entities across the system. [See Category & Tagging Details](./docs/category_and_tagging.md)
- 🔐 **Authentication**: Secure access control for administrative functions. [See Authentication Details](./docs/auth_details.md)
- 🧱 **Supabase Backend**: Leverages Supabase for database, vector store, auth, and storage. [See Supabase Integration Details](./docs/supabase_integration.md)

## System Architecture

### Frontend

- **React/Next.js**: Server-side rendered React application.
- **Tailwind CSS**: Utility-first CSS framework for styling components.
- **React Feather**: Icon library.
- **DataGrid**: Used for efficient data display and management (e.g., `AllChunksViewer`).
- **Responsive Design**: Optimized for desktop and mobile devices.

### Backend

- **Node.js**: Server runtime environment.
- **Next.js API Routes**: Implementation of backend API endpoints.
- **Supabase**: PostgreSQL database for metadata storage, vector store (`pgvector` extension), and image file storage. Provides `document_chunks` table and RPC functions (e.g., `search_vectors`) for vector operations. [See Supabase Integration Details](./docs/supabase_integration.md)
- **LLMs (Gemini/OpenAI)**: Used for embedding generation, reranking, answer synthesis, and metadata extraction. Configurable via `utils/modelConfig.ts`.
- **Perplexity API**: Used for real-time company information gathering. [See Perplexity Integration Details](./docs/perplexity_integration.md)

### RAG Pipeline

The core Retrieval-Augmented Generation pipeline involves these steps:

1.  **Query Analysis**: (Optional) Analyze user query intent, extract key entities, and determine if the query has a visual focus (`utils/queryAnalysis.ts`).
2.  **Hybrid Search**: Retrieve relevant document chunks using a weighted combination (`utils/hybridSearch.ts`) of:
    *   **Vector Search**: Finds semantically similar content using embeddings via Supabase `pgvector` (`utils/vectorStore.ts::getSimilarItems` calling `search_vectors` RPC).
    *   **Keyword Search**: Finds exact or partial term matches using PostgreSQL Full-Text Search (FTS).
    *   Filtering occurs based on standardized metadata (categories, technical level, etc.).
3.  **Reranking**: Reorder the retrieved chunks using Gemini (`utils/reranking.ts::rerankWithGemini`) considering:
    *   Query relevance (textual and potentially visual).
    *   Visual content matching (prioritizing relevant visual types for visual queries).
    *   **Content Quality Score**: A score (0-1) from the initial crawl, used as a secondary signal.
    *   Rules for down-ranking specific content types (e.g., job postings for non-hiring queries).
    *   Includes a heuristic-based fallback (`applyFallbackReranking`) if Gemini fails.
4.  **Context Creation**: Filter, deduplicate, and format the top-ranked chunks into a concise context. If the context exceeds token limits, it may be summarized using Gemini (`utils/answerGenerator.ts::summarizeContext`). Source citations are prepared.
5.  **Answer Generation**: Send the query, conversation history, and curated context (potentially including formatted visual details) to an LLM (OpenAI primary, Gemini fallback) via `utils/answerGenerator.ts`. Handles conversational queries, zero-result scenarios, and visual context integration.
6.  **Response Formatting**: Structure the final answer, potentially including citations or structured data, for display in the chat interface.

[Detailed documentation on the RAG Pipeline](./docs/rag_pipeline_details.md)

## Key Components

### Web Crawler (Stagehand)

- **Purpose**: Ingests website content for the knowledge base.
- **Technology**: Uses the [Stagehand](https://stagehand.dev/) framework (`stagehand/`) for AI-driven browser automation.
- **Implementation**: The `stagehand/examples/universal_crawler.ts` script is configured to:
    - Crawl target websites (e.g., `www.workstream.us`).
    - Extract clean text content optimized for RAG, removing boilerplate.
    - Calculate a `content_quality_score` for each page based on content length, structure, and diversity.
    - Optionally extract and download relevant images and PDFs.
    - Extract metadata (title, description, etc.).
    - Handle errors and retry failed pages.
    - Save output as structured JSON files suitable for the ingestion pipeline.
- **Configuration**: Settings like target URL, concurrency, depth, quality thresholds, and feature toggles are configurable within the script or via environment variables.
- **Documentation**: See `stagehand/examples/universal_crawler.md` for example-specific notes.

### Document Management System (DMS)

Provides a workflow for document ingestion, approval, and management.

1.  **Document Upload**: Accepts text, PDF, Word documents via `/api/documents/upload`.
2.  **Document Processing**: Automatic text/visual extraction, metadata generation (using Gemini analysis via `utils/metadataExtractor.ts` and `utils/geminiProcessor.ts`), category standardization, and contextual chunking (`utils/documentProcessing.ts`, `utils/multiModalChunking.ts`).
3.  **Admin Approval**: Interface (`components/admin/PendingDocuments.tsx`) for reviewing and approving/rejecting documents.
4.  **Document Management**: Search, edit, and manage approved documents (`components/admin/DocumentManagement.tsx`).

[Detailed Documentation on the DMS](./docs/dms_details.md)

### Document Ingestion Process

Describes the end-to-end flow from document submission (upload, crawl) to becoming searchable.

[Detailed Documentation on Document Ingestion](./docs/document_ingestion.md)

### Vector Store Management

Handles the storage and retrieval of semantic vector embeddings:

- **Storage:** Uses Supabase PostgreSQL with the `pgvector` extension.
- **Embeddings:** Generated using Google's `models/text-embedding-004` via `utils/embeddingClient.ts`.
- **Indexing:** Utilizes IVFFlat or HNSW indexes for efficient similarity search.
- **Search:** Performed via Supabase RPC functions leveraging `pgvector` operators.

[Detailed Documentation on Vector Store Management](./docs/vector_store_management.md)

### Chunk Management System

The `AllChunksViewer` component (`components/admin/AllChunksViewer.tsx`) provides fine-grained control over document chunks:

1.  **Hybrid Search**: Search chunks using vector and keyword search with advanced filtering.
2.  **Advanced Filtering**: Filter by document ID, standardized categories, technical level, and other metadata.
3.  **Detailed Editing**: View and edit chunk content; regenerate embeddings if needed.
4.  **Contextual Navigation**: Easily navigate to parent documents.

*(Note: Chunk management is tightly integrated with the DMS. See [DMS Details](./docs/dms_details.md) for more information.)*

### Chat Interfaces

Provides user interfaces for interacting with the knowledge base and company research features.

1.  **General Chat**: (`pages/chat.tsx`) For querying the general knowledge base built from ingested documents.
2.  **Company Chat**: (`pages/company-chat.tsx`) For company-specific research, leveraging the Perplexity API integration.

[Detailed Documentation on the Chat System](./docs/chat_system.md)

### Perplexity API Integration

- **Purpose**: Provides real-time company information for the Company Chat feature.
- **Implementation**: Uses API routes (`/api/company/verify`, `/api/company/info`) and utilities (`utils/perplexityClient.ts`).

[Detailed Documentation on Perplexity Integration](./docs/perplexity_integration.md)

### Admin Dashboard

(`pages/admin/dashboard.tsx`) Provides analytics and system management capabilities, including access to DMS and chunk management.

[Detailed Documentation on the Admin Dashboard](./docs/admin_dashboard.md)

## Standardized Categories & Tagging

The application uses a standardized category system for document classification and filtering to ensure consistency.

- **Definition**: Categories are defined in `utils/tagUtils.ts` (`STANDARD_CATEGORIES`) and `utils/documentCategories.ts` (`DocumentCategoryType`).
- **Examples**: `GENERAL`, `PRODUCT`, `TECHNICAL`, `FEATURES`, `SALES`, `INDUSTRY`, `COMPETITIVE`, `REFERENCE`, `INTERNAL`, `PRICING`, `COMPARISON`, `CUSTOMER_CASE`.
- **Usage**: Applied during document processing, used for filtering in search (`HybridSearchFilter`), and displayed in UI components.

[Detailed Documentation on Categories & Tagging](./docs/category_and_tagging.md)

## Authentication

Secures access to the administrative sections (Admin Dashboard, DMS).

- **Current Status:** Uses a placeholder implementation for development.
- **Production Plan:** Recommends using Supabase Auth for robust authentication and potentially role-based access control (RBAC).

[Detailed Documentation on Authentication](./docs/auth_details.md)

## Utilities Overview

The `utils/` directory contains core helper modules for various tasks like interacting with AI models, database operations, data processing, and more.

[Detailed Documentation on Utilities](./docs/utils_overview.md)

## Supabase Integration

Describes how Supabase services (Database, `pgvector`, Auth, Storage, RPC) are utilized.

[Detailed Documentation on Supabase Integration](./docs/supabase_integration.md)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account with `pgvector` extension enabled
- OpenAI API key *or* Gemini API key (configure in `utils/modelConfig.ts` and `.env.local`)
- (Optional) Perplexity API key for company research

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/sales_chat_openai_rag_full.git
    cd sales_chat_openai_rag_full
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment variables by copying `.env.example` to `.env.local` (if `.env.local` doesn't exist):
    ```bash
    cp .env.example .env.local
    ```
    Then edit `.env.local` with your required API keys and Supabase credentials:
    - `OPENAI_API_KEY`: Your OpenAI API key (required if using OpenAI models).
    - `GOOGLE_AI_API_KEY`: Your Google AI API key (required if using Gemini models).
    - `PERPLEXITY_API_KEY`: Your Perplexity API key (optional, for company research feature).
    - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL (found in Project Settings > API). **Must** start with `NEXT_PUBLIC_`.
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase project `anon` key (found in Project Settings > API). **Must** start with `NEXT_PUBLIC_`.
    - `SUPABASE_SERVICE_KEY`: Your Supabase project `service_role` key (found in Project Settings > API). **Do NOT** prefix with `NEXT_PUBLIC_`. This key must be kept secret.

4.  Run the development server:
    ```bash
    npm run dev
    ```

5.  Access the application at `http://localhost:3000`

## API Documentation

*(Note: Refer to individual files in `pages/api/` for detailed request/response structures. See also [DMS Details](./docs/dms_details.md) for Admin API specifics.)*

### Document API

- `POST /api/documents/upload`: Upload a document for processing.
- `POST /api/admin/documents/approve`: Approve pending documents.
- `POST /api/admin/documents/reject`: Reject pending documents.
- `GET /api/admin/documents`: List documents with filtering.
- `GET /api/admin/documents/[id]`: Get document details.
- `PUT /api/admin/documents/[id]`: Update document.
- `DELETE /api/admin/documents/[id]`: Delete document.

### Chunk API

- `GET /api/admin/chunks`: List chunks with pagination.
- `GET /api/admin/chunks/[id]`: Get chunk details.
- `PUT /api/admin/chunks/[id]`: Update chunk content and embedding.
- `DELETE /api/admin/chunks/[id]`: Delete chunk.

### Chat API

- `POST /api/chat`: Send a message and get a response from the general knowledge base.

### Company API

- `POST /api/company/verify`: Verify company existence and get suggestions.
- `POST /api/company/info`: Get detailed company information using Perplexity.

## Folder Structure

```
sales_chat_openai_rag_full/
├── components/           # React components (UI, Admin, Chat, Layout)
├── pages/                # Next.js pages and API routes
│   ├── api/              # API routes (admin, chat, company, documents)
│   └── ...               # Frontend pages (chat, company-chat, admin, etc.)
├── utils/                # Core utility functions [See Utils Overview](./docs/utils_overview.md)
│   ├── documentProcessing/ # Text extraction, chunking
│   ├── imageAnalysis/    # Image analysis utilities
│   ├── answerGenerator.ts  # Generates final answers using LLMs, handles context, citations, visual info, and conversational queries.
│   ├── documentCategories.ts # Enum definitions for categories
│   ├── embeddingClient.ts  # Handles embedding generation
│   ├── geminiClient.ts     # Lower-level Gemini API interactions
│   ├── geminiProcessor.ts  # Higher-level document analysis w/ Gemini
│   ├── hybridSearch.ts     # Implements hybrid vector + keyword search logic with filtering.
│   ├── logger.ts           # Logging utility
│   ├── metadataExtractor.ts # Extracts metadata during ingestion
│   ├── modelConfig.ts      # Centralized LLM model configuration
│   ├── perplexityClient.ts # Perplexity API client
│   ├── queryAnalysis.ts    # Query analysis utilities (intent, visual focus).
│   ├── reranking.ts        # Multi-modal search result reranking using Gemini (with fallback).
│   ├── supabaseClient.ts   # Supabase client and DB interactions helper.
│   ├── tagUtils.ts         # Category/tag constants and normalization
│   └── vectorStore.ts      # Manages interaction with Supabase vector store (`document_chunks` table, `search_vectors` RPC).
├── types/                # TypeScript type definitions
├── styles/               # Global styles, Tailwind config, theme
├── public/               # Static assets
├── scripts/              # Utility scripts (e.g., rebuildVectorStore)
├── stagehand/            # Stagehand framework & web crawler example
│   └── examples/         # Crawler implementation (universal_crawler.ts)
├── docs/                 # Detailed documentation files
│   ├── rag_pipeline_details.md
│   ├── vector_store_management.md
│   ├── category_and_tagging.md
│   ├── dms_details.md
│   ├── utils_overview.md
│   ├── auth_details.md
│   ├── perplexity_integration.md
│   ├── chat_system.md
│   ├── admin_dashboard.md
│   ├── document_ingestion.md
│   └── supabase_integration.md
└── ...                   # Config files (.env, next.config.js, etc.)
```

## UI and Styling

This application uses **Tailwind CSS** for styling. It previously used Material UI (MUI), but MUI was removed to resolve build issues.

- **Theme**: Basic theme tokens (colors, spacing) are defined in `styles/theme.ts`.
- **Global Styles**: `styles/globals.css` includes base styles and Tailwind configuration.
- **Markdown**: `styles/markdown.css` provides specific styling for rendered markdown content.
- **Icons**: [React Feather](https://feathericons.com/) is used for icons (e.g., `<Home className="h-5 w-5" />`).
- **Custom Components**: Common UI elements like Buttons and Tables are implemented as custom components in `components/ui/` using Tailwind classes.

## Contributing

We welcome contributions! Please follow standard Git workflow:

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/your-feature`).
3.  Commit your changes (`git commit -m 'Add some feature'`).
4.  Push to the branch (`git push origin feature/your-feature`).
5.  Open a Pull Request.

## License

This project is licensed under the MIT License. 
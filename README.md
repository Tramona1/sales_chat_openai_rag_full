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
  - [DocumentCategoryType Enum](#documentcategorytype-enum)
- [Authentication](#authentication)
- [Utilities Overview](#utilities-overview)
- [Supabase Integration](#supabase-integration)
- [Dependencies](#dependencies)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [API Documentation](#api-documentation)
- [Folder Structure](#folder-structure)
- [UI and Styling](#ui-and-styling)
- [Contributing](#contributing)
- [License](#license)
- [API Keys Configuration](#api-keys-configuration)
- [Recent Improvements](#recent-improvements)
  - [Enhanced Follow-up Question Handling](#enhanced-follow-up-question-handling)
  - [Enhanced Admin Authentication](#enhanced-admin-authentication)
  - [Improved Error Handling](#improved-error-handling)
  - [Enhanced Chat Experience](#enhanced-chat-experience)
- [Documentation](#documentation)
  - [Component Documentation](#component-documentation)
  - [Process Documentation](#process-documentation)
  - [Feature Documentation](#feature-documentation)
  - [Follow-up Question Handling](./docs/follow_up_questions.md)

## Core Features

- 📄 **Data Ingestion**: Flexible web crawler (`Stagehand`) and document upload workflow. [See Document Ingestion Details](./docs/document_ingestion.md)
- 📂 **Document Management**: Complete workflow for document upload, processing, approval, and management. [See DMS Details](./docs/dms_details.md)
- 🧩 **Chunk Management**: Fine-grained control over document chunks with advanced editing and metadata filtering. [See DMS Details](./docs/dms_details.md)
- 💾 **Vector Store**: Efficient storage and retrieval of semantic embeddings using Supabase and `pgvector`. [See Vector Store Details](./docs/vector_store_management.md)
- 🔍 **Hybrid Search & RAG Pipeline**: Combines vector similarity (semantic) and full-text keyword search, followed by advanced reranking and answer generation. [See RAG Pipeline Details](./docs/rag_pipeline_details.md)
- ✨ **Advanced Reranking**: LLM-based (Gemini) reranking of search results considering text relevance, visual context, and content quality scores.
- 🧠 **LLM-Driven Architecture**: Fully LLM-powered system without hardcoded responses, enabling sophisticated query understanding and natural answers. [See LLM Architecture](./docs/llm_architecture.md)
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
5.  **Answer Generation**: Send the query, conversation history, and curated context (potentially including formatted visual details) to an LLM (Gemini) via `utils/answerGenerator.ts`. Handles conversational queries, zero-result scenarios, and visual context integration.
6.  **Response Formatting**: Structure the final answer, potentially including citations or structured data, for display in the chat interface.

[Detailed documentation on the RAG Pipeline](./docs/rag_pipeline_details.md)

### LLM-Powered Answer Generation

The system uses a fully LLM-based approach for understanding and answering user queries:

1. **Direct LLM Integration**: The architecture directly uses LLM capabilities without intermediary layers or hardcoded responses. This enables the system to scale effectively with increasing data and query complexity.
   
2. **LLM Answer Generation**: The `utils/answerGenerator.ts` module handles:
   * Processing retrieved context from search results
   * Intelligently formatting conversational greetings and simple queries
   * Generating coherent, context-sensitive responses using Gemini LLM
   * Handling large context windows with automatic summarization
   * Providing fallback mechanisms when information is incomplete
   * Managing citation and source attribution

3. **Query Understanding**: The system leverages Gemini's capabilities to analyze queries via `utils/geminiProcessor.ts`:
   * Extract intent and entities from natural language
   * Categorize query types (product, technical, informational)
   * Determine appropriate search parameters and filters
   * Handle conversation context for multi-turn interactions

4. **Context-Sensitive Response Generation**: The LLM adapts responses based on:
   * Query type (greeting, product question, technical query)
   * Available context from retrieved documents
   * Conversation history and user intent
   * Metadata from retrieved documents (categories, technical level)

This fully LLM-driven approach ensures responses are natural, comprehensive, and directly relevant to user queries while maintaining the ability to acknowledge limitations when information is not available.

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

The system uses a consistent approach to categorization and tagging throughout the application:

### DocumentCategoryType Enum

The document categorization system is built around a strongly-typed enum (`DocumentCategoryType`) defined in `utils/documentCategories.ts`. This provides:

- **Type Safety**: Ensures categories are consistent across the application
- **Standardized Values**: Prevents typos and inconsistencies in category names
- **IDE Support**: Enables autocomplete and validation during development

The enum includes categories like:
- Primary categories (HIRING, ONBOARDING, HR_MANAGEMENT, PAYROLL, etc.)
- Secondary categories (TEXT_TO_APPLY, TWO_WAY_SMS, BACKGROUND_CHECKS, etc.)
- Sales-focused categories (CASE_STUDIES, PRICING_INFORMATION, etc.)
- Content types (BLOG, COMPANY_INFO, LEGAL)

Using this enum throughout the codebase (search filters, document metadata, query analysis) ensures consistent classification and improves search relevance.

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

## Dependencies

The application relies on several key libraries:

- **Next.js**: For server-side rendering and API routes
- **React**: Frontend UI library
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Supabase JS Client**: For interacting with Supabase services
- **date-fns**: For date formatting and manipulation in analytics
- **react-markdown**: For rendering markdown content in chat messages
- **lodash**: For utility functions like debouncing and data manipulation
- **Recharts**: For data visualization in analytics dashboards
- **axios**: For making HTTP requests
- **zod**: For schema validation
- **lucide-react**: For UI icons

All dependencies are specified in `package.json` and must be installed using `npm install` before building the application.

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

    > **Important Note:** The system expects Supabase credentials to use the exact variable names shown above. The `NEXT_PUBLIC_` prefix is required for client-side access, while the service key should never be exposed to the client. Using different variable names may cause connection issues.

4.  Run the development server:
    ```bash
    npm run dev
    ```

5.  Access the application at `http://localhost:3000`

### Local Development

```bash
npm run dev
# or
yarn dev
```

## Deployment

The application is configured for easy deployment on Vercel. A `vercel.json` configuration file is included in the project root with the following settings:

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "outputDirectory": ".next",
  "regions": ["iad1"],
  "github": {
    "silent": true
  }
}
```

### Deployment Steps

1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect the Next.js project
3. Configure environment variables in the Vercel dashboard
4. Deploy the application

For other deployment platforms, ensure that the necessary environment variables are configured and that the build process is set up correctly.

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

## Overview
This repository contains the code for the Workstream Sales Chat RAG (Retrieval-Augmented Generation) system. The system is designed to provide accurate information about Workstream by retrieving relevant documents from a knowledge base and generating answers based on those documents.

## Key Features

### Query Rewriting
The system automatically rewrites ambiguous queries to provide better context. For example, when a user asks about "the CEO" or "pricing" without specifying a company, the system assumes they are referring to Workstream.

#### How Query Rewriting Works
1. The system analyzes the query to identify any explicitly mentioned organizations.
2. If another organization (not Workstream) is explicitly mentioned, no rewriting occurs.
3. If the query contains ambiguous terms like "our", "we", "us", "my", or "the company", or if it's a simple query like "ceo", "products", "pricing" without context, the system rewrites the query to include "Workstream".
4. The rewritten query is then used for searching, while the original query is preserved for user-facing responses.

#### Implementation Details
- The `shouldRewriteQuery` function in `pages/api/query.ts` determines whether a query needs rewriting.
- The function takes the original query string and the query analysis result.
- It returns an object with a `rewrite` boolean and an optional `rewrittenQuery` string.
- For debugging, the response includes metadata about whether the query was rewritten.

Example query transformations:
- "Who is the CEO?" → "Who is the Workstream CEO?"
- "Tell me about pricing" → "Tell me about Workstream pricing"
- "What are our products?" → "What are Workstream products?"

### Answer Generation
The system generates natural language answers based on the retrieved documents, citing sources when appropriate.

#### Context-Sensitive Responses
The answer generation logic is designed to provide appropriate responses based on the query type:

1. **Greetings and Simple Queries**: For simple greetings (like "hello", "hi", "hey", "sup", "yo", etc.) or very short queries, the system provides a brief, friendly, casual introduction to its capabilities rather than a formal or comprehensive response. The greeting detection has been expanded to recognize more casual terms and phrases like "sup", "yo", and "hola" to create a more approachable experience.

2. **Product and Feature Categorization**: For product-related queries, the system automatically categorizes and summarizes information about different Workstream products and features (Text-to-Apply, Onboarding, etc.), presenting them in a structured format with descriptions from the knowledge base.

3. **Enhanced Keyword Processing**: The system now intelligently filters out common stopwords and pronouns ("our", "my", "we", etc.) to focus on meaningful keywords, improving search relevance for queries about products and features.

4. **Category-Based Searching**: When detecting product-related queries, the system automatically adds category filters to focus on product and feature documentation, significantly improving the relevance of search results.

5. **Contextual Leadership Queries**: For questions about CEOs, founders, or leadership, the system extracts relevant sentences across all context that mention leadership roles, providing a synthesized response.

6. **Relevant Sentence Extraction**: For general queries, the system extracts and combines the most relevant sentences from all available context that match the query keywords, creating coherent and focused responses.

7. **Partial Information Handling**: When the system only has partial or indirectly related information, it clearly acknowledges these limitations while still providing whatever relevant details are available.

8. **Fallback Responses**: When no relevant information is found, the system acknowledges the lack of specific information and suggests alternative topics to explore.

9. **Improved Short Query Handling**: The system now better detects and responds appropriately to very short or vague user inputs like "not sure", offering helpful guidance without generating error messages.

10. **Enhanced Product Query Detection**: The product keyword detection has been expanded to recognize a much wider range of product and feature terms, ensuring appropriate categorization of queries.

11. **Specialized Product Response Formatting**: For product-related queries, the system uses a specialized response format that organizes information about multiple products in a structured, comprehensive way.

12. **Intelligent Citation Handling**: Source citations are only included when meaningful search results are found, avoiding unhelpful citation numbers in responses with no substantive content.

13. **Transparent Limitation Acknowledgment**: When search results are poor or non-existent, the system explicitly acknowledges its limitations rather than providing vague or generic responses.

#### Implementation Details
- The `generateAnswer` function in `pages/api/query.ts` handles the answer generation logic.
- The system uses metadata filtering (primaryCategory) to improve product-related searches.
- Common Workstream products and features are recognized by name, allowing for better categorization.
- Search terms are pre-processed to remove stopwords and improve match relevance.
- For product queries, the system attempts to create a structured summary of multiple products rather than focusing on a single match.
- Source citations are included when available to provide transparency about the information's origin.
- The system provides specialized system prompts for different query types to generate more appropriate responses.

### Hybrid Search
The system uses a hybrid search approach, combining vector similarity and keyword-based search to retrieve relevant documents.

### Contextual Reranking
Retrieved documents are reranked based on their relevance to the query, taking into account the query context and the content of the documents.

## Configuration
The system can be configured through environment variables. See the `.env` file for available configuration options.

## API
The system exposes a REST API for querying the knowledge base. See `pages/api/query.ts` for details.

## Development
To run the system locally:
1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with appropriate configuration
4. Start the development server: `npm run dev`

## License
Proprietary - All rights reserved. 

## API Keys Configuration

The system requires proper API key configuration to function correctly. Pay special attention to how API keys are accessed throughout the codebase:

### Gemini API Key

The system accepts the Gemini API key from either of these environment variables:
- `GEMINI_API_KEY` - Primary environment variable for the Gemini API key
- `GOOGLE_AI_API_KEY` - Alternative/fallback environment variable for the Gemini API key

When initializing the Gemini client, always use both variables like this:
```typescript
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');
```

Do not use only one of the environment variables, as this can cause authentication failures if the key is defined in the other variable.

### OpenAI API Key

For OpenAI services, the system uses:
- `OPENAI_API_KEY` - Environment variable for the OpenAI API key

### Best Practices

- Always check for both `GEMINI_API_KEY` and `GOOGLE_AI_API_KEY` when initializing Gemini clients
- Reuse existing client instances when possible instead of creating new ones
- Consider using the utility functions in `utils/geminiClient.ts` rather than directly initializing clients
- When adding new AI service integrations, follow the same pattern of providing fallback environment variables 

## Recent Improvements

### Enhanced Follow-up Question Handling

The system now features significantly improved handling of follow-up questions:

- **Context-Aware Detection**: Follow-up questions are now identified using multiple signals:
  - Message position in the conversation (not the first message)
  - Presence of pronouns and contextual references
  - Message length and complexity
  
- **Smarter Context Integration**: The system now:
  - Uses up to 6 previous messages to provide comprehensive context
  - Properly formats role labels and message sequence for better understanding
  - Skips initial greeting messages to focus on substantive content
  
- **Better System Instructions**: LLM prompts now include specific instructions for follow-up handling:
  - Maintaining continuity with previous responses
  - Properly resolving pronoun references from conversation history
  - Understanding user intent for incomplete questions
  - Asking for clarification when needed rather than making assumptions
  
- **Improved Error Handling**: When follow-up questions fail, the system:
  - Provides more helpful and specific error messages
  - Suggests adding more context to questions
  - Logs detailed information for debugging purposes

These improvements significantly enhance the chat system's ability to maintain context across multiple turns of conversation, providing a more natural and effective user experience.

For detailed technical implementation and design decisions, see [Follow-up Question Handling](./docs/follow_up_questions.md).

### Enhanced Admin Authentication
The system has been updated with more robust admin authentication for API routes, including:
- Support for both header and query parameter authentication
- Detailed logging for debugging authentication issues
- Environment variable-based configuration
- Fallback mechanisms for development environments

### Improved Error Handling
Several error handling improvements have been implemented:
- More robust JSON parsing in the reranking module
- Graceful handling of large responses and malformed JSON
- Prevention of timeouts and gateway errors in API responses
- Multiple layers of fallbacks for error recovery

### Enhanced Chat Experience
We've also improved the chat experience:
- Eliminated repetition of user questions in responses
- Better keyword extraction for product queries
- Improved summarization for product-related information
- More natural greeting responses 
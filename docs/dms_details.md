# Document Management System (DMS) Details

## Overview

This document provides a detailed technical specification and operational overview of the Document Management System (DMS) within the Sales Chat RAG application. The DMS serves as the central hub for administrators to ingest, process, approve, manage, and maintain the quality of the documents and chunks that form the system's knowledge base.

**Goal:** To provide administrators with comprehensive tools for managing the lifecycle of knowledge base content, ensuring data quality, accuracy, and effective organization for the RAG pipeline.

**For the Non-Technical Reader:** The DMS is the "back office" or "control panel" for the knowledge library used by the AI chat assistant. It allows administrators to:
*   **Upload New Information:** Add new documents (like PDFs, Word docs, or website content) to the system.
*   **Review & Approve:** Check newly uploaded information for accuracy and relevance before making it available to the AI.
*   **Organize:** Assign categories and tags to documents so they can be found easily.
*   **Edit & Update:** Correct or update existing information.
*   **Manage Snippets (Chunks):** View and edit the smaller pieces (chunks) that documents are broken into for the AI to process.

## System Architecture & Components

The DMS integrates frontend components within the Admin Dashboard, backend API routes, and core utility functions.

*   **Frontend Components (in `components/admin/`):**
    *   `DocumentManagement.tsx`: Interface for viewing, searching, filtering, editing, and deleting approved documents.
    *   `PendingDocuments.tsx`: Interface for reviewing, approving, or rejecting newly uploaded documents awaiting review.
    *   `AllChunksViewer.tsx`: Interface for viewing, searching, filtering, and editing *all* chunks across documents.
    *   `DocumentChunkViewer.tsx` / `ChunkViewer.tsx`: Components for viewing and editing chunks associated with a *specific* document.
    *   Metadata Editor Components (Internal): Used within the above to modify categories, keywords, technical level, etc.
*   **API Layer (in `pages/api/admin/`):**
    *   `documents/index.ts`: Handles listing/searching documents with filtering and pagination.
    *   `documents/[id].ts`: Handles GET, PUT, DELETE operations for a specific document.
    *   `documents/approve.ts`: Endpoint for approving pending documents.
    *   `documents/reject.ts`: Endpoint for rejecting pending documents.
    *   `chunks/index.ts`: Handles listing/searching chunks with filtering and pagination.
    *   `chunks/[id].ts`: Handles GET, PUT, DELETE operations for a specific chunk.
*   **Service Layer (in `utils/`):**
    *   `documentProcessing/`: Contains logic for text extraction, chunking strategies (e.g., `multiModalChunking.ts`).
    *   `metadataExtractor.ts` / `geminiProcessor.ts`: Logic for automatic metadata suggestion using LLMs.
    *   `embeddingClient.ts`: Handles embedding generation for updated chunks.
    *   `vectorStore.ts`: Used for adding/updating/deleting chunks in the vector store.
*   **Data Layer (Supabase):**
    *   `documents` table: Stores metadata and status for each document.
    *   `document_chunks` table: Stores individual text chunks, their metadata, and vector embeddings.
    *   (Potentially a `pending_documents` table or equivalent status flag in `documents`).

## Document Lifecycle Workflow

1.  **Upload:** A new document (e.g., PDF, DOCX, TXT, or ingested web content) is submitted via an API endpoint (e.g., `/api/documents/upload`).
2.  **Initial Processing:**
    *   Text content is extracted.
    *   A unique hash of the content might be generated for duplicate detection.
    *   The document is saved with a "pending" status.
    *   Automatic metadata extraction (categories, keywords, summary, technical level, entities using `geminiProcessor.ts`) is performed and stored with the pending document.
3.  **Admin Review (`PendingDocuments.tsx`):**
    *   Admins view the list of pending documents.
    *   They review the document content and the automatically suggested metadata.
    *   They can edit the metadata (title, source, categories, keywords, tech level, etc.).
    *   They can add reviewer comments.
4.  **Decision:**
    *   **Approve:** The admin approves the document (calling `/api/admin/documents/approve`).
        *   The document status is updated to "approved".
        *   The document content is chunked using the defined strategy (`utils/documentProcessing/` or `utils/multiModalChunking.ts`).
        *   Contextual information may be added to chunks (`prepareTextForEmbedding`).
        *   Embeddings are generated for each chunk (`embeddingClient.ts`).
        *   Chunks and their embeddings are added to the `document_chunks` table and vector store (`vectorStore.ts`).
        *   The document becomes searchable in the main chat interfaces.
    *   **Reject:** The admin rejects the document (calling `/api/admin/documents/reject`).
        *   The document status is updated to "rejected".
        *   Reviewer comments are saved.
        *   The document is typically removed from the main view or archived.
5.  **Ongoing Management (`DocumentManagement.tsx`):**
    *   Admins can search, filter, and view approved documents.
    *   They can edit the metadata of approved documents.
    *   Editing metadata might trigger updates in associated chunks depending on the field.
    *   They can delete approved documents, which also removes associated chunks and their embeddings from the vector store.

## Chunk Management

Administrators have fine-grained control over the individual chunks derived from documents.

*   **Viewing (`DocumentChunkViewer.tsx`, `AllChunksViewer.tsx`):**
    *   View chunks associated with a specific document.
    *   View *all* chunks across the system, with filtering by document ID, text content, etc.
*   **Editing (`DocumentChunkViewer.tsx` / via API `PUT /api/admin/chunks/[id]`):**
    *   Modify the `text` content of a specific chunk.
    *   Optionally edit chunk-specific `metadata`.
*   **Embedding Regeneration:**
    *   When a chunk's `text` is edited via the API, the `regenerateEmbedding` flag can be set to `true`.
    *   This triggers the backend to generate a new vector embedding for the modified text using the `embeddingClient`.
    *   The new embedding replaces the old one in the `document_chunks` table, ensuring the vector store reflects the updated content.
*   **Deleting (via API `DELETE /api/admin/chunks/[id]`):**
    *   Remove individual chunks from the system.
    *   This also removes the corresponding row from the `document_chunks` table and its embedding from the vector store.

## API Endpoint Details

*(Referencing details primarily from `documentation/Admindocs.md` and `documentation/DMS-Technical-Specification.md`)*

### Documents API

*   `GET /api/admin/documents`: Lists documents.
    *   **Filters:** `search`, `category`, `status`, `date range`, `sort_by`, `sort_order`.
    *   **Pagination:** `page`, `limit`.
    *   **Response:** List of `Document` objects and pagination info.
*   `GET /api/admin/documents/[id]`: Gets a single document and its associated chunks.
    *   **Response:** `{ document: Document, chunks: DocumentChunk[] }`
*   `PUT /api/admin/documents/[id]`: Updates document properties (title, source, metadata, approved status).
    *   **Request Body:** Partial `Document` object.
    *   **Response:** Updated `Document` object.
*   `DELETE /api/admin/documents/[id]`: Deletes a document and its chunks.
    *   **Response:** Success message.
*   `POST /api/admin/documents/approve`: Approves pending documents (can be single or batch).
*   `POST /api/admin/documents/reject`: Rejects pending documents (can be single or batch, includes comments).

### Chunks API

*   `GET /api/admin/chunks`: Lists chunks.
    *   **Filters:** `document_id`, `search`, `sort_by`, `sort_order`.
    *   **Pagination:** `page`, `limit`.
    *   **Response:** List of `DocumentChunk` objects and pagination info.
*   `GET /api/admin/chunks/[id]`: Gets a single chunk.
    *   **Response:** `DocumentChunk` object (potentially including embedding).
*   `PUT /api/admin/chunks/[id]`: Updates chunk text and optionally regenerates embedding.
    *   **Request Body:** `{ text: string, regenerateEmbedding?: boolean }`
    *   **Response:** Updated `DocumentChunk` object and status message.
*   `DELETE /api/admin/chunks/[id]`: Deletes a chunk.
    *   **Response:** Success message.

## Technical Considerations

*   **Data Consistency:** Deleting a document must cascade to delete its associated chunks. Updating document metadata might require propagating changes to chunk metadata (handled via API logic or database triggers).
*   **Performance:** Efficient database indexing (on `documents` and `document_chunks` tables, including metadata fields used for filtering) is critical for admin dashboard performance.
*   **Error Handling:** Robust error handling is needed for API requests and background processing (like embedding generation).
*   **Security:** All admin API endpoints must be protected by authentication and authorization (see `docs/auth_details.md`).

The DMS provides the essential foundation for managing the knowledge base that powers the Sales Chat RAG system, enabling administrators to ensure content quality, relevance, and organization. 
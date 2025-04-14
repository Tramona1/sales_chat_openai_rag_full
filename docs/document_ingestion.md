# Document Ingestion Process

## Overview

This document outlines the step-by-step process by which new documents are ingested into the Sales Chat RAG system, processed, and made available for querying via the chat interfaces. This process ensures that only approved, properly formatted, and indexed content contributes to the system's knowledge base.

**Goal:** To provide a clear, reliable workflow for adding new information (documents, web pages) to the RAG system's knowledge base, including quality control, metadata enrichment, and indexing for search.

**For the Non-Technical Reader:** Adding new information to the AI's library follows these steps:
1.  **Upload:** An administrator adds a new document (like a PDF or Word file) or the system automatically grabs content from a website (using the web crawler).
2.  **First Check:** The system automatically reads the document, maybe suggests some labels (categories, keywords), and puts it in a "pending review" queue.
3.  **Human Review:** An administrator looks at the document and the suggested labels, corrects anything if needed, and makes sure the information is good quality and relevant.
4.  **Approval:** The administrator approves the document.
5.  **Processing & Indexing:** The approved document is broken down into smaller, digestible snippets (chunks). The system figures out the meaning of each snippet (creating an embedding) and adds it to the special "meaning index" (vector store) and the regular keyword index. 
6.  **Ready for Use:** The information from the document is now part of the AI's knowledge library and can be found when users ask relevant questions.

## Ingestion Sources

Content can enter the ingestion pipeline through several methods:

1.  **Manual Upload:** Administrators upload files (PDF, DOCX, TXT) via an interface likely interacting with `/api/documents/upload`.
2.  **Web Crawler (`Stagehand`):** The `universal_crawler.ts` script crawls websites (like `www.workstream.us`), extracts content and metadata, calculates a quality score, and saves the output as structured JSON files in a designated directory (e.g., `data/workstream_crawl_data_text_only`). A separate process or script would then monitor this directory and feed these JSON files into the ingestion pipeline.
3.  **Text Input:** Direct text input via an admin interface (potentially calling `/api/uploadText` or similar).

## Ingestion Workflow Steps

1.  **Submission & Initial Processing:**
    *   **Trigger:** A file is uploaded, text is submitted, or a crawled JSON file is detected.
    *   **Text Extraction:** The system extracts the raw text content from the source (e.g., using libraries for PDF/DOCX parsing).
    *   **Duplicate Check (Optional):** A hash of the content might be calculated and checked against existing documents to prevent ingesting exact duplicates.
    *   **Initial Save:** The document content, source information, and potentially a title are saved to the database (e.g., `documents` table or a `pending_documents` table) with a status of `pending`.

2.  **Automatic Metadata Extraction:**
    *   **Trigger:** Immediately after initial save.
    *   **Process:** The extracted text content is sent to an LLM (Gemini via `utils/geminiProcessor.ts`) for analysis.
    *   **Output:** The LLM suggests:
        *   Primary Category (mapped to `STANDARD_CATEGORIES`)
        *   Secondary Categories
        *   Keywords
        *   Technical Level
        *   Entities
        *   Summary
    *   **Save:** These suggested metadata fields are saved along with the pending document.

3.  **Admin Review & Approval (DMS - `PendingDocuments.tsx`):**
    *   **Interface:** Administrators access the pending document queue in the Admin Dashboard.
    *   **Review:** They examine the document content and the AI-suggested metadata.
    *   **Refinement:** Using metadata editing tools, they can correct/modify the title, source, categories, keywords, technical level, summary, etc.
    *   **Decision:**
        *   **Approve:** The admin clicks "Approve", triggering the next stage via `POST /api/admin/documents/approve`.
        *   **Reject:** The admin clicks "Reject", optionally adding comments, triggering `POST /api/admin/documents/reject`. The document status is set to `rejected`, and it does not proceed further.

4.  **Post-Approval Processing & Indexing:**
    *   **Trigger:** Successful call to `/api/admin/documents/approve`.
    *   **Status Update:** The document's status in the `documents` table is set to `approved`.
    *   **Chunking:** The approved document's final text content is processed by the chunking logic (`utils/documentProcessing/` or `utils/multiModalChunking.ts`). This divides the text into smaller, meaningful chunks based on configured strategies (e.g., paragraph breaks, token limits, potentially considering visual boundaries if multi-modal).
    *   **Contextual Preparation:** Each chunk's text may be pre-processed by `prepareTextForEmbedding` to prepend relevant context (e.g., document title/summary) before embedding.
    *   **Embedding Generation:** The prepared text for *each chunk* is sent to the embedding model (`utils/embeddingClient.ts`) to generate a 768-dimension vector embedding.
    *   **Vector Store Insertion:** Each chunk, along with its generated embedding and relevant metadata (document ID, chunk index, original text, contextual text, etc.), is saved as a new row in the `document_chunks` table in Supabase. The `utils/vectorStore.ts::addToVectorStore` function likely handles this database insertion.
    *   **Keyword Index Update:** The system needs to ensure the text used for keyword search (PostgreSQL FTS) is updated. This might involve:
        *   Directly updating the FTS index as chunks are added.
        *   Running a separate process (like `scripts/rebuild_corpus_stats.ts` or a Supabase function) periodically or after batches of documents are approved to rebuild/update the necessary keyword statistics (e.g., BM25) based on the *contextual* text representation stored in the `document_chunks` table.

5.  **Availability:**
    *   Once the chunks are successfully saved and indexed in both the vector store (`document_chunks` table with embeddings) and the keyword search index, the content from the ingested document becomes available for retrieval by the Hybrid Search stage of the RAG pipeline (`utils/hybridSearch.ts`) and can contribute to answers in the chat interfaces.

This structured ingestion process, combining automated analysis with human oversight, is crucial for building and maintaining a high-quality, relevant, and searchable knowledge base for the RAG system. 
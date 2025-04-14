# Vector Store Management

## Overview

This document describes how the Sales Chat RAG system manages vector embeddings, which are crucial for semantic search. It covers embedding generation, storage in Supabase using the `pgvector` extension, and the retrieval process.

**Goal:** To efficiently store and retrieve numerical representations (embeddings) of document chunks, enabling the system to find content based on semantic meaning rather than just keywords.

**For the Non-Technical Reader:** Think of the vector store as a specialized library index that understands the *meaning* of text. When you upload a document, it's broken into smaller pieces (chunks).
1.  **Understanding Meaning:** Each chunk is read by an AI (the embedding model), which creates a special code (a vector embedding) that represents its meaning.
2.  **Storing the Code:** This code is stored in a database (Supabase) specifically designed to handle these meaning-based codes (`pgvector`).
3.  **Finding Similar Meanings:** When you ask a question, your question is also converted into a code. The system then quickly searches the database for stored codes that are numerically similar to your question's code. This finds chunks with similar meanings, even if they don't use the exact same words.

## Key Components

*   **Embedding Model:** An AI model (specifically Google's `models/text-embedding-004`) that converts text into high-dimensional numerical vectors (768 dimensions in this case).
*   **Embedding Client (`utils/embeddingClient.ts`):** A utility that interacts with the embedding model's API (Google AI API) to generate embeddings for text chunks. It handles batching and task-specific embedding types (`RETRIEVAL_QUERY` for queries, `RETRIEVAL_DOCUMENT` for stored chunks).
*   **Supabase Database:** A PostgreSQL database used for storing document metadata and chunk information.
*   **`pgvector` Extension:** A PostgreSQL extension installed in Supabase that adds specialized data types (e.g., `VECTOR(768)`) and functions for storing and querying vector embeddings efficiently.
*   **`document_chunks` Table:** The primary Supabase table storing individual document chunks, including their text content, metadata, and the corresponding vector embedding.
*   **Vector Store Utility (`utils/vectorStore.ts`):** Contains functions for interacting with the `document_chunks` table, specifically for adding new chunks with embeddings and performing similarity searches.
*   **Supabase RPC Functions (e.g., `search_vectors`):** Custom database functions defined in Supabase to perform optimized vector similarity searches (like cosine similarity) combined with metadata filtering.

## Embedding Generation Process

1.  **Input:** A text chunk (potentially enhanced with context via `prepareTextForEmbedding`).
2.  **Client Interaction:** The `embeddingClient.embedBatch` function is called with the text chunk(s) and the task type `RETRIEVAL_DOCUMENT`.
3.  **API Call:** The `embeddingClient` sends the text to the Google AI API for the `models/text-embedding-004` model.
4.  **Vector Received:** The API returns a 768-dimension numerical vector representing the semantic meaning of the input text.
5.  **Output:** The generated embedding vector.

## Storage in Supabase

*   **Schema:** The `document_chunks` table in Supabase has an `embedding` column defined with the data type `VECTOR(768)` provided by `pgvector`.
*   **Indexing:** For efficient querying, an index is created on the `embedding` column. Common choices provided by `pgvector` include:
    *   **IVFFlat:** Good balance of speed and accuracy, suitable for many use cases.
    *   **HNSW:** Often faster for high-dimensional data but can use more memory/build time.
The specific index type and its parameters (like `lists` for IVFFlat) should be chosen based on the dataset size and performance requirements.
*   **Insertion:** When a new document is processed and chunked, the generated embedding for each chunk is inserted into the `embedding` column of the corresponding row in the `document_chunks` table. This is typically handled by functions within `utils/vectorStore.ts` (like `addToVectorStore`).

## Vector Similarity Search Process

1.  **Query Embedding:** The user's query is first embedded using the `embeddingClient` with the task type `RETRIEVAL_QUERY` to get a 768-dimension query vector.
2.  **Function Call:** The `utils/vectorStore.ts::getSimilarItems` function is called, passing the query vector and any metadata filters (`HybridSearchFilter`).
3.  **Supabase RPC Execution:** `getSimilarItems` invokes a custom Supabase Remote Procedure Call (RPC) function (e.g., `search_vectors`).
4.  **Database Operation:** Inside the RPC function, `pgvector` performs the core similarity search:
    *   It calculates the distance (often cosine distance, represented by the `<=>` operator) between the query vector and the stored `embedding` vectors in the `document_chunks` table.
    *   It applies any specified metadata filters (e.g., `WHERE metadata->>'primaryCategory' = $1`).
    *   It orders the results by distance (closer distance means more similar) and returns the IDs and distances (scores) of the top N most similar chunks that match the filters.
5.  **Results Returned:** The RPC function returns the list of matching chunk IDs and their similarity scores back to the `getSimilarItems` function.
6.  **Output:** `getSimilarItems` returns the retrieved chunks (often fetching their full data based on the IDs) ordered by semantic similarity to the query.

**Example SQL (Conceptual - simplified within RPC):**

```sql
SELECT
  id,
  document_id,
  text,
  metadata,
  embedding <=> $query_embedding AS similarity_score -- $query_embedding is the 768-dim query vector
FROM
  document_chunks
WHERE
  metadata->>'primaryCategory' = $category_filter -- Example filter
ORDER BY
  similarity_score ASC -- Cosine distance: Lower is more similar
LIMIT $limit;
```

## Importance of Consistency

*   **Model:** The *same* embedding model (`models/text-embedding-004`) *must* be used for both indexing documents (`RETRIEVAL_DOCUMENT`) and embedding queries (`RETRIEVAL_QUERY`). Using different models will result in meaningless similarity scores.
*   **Dimension:** The vector dimension configured in the database (`VECTOR(768)`) *must* match the output dimension of the embedding model.
*   **Task Type:** Using the correct task type (`RETRIEVAL_DOCUMENT` vs `RETRIEVAL_QUERY`) is recommended by Google, as it can optimize the embedding for its specific use case (storage vs. search).

By managing vectors effectively through this process, the system enables powerful semantic search capabilities, forming a core part of the RAG pipeline's retrieval stage. 
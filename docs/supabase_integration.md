# Supabase Integration

## Overview

This document outlines how Supabase is utilized as the primary backend-as-a-service platform for the Sales Chat RAG system. Supabase provides several key infrastructure components, simplifying development and deployment.

**Goal:** To consolidate information on the various Supabase services used by the application and how they are integrated.

**For the Non-Technical Reader:** Supabase is like a pre-built foundation and set of specialized storage services that the application uses. Instead of building everything from scratch, we use Supabase for:
*   **Main Database:** Storing all the basic information (like document details, user info).
*   **Meaning Index:** A special database feature (`pgvector`) for storing and searching the "meaning codes" (embeddings) of text snippets.
*   **Login System:** Handling user logins and security (recommended for admins).
*   **File Storage:** A place to store uploaded files (like PDFs or images) if needed.
*   **Smart Database Functions:** Allows creating custom, optimized functions directly within the database (like the fast search function for the meaning index).

## Key Supabase Services Used

1.  **PostgreSQL Database:**
    *   **Purpose:** Serves as the primary relational database for storing structured application data.
    *   **Key Tables:**
        *   `documents`: Stores metadata, status, and source information for ingested documents.
        *   `document_chunks`: Stores the individual text chunks derived from documents, along with chunk-specific metadata.
        *   Potentially tables for `users`, `chat_sessions`, `chat_messages`, `chat_message_resources` if full user chat history and authentication are implemented.
        *   Potentially tables for `roles`, `user_roles` if RBAC is implemented.
    *   **Interaction:** Accessed via the Supabase client (`utils/supabaseClient.ts`) using standard SQL queries or Supabase's JavaScript library functions (e.g., `supabase.from('documents').select('*')`).

2.  **`pgvector` Extension:**
    *   **Purpose:** Enables efficient storage and similarity searching of high-dimensional vector embeddings within the PostgreSQL database.
    *   **Implementation:**
        *   The `pgvector` extension must be enabled in the Supabase project dashboard.
        *   The `document_chunks` table uses the `VECTOR(768)` data type for the `embedding` column to store Gemini embeddings.
        *   Specialized indexes (IVFFlat or HNSW) are created on the `embedding` column for fast querying.
    *   **Interaction:** Vector similarity searches are performed using `pgvector` operators (like `<=>` for cosine distance) typically encapsulated within Supabase RPC functions (see below) and accessed via `utils/vectorStore.ts`.
    *   **Reference:** [docs/vector_store_management.md](./vector_store_management.md)

3.  **Supabase Auth:**
    *   **Purpose:** Provides a complete authentication and authorization system.
    *   **Implementation Status:** Currently recommended but likely using a placeholder. A full implementation is needed for production.
    *   **Integration:** Involves using Supabase Auth helpers (`@supabase/auth-helpers-nextjs`) on the frontend for login/session management and on the backend (API routes/middleware) for protecting administrative endpoints.
    *   **Reference:** [docs/auth_details.md](./auth_details.md)

4.  **Supabase Storage:**
    *   **Purpose:** Provides scalable object storage for files.
    *   **Potential Uses:**
        *   Storing original uploaded document files (PDFs, DOCX).
        *   Storing generated images or visuals associated with documents or chunks (e.g., if `ImageAnalyzer` saves extracted images).
        *   Storing user-uploaded resources in chat messages.
    *   **Interaction:** Accessed via the Supabase client library (`supabase.storage.from('bucket-name').upload(...)` or `.download(...)`). Requires configuring storage buckets and access policies in the Supabase dashboard.

5.  **Supabase Edge Functions / RPC Functions:**
    *   **Purpose:** Allow defining custom, performant functions directly within the database (RPC) or at the edge.
    *   **Implementation:**
        *   **RPC Functions:** Primarily used for optimized database operations, especially vector search combined with filtering. A function like `search_vectors(query_embedding, filter_criteria)` is likely defined in SQL within the Supabase dashboard.
        *   **Edge Functions (Optional):** Could be used for tasks requiring proximity to the user or specific backend logic not suitable for standard API routes.
    *   **Interaction:** RPC functions are called from the backend using the Supabase client (`supabase.rpc('function_name', { args })`).

## Client Initialization (`utils/supabaseClient.ts`)

*   A central utility initializes and exports a Supabase client instance.
*   It uses the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY` for client-side interactions) environment variables.
*   Using the `SERVICE_ROLE_KEY` on the backend allows bypassing Row Level Security (RLS) policies when necessary for administrative tasks, but requires careful handling to avoid unintended data access.

## Security Considerations

*   **API Keys:** Store Supabase URL, service role key, and anon key securely as environment variables. **Never expose the service role key to the frontend.**
*   **Row Level Security (RLS):** Implement RLS policies on tables containing sensitive or user-specific data to enforce data access rules at the database level. This is crucial even when using the service role key on the backend.
*   **Database Policies:** Configure appropriate access policies for Storage buckets.

Supabase provides a powerful and integrated backend foundation for the Sales Chat RAG system, significantly accelerating development by handling core database, vector, auth, and storage needs. 
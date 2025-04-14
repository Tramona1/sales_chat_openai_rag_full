# RAG System Improvement Roadmap

This document outlines the steps to address identified inconsistencies, improve data quality, and optimize the RAG system.

## Phase 1: Code Preparation & Cleanup (Completed)

**Goal:** Ensure the code that processes text for embedding is consistent, fix outstanding type errors, and align TypeScript with the updated database function.

**Actions Taken:**

1.  **Standardized Embedding Preprocessing (`utils/embeddingClient.ts`):**
    *   Modified `embedText` and `embedBatch` to use only `text.replace(/\s+/g, ' ').trim()` for cleaning before sending to the embedding API. Ensures uniform whitespace handling and consistency between runtime and indexing.

2.  **Standardized Indexing Preprocessing:**
    *   **`scripts/process_crawl_and_store.ts`:** Removed the call to `prepareTextForEmbedding`. Now passes only the cleaned `chunk.text` to `embedBatch`. Stores the cleaned text (that was embedded) in the `text` column.
    *   **`utils/documentProcessor.ts`:** Removed the logic that prepended the document summary to chunk text before embedding. Now passes `chunk.text` directly.

3.  **Standardized Chunking Preprocessing (`utils/documentProcessing.ts`):**
    *   Verified that the initial cleaning in `splitIntoChunks` already uses `text.replace(/\s+/g, ' ').trim()`. No change needed.

4.  **Fixed TypeScript Errors:**
    *   Resolved `QueryAnalysis` vs. `LocalQueryAnalysis` type conflict by standardizing on `LocalQueryAnalysis` (defined in `utils/queryAnalysis.ts`) in `utils/queryRouter.ts`. Removed unused `QueryAnalysis` import. Updated relevant function signatures and type annotations.
    *   Confirmed `DocumentCategoryType` usage in `utils/queryRouter.ts` appears correct (imports from `utils/documentCategories.ts`).
    *   Deferred detailed check of `visualContent` type issues, as they didn't seem directly problematic in `queryRouter.ts`'s main flow (may reside in reranker or formatting).

5.  **Aligned SQL & Code (`utils/queryRouter.ts` & Database):**
    *   **Database:** Confirmed the `hybrid_search` SQL function in Supabase was successfully updated (`CREATE OR REPLACE FUNCTION ...`) to use the correct logic (including `websearch_to_tsquery`) and a default `match_threshold` of 0.2.
    *   **`utils/queryRouter.ts`:** Restored the `matchThreshold` option in `hybridSearchOptions`, ensuring it defaults correctly (`?? 0.2`).

## Phase 2: Clean Data Ingestion & Re-Indexing (Next Steps - Pending Re-Crawl)

**Goal:** Populate the database with high-quality, consistently processed data and embeddings using the cleaned-up code.

**Actions:**

1.  **Wait for Re-crawl:** Ensure the improved web crawler has finished gathering the new, cleaner source content.
2.  **Clear Old Data:** Delete all existing rows from the `public.document_chunks` table in Supabase. This prevents mixing old/bad data with new.
    ```sql
    -- !! WARNING: Deletes all existing chunk data !!
    TRUNCATE TABLE public.document_chunks;
    -- Or DELETE FROM public.document_chunks; if TRUNCATE requires higher privileges
    ```
3.  **Run Full Indexing Pipeline:** Execute the updated indexing script (e.g., `scripts/process_crawl_and_store.ts`) on the **newly crawled data**. This pipeline now incorporates the standardized cleaning and embedding logic from Phase 1. It will:
    *   Chunk the clean content.
    *   Embed only the cleaned `chunk.text`.
    *   Generate the `text_search_vector`.
    *   Insert everything into the `document_chunks` table.

## Phase 3: Testing & Verification (Execute After Re-Indexing Completes)

**Goal:** Confirm that the core retrieval now returns relevant results for previously failing queries using the new data and consistent processing.

**Actions:**

1.  **Test Primary Query:** In the chat application, ask "what is our product suite?".
2.  **Analyze Logs:** Check server logs for:
    *   `[hybridSearch] Data received from RPC:` -> Should NOT be `[]`. Expect results.
    *   `[RouteQuery] Results BEFORE rerank` -> Examine `vector_score` and `bm25Score`. Are they non-zero for relevant chunks?
    *   `[RouteQuery] Results AFTER rerank/final processing` -> Are relevant results preserved? How did scores change?
3.  **Analyze Chat Response:** Did the AI generate an accurate answer based on the retrieved context?
4.  **Test Other Queries:** Try queries related to specific products mentioned on the `/platform` page or other previously problematic topics.

## Phase 4: Tuning & Optimization (Iterative Process Based on Phase 3 Results)

**Goal:** Fine-tune parameters and prompts to improve the relevance, ranking, and final answer quality.

**Actions (Iterate as needed):**

1.  **Tune `match_threshold`:** Adjust the threshold passed from `queryRouter.ts` based on observed vector scores.
2.  **Tune Hybrid Weights:** Adjust `vectorWeight` / `keywordWeight` in `queryRouter.ts`.
3.  **Tune Reranker:** Adjust `rerankCount`, refine `reranking.ts` system prompt, potentially add quality scoring.
4.  **Tune Answer Generation:** Refine the RAG prompt in `answerGenerator.ts` for better synthesis and handling edge cases.

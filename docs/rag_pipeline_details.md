# RAG Pipeline Details

## Overview

This document provides an in-depth explanation of the Retrieval-Augmented Generation (RAG) pipeline used in the Sales Chat system. The RAG pipeline is the core engine that transforms a user's query into a relevant, context-aware, and accurate answer by leveraging a knowledge base of documents and advanced AI models.

**Goal:** To provide the most relevant and accurate answer to a user's query by finding the best information from the knowledge base and synthesizing it into a coherent response.

**For the Non-Technical Reader:** Imagine asking a question to a super-powered research assistant. The RAG pipeline is the process the assistant follows:
1.  **Understand the Question:** Figure out what the user is really asking, including if they need visual information.
2.  **Find Relevant Documents:** Search through a library (the vector store) using both meaning (semantic search) and specific keywords (keyword search) to find documents or snippets that might contain the answer. Apply filters (like category or technical level) to narrow down the search.
3.  **Rank the Findings:** Read through the found snippets and rank them based on how relevant they are to the specific question, paying extra attention if the question was visual. It also considers how trustworthy the source snippet is (content quality).
4.  **Prepare the Best Information:** Select the top-ranked snippets and organize them neatly, summarizing if necessary to keep it concise. Prepare notes on where the information came from (citations).
5.  **Write the Answer:** Use the selected information and the original question (plus conversation history) to write a clear, comprehensive answer, citing sources.
6.  **Format the Output:** Present the answer cleanly in the chat interface.

## Pipeline Stages

The RAG pipeline consists of several distinct stages, orchestrated primarily by backend API logic calling various utility functions:

### 1. Query Analysis

*   **Goal:** Understand the user's intent and needs beyond the literal text.
*   **Implementation:** `utils/queryAnalysis.ts`
*   **Process:**
    *   **Intent Analysis (Optional):** Determine if the query is informational, conversational, transactional, etc.
    *   **Entity Extraction (Optional):** Identify key entities (people, places, products, concepts) mentioned in the query.
    *   **Visual Focus Detection:** Analyze the query to determine if the user is explicitly asking for or likely needs visual information (e.g., "Show me a chart of...", "What does the UI look like?", "Find an image of..."). This uses pattern matching and semantic analysis (`analyzeVisualQuery`). The confidence level of this prediction is also determined.
    *   **Visual Type Classification:** If visual focus is detected, identify the specific types of visuals requested (e.g., chart, table, diagram, screenshot).
*   **Output:** An analyzed query object containing the original query, identified entities, detected intent, visual focus flag, confidence score, and requested visual types.
*   **Why:** Understanding the nuances of the query allows downstream processes (like search and reranking) to be tailored for better results. Identifying visual needs is crucial for multi-modal retrieval.

### 2. Hybrid Search

*   **Goal:** Retrieve a set of potentially relevant document chunks from the knowledge base using a combination of search techniques.
*   **Implementation:** `utils/hybridSearch.ts`, `utils/vectorStore.ts` (using Supabase RPC), PostgreSQL FTS features.
*   **Process:**
    *   **Input:** Analyzed query (including query text and embedding), filtering criteria (categories, technical level, keywords, etc. from `HybridSearchFilter`).
    *   **Vector Search (Semantic):**
        *   Uses the query embedding to find chunks with semantically similar content stored in the Supabase `document_chunks` table.
        *   Leverages the `pgvector` extension and a Supabase RPC function (e.g., `search_vectors`) for efficient cosine similarity search against the `embedding` column (VECTOR(768)).
        *   Managed via `utils/vectorStore.ts::getSimilarItems`.
    *   **Keyword Search (Lexical):**
        *   Uses PostgreSQL's Full-Text Search (FTS) capabilities (`to_tsvector`, `to_tsquery`, `ts_rank`) to find chunks containing exact or related keywords from the query.
        *   Searches against the indexed text content (specifically, the `text` field which includes contextual information).
        *   Requires a GIN index on the text column for performance.
    *   **Metadata Filtering:** Both search methods apply filters based on the provided `HybridSearchFilter` criteria *before* retrieving results. This significantly narrows the search space and improves relevance. Common filters include:
        *   `primaryCategory` / `secondaryCategories`
        *   `technicalLevel`
        *   `requiredEntities`
        *   `keywords` (searched against metadata keywords)
        *   `excludeDocumentIds` / `includeDocumentIds`
    *   **Result Combination:** The results from vector search and keyword search are combined. A weighting mechanism (configurable, e.g., `vectorWeight`, `keywordWeight`) might be used to favor one type of search over the other depending on the query or configuration, although the primary combination happens implicitly by retrieving candidates from both and letting the reranker sort them out.
*   **Output:** A list of candidate `DocumentChunk` objects, each with an initial relevance score (from vector distance or text rank).
*   **Why:** Combining semantic search (understands meaning) and keyword search (finds specific terms) yields more robust retrieval than either method alone, capturing a wider range of relevant information. Pre-filtering makes the search much more efficient.

### 3. Reranking

*   **Goal:** Reorder the candidate chunks retrieved by the hybrid search to place the most relevant ones at the top, considering query relevance, visual context, and content quality.
*   **Implementation:** `utils/reranking.ts::rerankWithGemini`
*   **Process:**
    *   **Input:** The list of candidate chunks from the hybrid search stage, the original analyzed query (including visual focus details).
    *   **LLM Evaluator (Gemini):** The candidate chunks (including their text, visual descriptions if any, category, and content quality score) are formatted and sent to a powerful LLM (Gemini) with a specialized prompt.
    *   **Evaluation Criteria:** The LLM evaluates each chunk based on:
        *   **Textual Relevance:** How well the chunk's text answers the query.
        *   **Visual Relevance (if applicable):** If the query had visual focus, how well the chunk's described visual content (images, charts, tables) matches the request. Specific visual type matches are strongly preferred.
        *   **Content Quality Score:** The `content_quality_score` (0-1) generated during the initial web crawl is used as a secondary signal. Higher quality scores are slightly preferred among similarly relevant chunks, while very low scores might slightly penalize borderline relevant chunks.
        *   **Down-ranking Rules:** Specific rules are applied, such as significantly down-ranking chunks categorized as `HIRING` or `JOB_POSTING` unless the query explicitly asks about jobs/careers.
    *   **Scoring:** The LLM assigns a relevance score (e.g., 0-10, normalized to 0-1) and a brief justification reason to each chunk.
    *   **Fallback Mechanism:** If the Gemini reranker fails or times out, a heuristic-based fallback (`applyFallbackReranking`) is used. This fallback applies simpler score adjustments based on factors like visual content presence, visual type matching, and query visual focus.
*   **Output:** A sorted list of `RankedSearchResult` objects, ordered by the reranked relevance score, limited to the desired number (e.g., top 5). Each result includes the original chunk, the new score, the original score, and potentially an explanation.
*   **Why:** Simple retrieval scores (vector distance, keyword rank) are often not nuanced enough. LLM-based reranking allows for a deeper semantic understanding of relevance, considers multi-modal aspects explicitly, incorporates source quality, and applies custom business logic (like down-ranking job postings), leading to significantly better final context.

### 4. Context Creation

*   **Goal:** Prepare the final context to be sent to the answer generation model, ensuring it's concise, relevant, and properly formatted.
*   **Implementation:** Primarily within `utils/answerGenerator.ts` logic.
*   **Process:**
    *   **Input:** The top-ranked, reranked list of `RankedSearchResult` objects.
    *   **Selection:** Select the top N results (e.g., top 3-5) based on the reranked scores.
    *   **Deduplication (Optional):** Remove duplicate or highly overlapping content snippets.
    *   **Formatting:** Extract the `originalText` (the clean, non-contextualized text) from each selected chunk. Format visual information (descriptions, types, potentially unique IDs/URLs from `visualContent`) if present and relevant.
    *   **Summarization (Conditional):** If the combined length of the selected `originalText` snippets exceeds the token limit for the answer generation model, use an LLM (Gemini via `summarizeContext`) to summarize the context while preserving key information and source attribution.
    *   **Citation Preparation:** Prepare source citations for each included snippet (e.g., document title, chunk ID, potentially URLs or page numbers from metadata).
*   **Output:** A formatted context string containing the most relevant text snippets (potentially summarized) and structured visual information, plus a list of source citations.
*   **Why:** Provides the answer generation model with the highest quality, most relevant information distilled from the knowledge base, within its operational token limits. Separating `originalText` ensures the LLM gets clean source material. Preparing citations enables grounded and trustworthy answers.

### 5. Answer Generation

*   **Goal:** Synthesize a final, coherent answer based on the user's query, conversation history, and the prepared context.
*   **Implementation:** `utils/answerGenerator.ts` (using `utils/openaiClient.ts` or `utils/geminiClient.ts`)
*   **Process:**
    *   **Input:** Original query, conversation history, formatted context string (including visual info), and source citations.
    *   **Model Selection:** Choose the primary LLM (e.g., OpenAI GPT-4) or fallback (e.g., Gemini Pro) based on configuration (`utils/modelConfig.ts`).
    *   **Prompt Engineering:** Construct a detailed prompt instructing the LLM to:
        *   Answer the user's query directly.
        *   Base the answer *only* on the provided context.
        *   Incorporate information smoothly.
        *   Reference visual elements appropriately using their descriptions/IDs if visual context was provided.
        *   Cite sources using the provided citation data.
        *   Maintain a specific tone or persona (e.g., helpful sales assistant).
        *   Handle conversational elements if present in the history.
        *   Provide a helpful response even if no relevant context was found (zero-result scenario).
    *   **LLM Call:** Send the constructed prompt to the selected LLM API.
*   **Output:** A generated text answer, potentially including formatted citations and references to visual elements.
*   **Why:** Leverages the generative power of LLMs to synthesize information from multiple sources into a single, easy-to-understand answer, rather than just presenting raw search results. Integrating conversation history allows for follow-up questions and natural dialogue.

### 6. Response Formatting

*   **Goal:** Structure the final answer for display in the chat interface.
*   **Implementation:** Backend API route logic (e.g., `/api/chat`) and frontend components (`components/ChatMessage.tsx`).
*   **Process:**
    *   **Input:** The raw generated answer text from the LLM, citation data, and any visual element IDs/URLs.
    *   **Structuring:** Format the response into a structured object suitable for the frontend (e.g., containing the answer text, a list of sources, and a list of image URLs).
    *   **Markdown Rendering (Frontend):** The frontend typically renders the answer text as Markdown, allowing for formatting like lists, bold text, etc.
    *   **Citation Display (Frontend):** Display citations clearly, often linked to the specific parts of the answer they support.
    *   **Visual Display (Frontend):** If image URLs/IDs were included, the frontend fetches (via `/api/visuals/:id` or directly from a URL) and displays the corresponding images alongside the text.
*   **Output:** A fully formatted chat message displayed to the user, potentially including text, interactive citations, and images.
*   **Why:** Presents the generated information in a clear, user-friendly, and interactive format within the chat application.

This detailed pipeline ensures that the Sales Chat system can effectively understand user needs, retrieve relevant multi-modal information, and generate accurate, trustworthy, and contextually appropriate answers. 
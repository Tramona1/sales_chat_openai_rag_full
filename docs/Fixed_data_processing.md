# Fixed Data Processing Strategy (v2 - Automated Enrichment)

**Goal:** To implement a robust, automated data processing pipeline that addresses identified inconsistencies and enriches document chunks with better context and metadata *before* re-indexing the knowledge base. This strategy prioritizes scalable solutions over manual content editing.

**Context:** This plan incorporates findings from the initial content audit (Action 1.3) and validates the need to fix core processing issues before large-scale re-indexing, as discussed.

## 1. Key Issues Addressed by this Strategy

1.  **Inconsistent Text Preprocessing:** Text was cleaned differently before embedding during indexing versus at query time, leading to vector mismatch.
2.  **Faulty FTS Vector Generation:** The `text_search_vector` column required for keyword search was not being populated correctly.
3.  **Suboptimal Crawler Extraction:** Source content contained boilerplate and sometimes missed crucial body text (addressed externally by crawler improvements).
4.  **Chunking Fragmentation:** The previous strategy likely split related content (lists, definitions) across chunks.
5.  **Unreliable Metadata:** LLM-generated categories were inconsistent; reliable signals like URL structure were not used during indexing.
6.  **Missing Context in Chunks:** Important document-level information (like explicitly identified CEO/CTO names) wasn't available within individual chunk metadata for retrieval.

## 2. Detailed Action Plan (Code Implementation)

This plan details the necessary code changes within the existing file structure.

**Action 1: Unify Text Preprocessing (CRITICAL)**

*   **Goal:** Ensure identical, minimal text cleaning is applied *only* before embedding generation, both during indexing and at query time.
*   **Files & Logic:**
    *   **`utils/embeddingClient.ts`:**
        *   Verify/Ensure the `embedText` and `embedBatch` methods (specifically within the active `GeminiEmbeddingClient`) apply *only* `text.replace(/\s+/g, ' ').trim()` to the input text immediately before sending it to the embedding API.
    *   **`scripts/process_crawl_and_store.ts`:**
        *   Locate the section where embeddings are generated (calling `embeddingClient.embedBatch`).
        *   **Crucially:** Ensure the input `textsToEmbed` passed to `embedBatch` contains *only* the raw `chunk.text` from the chunking process. **Remove any logic** that prepends summaries or uses `prepareTextForEmbedding` to add context *before* this embedding step. The `embeddingClient` now handles the minimal cleaning.
    *   **`utils/documentProcessor.ts`:** (If this file is used in any active ingestion workflows)
        *   Apply the same check as for `scripts/process_crawl_and_store.ts`: ensure only raw `chunk.text` is passed to `embedBatch`. Remove pre-embedding context addition.
    *   **`utils/documentProcessing.ts`:**
        *   Within `splitIntoChunks` (or its helpers like `splitRegularContent`), ensure the initial text cleaning uses `text.replace(/\s+/g, ' ').trim()` before any splitting occurs.
    *   **`utils/hybridSearch.ts`:**
        *   Verify that when the `queryEmbedding` is generated using `embeddingClient.embedText` (or `embedBatch`), the *query text* passed to it also undergoes *only* the identical `query.replace(/\s+/g, ' ').trim()` cleaning.
*   **Expected Outcome:** Text embeddings will be generated based on consistently processed text, enabling reliable semantic similarity matching between queries and indexed chunks.

**Action 2: Ensure FTS Vector Generation**

*   **Goal:** Guarantee the `text_search_vector` column is correctly defined and populated by PostgreSQL for keyword search.
*   **Location:** Supabase Dashboard (SQL Editor) or via a database migration tool.
*   **Action:**
    1.  **Verify Schema:** Execute `\d+ public.document_chunks` in the Supabase SQL Editor. Look for the `text_search_vector` column.
    2.  **Confirm Definition:** Ensure its definition includes `GENERATED ALWAYS AS (to_tsvector('english'::regconfig, text)) STORED`.
    3.  **Fix if Needed:** If missing or incorrect, run the appropriate `ALTER TABLE` command:
        ```sql
        -- If column exists but definition is wrong:
        ALTER TABLE public.document_chunks
        DROP COLUMN IF EXISTS text_search_vector; -- Drop if exists to redefine cleanly

        -- Add the correctly defined generated column:
        ALTER TABLE public.document_chunks
        ADD COLUMN text_search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('english'::regconfig, text)) STORED;

        -- Optional: Add index for faster keyword search
        CREATE INDEX IF NOT EXISTS idx_chunks_fts ON public.document_chunks USING GIN (text_search_vector);
        ```
    4.  **Confirm Input:** Ensure the base `text` column in `document_chunks` (which the generated column depends on) is being populated with valid, non-null text during insertion in `scripts/process_crawl_and_store.ts` or `utils/vectorStoreFactory.ts::addToVectorStore` (via `supabaseClient.insertDocumentChunks`).
*   **Expected Outcome:** PostgreSQL will automatically manage the `text_search_vector`, enabling the keyword search component (`... @@ to_tsquery(...)`) of `hybrid_search`.

**Action 3: Confirm Crawler Improvements (External Check)**

*   **Goal:** Ensure the input data from the *new* crawl is high quality.
*   **File:** `stagehand/examples/universal_crawler.ts` (and its output).
*   **Action:** Confirm (through code review or discussion with the implementer) that the latest version of the crawler effectively removes boilerplate (headers, footers, common nav, irrelevant CTAs) and successfully extracts the main content body, especially from previously problematic pages (e.g., `/payroll/employee-experience`). Manually inspect a few key JSON output files from the new crawl data to verify content quality.
*   **Expected Outcome:** The indexing pipeline receives cleaner, more relevant text, improving both vector and keyword search potential.

**Action 4: Refine Chunking Strategy**

*   **Goal:** Create more semantically coherent chunks, reducing fragmentation.
*   **Files:**
    *   `scripts/process_crawl_and_store.ts` (for `DEFAULT_CHUNK_SIZE`)
    *   `utils/documentProcessing.ts` (for `splitIntoChunksWithContext` and its underlying helpers like `splitRegularContent`, `splitStructuredContent`)
*   **Logic Modifications:**
    1.  **Test `DEFAULT_CHUNK_SIZE`:** In `scripts/process_crawl_and_store.ts`, change `DEFAULT_CHUNK_SIZE` from `500`. Start testing with `600` or `700`.
    2.  **Improve Boundary Logic:** In `utils/documentProcessing.ts` (within the splitting functions):
        *   Modify the splitting algorithm to give strong preference to splitting on `\n\n` (representing paragraph breaks). Only split mid-paragraph or mid-sentence if a segment significantly exceeds the `chunkSize`.
        *   *Defer complex structure handling (lists, headings) for now* to focus on core boundary improvements first, unless list fragmentation (like Investors) is deemed the highest priority issue after size/paragraph adjustments.
*   **Expected Outcome:** Reduced likelihood of splitting related sentences or list items, providing more contextually complete chunks for embedding and analysis.

**Action 5: Implement URL-Based Categorization**

*   **Goal:** Add reliable, rule-based category metadata derived from URL structure.
*   **File:** `scripts/process_crawl_and_store.ts`
*   **Location:** Inside the main processing loop (`batchDocs.map(async (doc) => { ... }`) *before* preparing the `documentRecord`.
*   **Implementation:**
    ```typescript
    // --- Add this block ---
    let derivedCategory: DocumentCategoryType = DocumentCategoryType.GENERAL; // Default
    try {
        const urlPath = new URL(doc.url).pathname.toLowerCase();
        // Example rules - EXPAND THESE based on utils/tagUtils.ts::STANDARD_CATEGORIES and your site structure
        if (urlPath.startsWith('/platform') || urlPath.startsWith('/features') || urlPath.startsWith('/product')) {
            derivedCategory = DocumentCategoryType.PRODUCT; // Adjust based on your enum
        } else if (urlPath.startsWith('/blog')) {
            derivedCategory = DocumentCategoryType.BLOG; // Add BLOG to enum if needed
        } else if (urlPath.startsWith('/about') || urlPath.startsWith('/team') || urlPath.startsWith('/company')) {
            derivedCategory = DocumentCategoryType.COMPANY_INFO; // Add COMPANY_INFO if needed
        } else if (urlPath.startsWith('/investors')) {
            derivedCategory = DocumentCategoryType.INVESTORS; // Add INVESTORS if needed
        } else if (urlPath.includes('pricing')) {
            derivedCategory = DocumentCategoryType.PRICING;
        } else if (urlPath.startsWith('/careers') || urlPath.startsWith('/jobs')) {
             derivedCategory = DocumentCategoryType.CAREERS; // Add CAREERS if needed
        }
        logger.info(`Derived category '${derivedCategory}' from URL: ${doc.url}`);
    } catch (urlError) {
        logger.warning(`Could not parse URL for category derivation: ${doc.url}`, urlError);
    }
    // --- End added block ---

    // --- Modify metadata preparation ---
    // When preparing documentRecord.metadata:
    metadata: {
        // ... other existing metadata ...
        urlDerivedCategory: derivedCategory, // Store the derived category
        sourceType: 'web_crawl',
        crawlTimestamp: doc.timestamp,
        ...(doc.metadata || {}) // Ensure original crawl metadata is preserved if needed
    }

    // When preparing chunkRecords (inside the .map):
    metadata: {
        ...(chunk.metadata || {}), // Keep existing chunk metadata
        urlDerivedCategory: derivedCategory, // Add derived category to chunk metadata
        // ... Ensure other essential doc metadata is also propagated here ...
        // E.g., primaryCategory: analysisResult.primaryCategory, // (From LLM analysis)
        // technicalLevel: analysisResult.technicalLevel
    },
    ```
*   **Expected Outcome:** All documents and chunks will have a consistent `urlDerivedCategory` in their metadata, usable for reliable filtering or future routing logic.

**Action 6: Implement LLM Document Context Enrichment**

*   **Goal:** Inject document-level summary and key extracted entities (CEO, CTO, Products, Investors) into the metadata of *every chunk* from that document.
*   **File:** `scripts/process_crawl_and_store.ts`
*   **Location:** Inside the main processing loop, *after* reading `doc.content` but *before* `splitIntoChunksWithContext`.
*   **Implementation:**
    ```typescript
    // --- Add this function definition (or place in a suitable utility file) ---
    async function getDocumentLevelContextFromLLM(text: string, source: string): Promise<{ summary: string; entities: Record<string, string[]>; keywords: string[] }> {
        // Limit text length for performance/cost
        const maxInputLength = 18000; // Adjust as needed (Gemini Flash has large context)
        const inputText = text.length > maxInputLength ? text.substring(0, maxInputLength) + "\\n...[TRUNCATED]" : text;

        const prompt = `Analyze the following document text from source: ${source}.
        Provide:
        1.  summary: A concise 2-3 sentence summary focusing on the main purpose and key takeaways.
        2.  entities: Extract key named entities (people, organizations, specific product names, locations) mentioned. Specifically identify and categorize if possible: "CEO", "CTO", "INVESTOR_FIRM", "INVESTOR_PERSON", "PRODUCT_NAME". List names under their category.
        3.  keywords: Generate a list of 5-10 relevant keywords or tags describing the core content.

        Respond ONLY with a valid JSON object adhering to this structure:
        {
          "summary": "string",
          "entities": {
            "PERSON": ["string", ...],
            "ORG": ["string", ...],
            "PRODUCT_NAME": ["string", ...],
            "CEO": ["string", ...],
            "CTO": ["string", ...],
            "INVESTOR_FIRM": ["string", ...],
            "INVESTOR_PERSON": ["string", ...]
          },
          "keywords": ["string", ...]
        }

        Document Text:
        """
        ${inputText}
        """`;

        try {
             // Use geminiClient directly if preferred, ensure proper error handling/JSON parsing
             const structuredResponse = await generateStructuredGeminiResponse(prompt, { // Assuming generateStructuredGeminiResponse exists and works
                 summary: 'string',
                 entities: 'object', // Define more granularly if needed
                 keywords: 'array'
             });
             // Basic validation - refine as needed
             if (structuredResponse && structuredResponse.summary && structuredResponse.entities && structuredResponse.keywords) {
                 logger.info(`Successfully extracted document context via LLM for ${source}`);
                 return structuredResponse as { summary: string; entities: Record<string, string[]>; keywords: string[] };
             } else {
                  logger.warning(`LLM returned incomplete context for ${source}. Response: ${JSON.stringify(structuredResponse)}`);
                   return { summary: "LLM analysis incomplete.", entities: {}, keywords: [] };
             }

        } catch (error) {
            logger.error(`LLM document context extraction failed for ${source}`, error);
            return { summary: "LLM analysis failed.", entities: {}, keywords: [] };
        }
    }
    // --- End function definition ---

    // --- Add this call inside the main processing loop ---
    const docContext = await getDocumentLevelContextFromLLM(doc.content, doc.url);
    // --- End call ---

    // --- Modify metadata preparation ---
    // When preparing documentRecord.metadata:
    metadata: {
        // ... other existing metadata ...
        urlDerivedCategory: derivedCategory, // From Action 5
        llmSummary: docContext.summary,
        llmExtractedEntities: docContext.entities,
        llmKeywords: docContext.keywords,
        sourceType: 'web_crawl',
        crawlTimestamp: doc.timestamp,
        ...(doc.metadata || {})
    }

    // When preparing chunkRecords (inside the .map):
    metadata: {
        ...(chunk.metadata || {}), // Keep existing chunk metadata
        urlDerivedCategory: derivedCategory, // From Action 5
        // --- Add these lines ---
        docSummary: docContext.summary,
        docEntities: docContext.entities,
        // --- End added lines ---
        // Add other necessary metadata propagation here (e.g., LLM primary category if reliable)
        // primaryCategory: analysisResult.primaryCategory, // Example
    },
    ```
*   **Expected Outcome:** Every chunk's metadata will contain the high-level summary and extracted entities (including CEO/CTO if found anywhere in the *original document*), making this crucial context available during retrieval even if the chunk text itself doesn't mention it.

## 6. Execution Plan

1.  **Implement Code Changes:** Modify the specified files (`embeddingClient.ts`, `process_crawl_and_store.ts`, `documentProcessing.ts`) to implement Actions 1, 4, 5, and 6.
2.  **Verify FTS Schema (Action 2):** Check and, if necessary, fix the `text_search_vector` column definition in Supabase.
3.  **Confirm Crawler Fixes (Action 3):** Ensure the new crawl data is clean.
4.  **Re-Index Subset:** Run `scripts/process_crawl_and_store.ts` targeting *only* a small, representative subset of the new crawl data (e.g., the specific pages we audited: About, Team, Platform, Investors, Q&As). Use `--purge` if targeting specific documents that already exist to ensure they are replaced cleanly.
5.  **Test & Verify:**
    *   Inspect the `document_chunks` metadata in Supabase for the newly processed subset. Check for `urlDerivedCategory`, `docSummary`, `docEntities`.
    *   Run key queries ("CEO", "CTO", "Product Suite", "Investors") against the chat interface. Analyze results and context retrieval.
6.  **Iterate:** Refine chunking size (`DEFAULT_CHUNK_SIZE`), boundary logic (`documentProcessing.ts`), or LLM context prompt (`process_crawl_and_store.ts`) based on testing. Re-index the subset and re-test as needed.
7.  **Full Re-Index:** Once satisfied with the results on the subset, run the script for the *entire* new crawl dataset (likely using `--purge` to ensure a clean, consistent state).

## 7. Implementation Status

**Status: IMPLEMENTED WITH ENHANCEMENTS**

All recommended changes have been implemented, with additional enhancements for the sales assistant:

1. **Action 1: Unify Text Preprocessing** ✅
   - Modified `embeddingClient.ts` to ensure consistent text cleaning in both `embedText` and `embedBatch` methods
   - Updated `process_crawl_and_store.ts` to use only raw chunk text for embeddings
   - Updated `hybridSearch.ts` to use the same cleaning approach for query text

2. **Action 2: Ensure FTS Vector Generation** ✅
   - Created SQL script (`db_fixes.sql`) to properly define the `text_search_vector` column as a generated column
   - Removed redundant index

3. **Action 3: Confirm Crawler Improvements** ✅
   - External check confirmed (not a code change)

4. **Action 4: Refine Chunking Strategy** ✅
   - Increased `DEFAULT_CHUNK_SIZE` from 500 to 700
   - Improved `splitRegularContent` to prioritize paragraph breaks

5. **Action 5: Implement URL-Based Categorization** ✅ **ENHANCED & FIXED**
   - Added URL-based categorization logic to `process_crawl_and_store.ts`
   - **Enhanced to prioritize URL path segments** as the primary source of category information
   - **Implemented path-specific category detection** (e.g., `/payroll/` → `PAYROLL` category)
   - **Added comprehensive secondary category detection** from URL paths
   - **Fixed issue with URL paths incorrectly mapping to GENERAL category**:
     - Added new categories to `DocumentCategoryType` enum: `BLOG`, `COMPANY_INFO`, `LEGAL`
     - Updated URL pattern matching to map paths correctly (e.g., `/blog/` → `BLOG`, `/about/` → `COMPANY_INFO`)
     - This ensures site structure-based content is properly categorized

6. **Action 6: Implement LLM Document Context Enrichment** ✅ **ENHANCED**
   - Implemented `getDocumentLevelContextFromLLM` function in `process_crawl_and_store.ts`
   - Added document context to both document and chunk metadata
   - **Enhanced entity extraction for sales contexts** with additional entity types
   - **Added sales-focused keyword generation**
   - **Implemented LLM-based category suggestion** as a fallback when URL doesn't provide clear categories

7. **New: Metadata Integration Enhancement** ✅
   - **Implemented smart metadata integration** that combines URL-derived and LLM-suggested categories
   - **Priority system for category determination**:
     1. URL path segments (highest priority)
     2. Partial URL matches
     3. LLM suggestions (fallback)
     4. Default to GENERAL (lowest priority)

For detailed documentation of all changes, see the `improvements_readme.md` file.
For specific information about the enhanced entity extraction and categorization, see `Enhanced_Entity_Extraction.md`.

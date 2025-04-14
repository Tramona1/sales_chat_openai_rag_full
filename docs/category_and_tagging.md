# Category and Tagging System

## Overview

This document explains the standardized category and metadata tagging system used within the Sales Chat RAG application. This system is fundamental for organizing content, enabling effective filtering during search, and providing context for AI models.

**Goal:** To ensure consistent classification and description of all documents and chunks within the knowledge base, improving search relevance, filtering capabilities, and overall system coherence.

**For the Non-Technical Reader:** Think of categories and tags like labels and keywords in a library or on a website. 
*   **Categories:** Broad subject areas (like "Product Features," "Pricing," "Technical Guides") used to group similar documents.
*   **Tags/Keywords:** More specific terms describing the content (like "user roles," "billing cycle," "API integration").
*   **Other Metadata:** Additional descriptive labels like a "Technical Level" (how complex is it?) or identified "Entities" (company names, specific features).
Using these consistently helps everyone (including the AI) find the right information quickly and understand its context.

## Key Components

*   **Standardized Categories (`utils/documentCategories.ts`, `utils/tagUtils.ts`):** Defines a fixed list of allowed primary and secondary categories (e.g., `GENERAL`, `PRODUCT`, `TECHNICAL`, `FEATURES`, `SALES`, `INDUSTRY`, `COMPETITIVE`, `REFERENCE`, `INTERNAL`, `PRICING`, `COMPARISON`, `CUSTOMER_CASE`). This ensures uniformity across the system.
*   **Technical Levels:** A numerical scale (e.g., 1-10) indicating the technical complexity of the content.
*   **Keywords:** Specific terms extracted or assigned to describe the core topics of a document or chunk.
*   **Entities:** Named entities (like organizations, product names, people, locations) identified within the content.
*   **Metadata Extractor (`utils/metadataExtractor.ts` - potentially refactored/integrated elsewhere):** Logic (often using LLMs like Gemini via `utils/geminiProcessor.ts`) to automatically analyze document content and suggest appropriate categories, keywords, technical levels, and entities during the ingestion process.
*   **Document/Chunk Metadata Field:** A JSONB field within the `documents` and `document_chunks` tables in Supabase used to store this structured metadata.
*   **Admin UI (Document Management/Chunk Management):** Interfaces allowing administrators to review, approve, and manually edit the assigned categories, keywords, technical level, and other metadata for documents and chunks.
*   **Hybrid Search Filter (`utils/hybridSearch.ts`):** The `HybridSearchFilter` interface standardizes how search queries can specify filters based on this metadata (e.g., `primaryCategory`, `technicalLevel`, `requiredEntities`, `keywords`).

## Process

1.  **Automatic Extraction (Ingestion):**
    *   When a new document is uploaded, its content is processed.
    *   An LLM (Gemini via `geminiProcessor.ts`) analyzes the content to suggest:
        *   A primary category (mapped to one of the `STANDARD_CATEGORIES`).
        *   Potential secondary categories.
        *   A suitable technical level.
        *   Relevant keywords.
        *   Named entities.
        *   A concise summary.
    *   This extracted metadata is stored temporarily, often associated with a "pending" document.

2.  **Admin Review & Refinement (DMS):**
    *   Administrators review pending documents via the admin dashboard (`components/admin/PendingDocuments.tsx`).
    *   They can review the automatically suggested metadata and make corrections or additions using the metadata editor component.
    *   They ensure the assigned primary category accurately reflects the document's main purpose.
    *   Once approved, the document and its refined metadata are saved permanently.

3.  **Storage:**
    *   The final, approved metadata (primary category, secondary categories, technical level, keywords, entities, summary, etc.) is stored in the `metadata` JSONB field of the `documents` table.
    *   Relevant metadata might also be propagated or specifically stored in the `metadata` field of the `document_chunks` table.

4.  **Usage in Search & Retrieval (RAG Pipeline):**
    *   **Filtering:** When a user performs a search, the `hybridSearch` function uses the metadata filters specified in the `HybridSearchFilter` to narrow down the search space in both vector and keyword search. For example, it can restrict the search to only chunks belonging to documents with a specific `primaryCategory` or a `technicalLevel` below a certain threshold.
    *   **Relevance Boosting (Optional):** The reranking stage (`utils/reranking.ts`) *could* potentially use metadata (like category matches) to boost the relevance scores of certain results, although the primary factors are currently query relevance and visual content.
    *   **Contextual Understanding:** The assigned categories and keywords provide valuable context that can help both the retrieval system and the final answer generation LLM understand the nature and purpose of the retrieved information.

## Benefits

*   **Improved Search Relevance:** Filtering by categories and technical levels ensures users get results appropriate to their needs and expertise.
*   **Consistency:** Using a predefined list of categories prevents ambiguity and ensures uniform classification.
*   **Enhanced Discovery:** Keywords and entities allow users and the system to find information based on specific terms and concepts.
*   **Better Organization:** Provides a clear structure for the knowledge base, making it easier to manage and maintain.
*   **Context for AI:** Metadata provides valuable signals to the LLMs used in reranking and answer generation.

By implementing and maintaining this standardized category and tagging system, the Sales Chat RAG application ensures its knowledge base is well-organized, easily searchable, and provides the necessary context for accurate AI-driven responses. 
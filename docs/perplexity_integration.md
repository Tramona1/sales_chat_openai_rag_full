# Perplexity API Integration

## Overview

This document details the integration of the Perplexity API within the Sales Chat RAG system, specifically for enhancing the "Company Chat" feature with real-time company information.

**Goal:** To provide users with accurate, up-to-date information about specific companies they inquire about, augmenting the system's knowledge beyond the ingested document base.

**For the Non-Technical Reader:** Sometimes, you need the latest information about a company that might not be in our main knowledge library. This integration connects to another AI service (Perplexity) that specializes in searching the web for current company details (like industry, size, location). When you ask about a specific company in the "Company Chat," the system uses Perplexity to find and verify this information.

## Use Case

This integration primarily powers the **Company Chat** interface (`pages/company-chat.tsx`). When a user initiates a chat focusing on a specific company, the system uses Perplexity to:

1.  **Verify Company Existence:** Confirm that the company name provided by the user likely refers to a real entity.
2.  **Suggest Corrections:** Offer corrections if the user might have misspelled the company name.
3.  **Retrieve Core Information:** Fetch key details like industry, estimated size, location, website, and a brief description.
4.  **Contextualize Conversation:** Use the retrieved information to potentially frame the subsequent conversation or provide an initial summary to the user.

## Implementation Details

*   **Configuration:**
    *   The integration is enabled/disabled via the `USE_PERPLEXITY` environment variable.
    *   Requires a `PERPLEXITY_API_KEY` environment variable containing a valid API key.
*   **Client Utility (`utils/perplexityClient.ts`):**
    *   This module likely contains functions that wrap the Perplexity API endpoints.
    *   It handles constructing the API requests, including the API key in the headers.
    *   It parses the JSON responses from Perplexity.
    *   Includes error handling for API calls.
*   **Utility Functions (`utils/perplexityUtils.ts` - hypothetical):**
    *   May contain helper functions for processing Perplexity results, extracting specific fields, or formatting the data.
*   **API Routes (`pages/api/company/`):**
    *   `POST /api/company/verify`: 
        *   Receives a company name from the frontend.
        *   Calls the Perplexity API (likely their search or autocomplete endpoint) via `perplexityClient.ts` to check if the name corresponds to known entities.
        *   May return suggestions for similar or correctly spelled names.
        *   Response indicates likelihood of existence and provides suggestions.
    *   `POST /api/company/info`:
        *   Receives a verified company name.
        *   Calls the Perplexity API (likely their search or company information endpoint) via `perplexityClient.ts` to fetch detailed information.
        *   Response includes structured data like industry, size, location, description, etc.
*   **Frontend Integration (`pages/company-chat.tsx`):**
    *   The Company Chat interface calls `/api/company/verify` when the user enters a company name.
    *   Based on the verification response, it might prompt the user to confirm a suggestion or proceed.
    *   It then calls `/api/company/info` to fetch details.
    *   The retrieved information is displayed to the user and potentially used to set the context for the ongoing chat session with the RAG system.
*   **Caching:**
    *   To reduce redundant API calls and improve performance, results from `/api/company/info` might be cached (e.g., in memory, Redis, or a dedicated database table) for a certain period. The cache key would typically be the verified company name.

## Interaction with RAG Pipeline

It's important to note that the Perplexity integration primarily provides **contextual information** *before* or *alongside* the main RAG process for company-specific queries. It does **not** directly feed Perplexity results into the vector store or the core retrieval/reranking stages of the RAG pipeline for the general knowledge base.

However, the information retrieved from Perplexity might be:

*   Displayed directly to the user.
*   Included in the initial prompt sent to the RAG system's answer generation stage (`answerGenerator.ts`) to provide context about the company being discussed.

## Security and Usage

*   The `PERPLEXITY_API_KEY` must be kept confidential and stored securely as an environment variable.
*   API usage should be monitored to stay within Perplexity's usage limits and control costs.
*   Error handling should be robust to gracefully manage situations where the Perplexity API is unavailable or returns errors. 
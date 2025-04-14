# Chat System Overview

## Overview

This document describes the user-facing chat interfaces of the Sales Chat RAG application. It covers the different chat modes, how they interact with the backend systems, and how information is presented to the user.

**Goal:** To provide users with intuitive and effective interfaces for interacting with the RAG system and the Perplexity company research feature.

**For the Non-Technical Reader:** This is about the chat windows where you actually talk to the AI assistant. There are two main chat modes:
1.  **General Chat:** Ask questions about products, features, technical details, etc., based on the main knowledge library.
2.  **Company Chat:** Focus your questions on a specific company. The system first uses Perplexity to look up basic info about that company, then uses the main knowledge library to answer your specific questions *about* that company.
Both chat windows send your questions to the appropriate backend system and display the AI's answers, including sources and sometimes images.

## Chat Interfaces

The application provides two primary chat interfaces, implemented as Next.js pages:

1.  **General Chat (`pages/chat.tsx`)**
    *   **Purpose:** For querying the general knowledge base built from ingested documents (website content, PDFs, etc.).
    *   **Workflow:**
        *   User enters a query in the chat input.
        *   The frontend sends the query and potentially the recent conversation history to the backend API endpoint `POST /api/chat`.
        *   The `/api/chat` endpoint orchestrates the full RAG pipeline (Query Analysis -> Hybrid Search -> Reranking -> Context Creation -> Answer Generation).
        *   The backend returns a structured response containing the generated answer text, source citations (linking back to specific chunks/documents), and potentially references to relevant visual content (e.g., image URLs/IDs).
        *   The frontend component (`components/chat/ChatInterface.tsx` or similar) renders the user's query and the assistant's response.
        *   Assistant responses are typically rendered using Markdown for formatting.
        *   Citations are displayed, often interactively (e.g., clickable links or popovers showing the source text).
        *   If visual content references are included, the frontend fetches and displays the relevant images (using `/api/visuals/:id` or direct URLs).

2.  **Company Chat (`pages/company-chat.tsx`)**
    *   **Purpose:** For focused conversations about a specific company, leveraging both the ingested knowledge base and real-time company data from Perplexity.
    *   **Workflow:**
        *   User typically starts by entering a company name.
        *   Frontend calls `POST /api/company/verify` to check the name and get suggestions.
        *   User confirms the company name (potentially selecting a suggestion).
        *   Frontend calls `POST /api/company/info` to fetch basic company details via Perplexity.
        *   This company information is displayed to the user, setting the context.
        *   User then asks specific questions *about that company* (e.g., "How does their pricing compare?", "What integrations do they offer?").
        *   These subsequent queries are sent to the `POST /api/chat` endpoint, similar to the General Chat.
        *   **Crucially,** the backend `/api/chat` handler likely includes the verified company name and potentially the retrieved Perplexity info as additional context when performing the RAG pipeline steps (especially for filtering, reranking, and answer generation prompts). This helps tailor the RAG results to the specific company context.
        *   The frontend renders the conversation, including the initial company info and the subsequent Q&A, similar to the General Chat (with citations, visuals, etc.).

## Key Frontend Components (Conceptual)

*   `components/chat/ChatInterface.tsx`: A reusable component handling the main chat UI, message display, input handling, and API communication.
*   `components/chat/ChatMessage.tsx`: Renders individual user or assistant messages, handling Markdown, citations, and potential visual elements.
*   `components/chat/ChatInput.tsx`: The text input area, potentially with features like history navigation or file upload triggers.
*   `components/chat/SourceCitation.tsx`: Component for displaying source information, potentially interactive.
*   `components/company/CompanyVerification.tsx`: Specific component in Company Chat to handle the initial company name input and verification step.

## Backend Interaction

*   **General Chat:** Primarily interacts with `POST /api/chat`.
*   **Company Chat:** Interacts with `POST /api/company/verify`, `POST /api/company/info`, and `POST /api/chat`.
*   **Visuals:** Both interfaces may trigger calls to `/api/visuals/[id]` (or fetch from direct URLs) if the backend response includes visual content references.

## State Management

The frontend needs to manage:

*   Current conversation history (messages).
*   Loading states during API calls.
*   User input.
*   For Company Chat, the verified company context.
*   Authentication state (determining if the user is logged in, although chat might be public).

This state could be managed using React Context, Zustand, Redux, or other state management libraries.

## User Experience Considerations

*   **Clarity:** Clearly differentiate between the General Chat and Company Chat modes.
*   **Responsiveness:** Provide clear loading indicators while waiting for backend responses.
*   **Trust:** Display source citations prominently to build user trust in the answers.
*   **Interactivity:** Make citations and potentially visual elements interactive.
*   **Error Handling:** Gracefully handle API errors or situations where no answer can be found. 
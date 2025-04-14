# Admin Dashboard Overview

## Overview

This document provides an overview of the Admin Dashboard (`pages/admin/dashboard.tsx`), which serves as the central control panel for administrators managing the Sales Chat RAG system.

**Goal:** To provide administrators with the necessary tools and insights to monitor system health, manage knowledge base content, analyze performance, and configure system settings.

**For the Non-Technical Reader:** The Admin Dashboard is the main screen for system administrators. From here, they can get a quick overview of how the system is doing, manage the documents in the knowledge library (using the DMS features), see how people are using the chat, and potentially adjust settings.

## Key Features & Sections

The Admin Dashboard typically consolidates access to various administrative functions and displays key metrics. While the exact layout and features evolve, common components include:

1.  **System Statistics & Metrics:**
    *   Displays high-level statistics about the knowledge base (e.g., number of documents, number of chunks).
    *   Shows system usage metrics (e.g., number of chat sessions, queries processed).
    *   May include performance indicators (e.g., average query response time).

2.  **Document Management Access:**
    *   Provides navigation (e.g., via tabs or links) to the core Document Management System (DMS) interfaces:
        *   `PendingDocuments.tsx`: For reviewing and approving/rejecting new documents.
        *   `DocumentManagement.tsx`: For managing approved documents.

3.  **Chunk Management Access:**
    *   Provides navigation to chunk management interfaces:
        *   `AllChunksViewer.tsx`: For viewing and managing all chunks across the system.
        *   Links from individual documents to their specific chunks.

4.  **Query Analysis & Performance:**
    *   Displays recent user queries.
    *   May show metrics related to query success rates or retrieval effectiveness (e.g., which queries resulted in good answers, which ones failed).
    *   Could include tools to analyze problematic queries.

5.  **Content Performance Evaluation:**
    *   Analytics on which documents or chunks are most frequently retrieved or cited in answers.
    *   Insights into content quality scores across the knowledge base.
    *   Identification of potentially outdated or low-quality content needing review.

6.  **Sales-Related Analytics (Optional):**
    *   If integrated with sales processes, might display metrics relevant to sales enablement (e.g., queries related to specific products or competitors).

7.  **System Health Monitoring:**
    *   Status indicators for key backend services (Database connection, LLM API health, Perplexity API health).
    *   Logs viewer or access to system logs for troubleshooting.

8.  **Configuration (Potentially):**
    *   Might provide UI elements for adjusting certain system configurations (though often managed via environment variables or config files).

## Implementation Details

*   **Framework:** Implemented as a Next.js page (`pages/admin/dashboard.tsx`).
*   **UI Components:** Likely uses components from `components/admin/` and potentially shared UI components (`components/ui/`). Data display often relies on grids (`DataGrid`) and charting libraries.
*   **Data Fetching:** Fetches data for display by calling various backend API endpoints (e.g., `/api/admin/stats`, `/api/admin/queries`, `/api/admin/documents`, etc.).
*   **Authentication:** Access to the entire dashboard and its sub-sections MUST be protected by robust administrator authentication (See `docs/auth_details.md`).

The Admin Dashboard is a critical component for the long-term maintenance, monitoring, and improvement of the Sales Chat RAG system. 
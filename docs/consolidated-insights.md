# Documentation: Consolidated Chat Insights

## Purpose

This document describes the consolidated "Insights" feature within the Admin Dashboard. Its goal is to provide actionable insights into how users, particularly the sales team, are interacting with the Workstream Knowledge Assistant. This helps identify common questions, knowledge gaps, content performance, and areas for improvement in training or documentation. It replaces the previous separate "Query Insights" and "Sales Insights" tabs.

## Implementation Overview

The feature consists of two main parts:

1.  **Frontend Component (`pages/admin.tsx` -> `InsightsTab`):** Displays the insights using charts and tables, providing filters for time range and session type.
2.  **Backend API Endpoint (`pages/api/admin/consolidated-insights.ts`):** Fetches and aggregates data from the database and feedback logs to generate the insights displayed on the frontend.
3.  **Database RPC Function (`get_consolidated_query_insights`):** A PostgreSQL function within Supabase that efficiently performs the primary data aggregation of user queries **and returns associated query log IDs**.

## Data Sources

The insights are derived from the following sources:

1.  **`chat_sessions` Table (Supabase):** Contains metadata about each chat session, including:
    *   `id`: Unique session identifier.
    *   `session_type`: ('company' or 'general') - Used for filtering.
    *   `created_at`, `updated_at`: Timestamps used for time range filtering.
    *   *(Future Auth):* `sales_rep_id`, `sales_rep_name`: Needed for user-specific insights.
2.  **`chat_messages` Table (Supabase):** Contains individual messages within sessions, including:
    *   `session_id`: Links message to a session.
    *   `role`: ('user' or 'assistant') - We analyze 'user' messages.
    *   `content`: The actual text of the user's query - This is the primary text analyzed for topic frequency.
    *   `created_at`: Timestamp used for time range filtering.
    *   *(Future Enhancement):* `search_result_count`: Needed to track "no result" queries accurately.
3.  **`feedback.json` File:** A local JSON file storing user feedback entries. It's assumed to contain:
    *   `query`: The original user query text (used for correlation).
    *   `feedback`: ('positive' or 'negative').
    *   `timestamp`: Used for potential time filtering of feedback itself (currently not implemented in API).

## Logic Breakdown

1.  **Frontend Request:** The `InsightsTab` component in `admin.tsx` makes a GET request to `/api/admin/consolidated-insights` when the tab loads or when filters (Time Range, Session Type) are changed.
2.  **API Data Fetching:**
    *   The API endpoint receives the request and filter parameters.
    *   It calls the Supabase RPC function `get_consolidated_query_insights`, passing the time interval and session type filter.
3.  **RPC Function (`get_consolidated_query_insights`):**
    *   This function queries the `query_logs` table, joining with `chat_sessions`.
    *   It filters messages based on `role = 'user'`, the requested time interval (`created_at`), and the `session_type`.
    *   It groups the results by the `user_query` (`topic`).
    *   For each unique query (`topic`), it calculates: total count, counts by session type, last occurrence, **and aggregates an array of corresponding `query_logs.id` values (`query_log_ids`)**.
    *   It returns these aggregated results.
4.  **API Data Processing:**
    *   The API receives the aggregated data (including `query_log_ids`) from the RPC.
    *   It fetches feedback data from the `feedback` table in Supabase, filtered by the received `query_log_ids`.
    *   It iterates through the aggregated topics from the RPC:
        *   Calculates the sum of query lengths.
        *   **Correlates feedback by iterating through the `query_log_ids` for the topic and summing up positive/negative counts from the fetched feedback data.**
    *   It calculates overall statistics (`totalQueries`, `avgQueryLength`).
    *   It formats the data into the `ConsolidatedInsightsData` structure expected by the frontend, including `topTopics` (sorted by frequency) and `negativeFeedbackTopics` (filtered and sorted by negative count).
5.  **Frontend Display:** The `InsightsTab` receives the JSON data and renders the statistics cards and tables.

## Setup Instructions

1.  **Create RPC Function:** Copy the SQL code provided in the "SQL for Supabase RPC Function" section and execute it in your Supabase SQL Editor to create the `get_consolidated_query_insights` function. Make sure to adjust table/column names if yours differ and set appropriate permissions using `GRANT EXECUTE`.
2.  **Deploy Code:** Deploy the changes to `pages/admin.tsx` and the new API file `pages/api/admin/consolidated-insights.ts`.
3.  **Verify `feedback.json`:** Ensure the `feedback.json` file exists at the project root and contains valid JSON data with `query` and `feedback` fields for the feedback correlation to work.

## Placeholders & Limitations (Current Version)

*   **Average Response Time:** Requires integrating performance logs or storing response times per message. Currently placeholder (0).
*   **No Result Rate / Topics:** Requires adding a mechanism (e.g., a `search_result_count` column in `chat_messages`) to track when a query yields no search results from the knowledge base. Currently placeholder (0 / empty list).
*   **Average Feedback Score:** Requires calculating an overall score based on positive/negative counts per topic or overall. Currently placeholder.
*   **Feedback Correlation:** Relies on an exact match between the user query text in `chat_messages` (or `query_logs`) and the `query` field in `feedback.json`. May miss feedback if queries are slightly rephrased.
*   **Product/Feature Mentions:** Not implemented. Requires NLP or keyword/regex analysis on message content in the backend API.
*   **Scalability:** Aggregating topics based on exact query text might lead to many unique entries for minor variations. Future improvements could involve NLP for topic clustering or keyword extraction. Processing feedback logs by loading the entire file can become slow with many entries.

## Future Enhancements & Deeper Insights

While the current implementation provides valuable baseline insights, several enhancements can be made for richer analysis and company-wide use:

1.  **Semantic Topic Modeling/Clustering:**
    *   **Problem:** Grouping by exact query text is noisy.
    *   **Solution:** Implement NLP techniques (e.g., embedding clustering, LLM topic extraction) in the backend or via offline processing to group semantically similar queries (e.g., "what is price?", "cost?", "pricing info") into meaningful topics ("Pricing Inquiry").
    *   **Benefit:** Reveals underlying themes, reduces noise, allows tracking trends in concepts.

2.  **Entity Recognition (Products, Features, Competitors):**
    *   **Problem:** We don't currently know *what* specific subjects are discussed within queries.
    *   **Solution:** Process query/response text to identify and tag mentions of predefined entities (Your Products, Competitors, Key Features, etc.) using LLMs or keyword/regex matching. Store these tags (e.g., in `query_logs.metadata` or a separate table).
    *   **Benefit:** Enables filtering/aggregating insights by specific subjects (e.g., "Show top issues for Product X", "Frequency of Competitor Y mentions").

3.  **Improved Outcome & Feedback Tracking:**
    *   **Problem:** "No Result" queries and feedback correlation need improvement.
    *   **Solution:**
        *   Add a `search_result_count` column (or similar) to the `query_logs` (or message) table, populated by the query API.
        *   Store feedback in a dedicated database table, linking it directly to the `query_log.id` or specific message ID for accuracy.
    *   **Benefit:** Enables direct analysis like "Topics with highest no-result rate", "Feedback score for queries mentioning Feature Z".

4.  **More Flexible API & Frontend:**
    *   **Problem:** Predefined views limit exploration.
    *   **Solution:**
        *   Enhance the API to support more complex filtering (e.g., by mentioned entity) and grouping (`groupBy=topic`, `groupBy=product`).
        *   Use interactive tables (sorting, filtering) and charting libraries (Chart.js, Recharts) in the frontend.
        *   Implement drill-down functionality (e.g., click topic to see raw queries).
    *   **Benefit:** Allows users to explore data more dynamically and visually.

5.  **Advanced: Custom Reporting / BI Tool Integration:**
    *   **Problem:** Building all possible views in the app is infeasible for diverse company needs.
    *   **Solution:** For ultimate flexibility and scalability, periodically export processed/enriched log data to a data warehouse (BigQuery, Snowflake). Connect a Business Intelligence (BI) tool (Looker, Tableau, Metabase) to the warehouse.
    *   **Benefit:** Empowers users across the company to build custom reports and dashboards without requiring application code changes.

Prioritizing semantic topic modeling, entity recognition, and improved outcome tracking will likely provide the most significant immediate improvements in insight quality.

## System Monitoring & Cost Tracking

To provide better visibility into system usage, operational costs, and potential bottlenecks, we are implementing tracking for external API calls and query performance using dedicated Supabase tables.

### Purpose

*   **Usage Monitoring:** Understand how frequently different external APIs (LLMs, Embedding models) are being called.
*   **Cost Estimation:** Provide data points needed to estimate operational costs associated with these API calls.
*   **Reliability Tracking:** Identify failure rates for specific API integrations.
*   **Performance Analysis:** Track query execution times and result counts.

### Mechanism: Database Logging

We are moving away from relying on local log files or JSON files for critical metrics. Instead, we are using dedicated Supabase tables:

1.  **`api_call_logs` Table:**
    *   **Status:** Implemented.
    *   **Description:** Stores a record for each external API call (Gemini chat, embedding, analysis, rerank, etc.). Logs include the service called, the specific function, success/error status, duration, and relevant metadata.
    *   **Usage:** The `/api/system-metrics` endpoint now queries this table to calculate API call counts and estimate costs, replacing the previous log file parsing method.
    *   **Code Changes:** Helper `logApiCall` added to `utils/logger.ts`. Relevant utility files (`embeddingClient.ts`, `queryAnalysis.ts`, etc.) and API routes (`/api/chat.ts`) updated to call `logApiCall`.

2.  **`query_logs` Table:**
    *   **Status:** Existing table identified. Logging implemented in `/api/query.ts`.
    *   **Description:** Stores details about each user query processed by the `/api/query` endpoint.
    *   **Usage:** `/api/query.ts` inserts a row containing the query text, session ID, timings, result counts, etc. `/api/system-metrics.ts` and `/api/admin/consolidated-insights.ts` will query this table for metrics.

3.  **`feedback` / `user_feedback` Table:**
    *   **Status:** `feedback` table identified. Backend API (`/api/admin/consolidated-insights.ts`) updated to read from it. **`query_log_id` column needs to be added manually.** Frontend/Saving API updates pending.
    *   **Description:** The `feedback` table will be used to store user feedback (e.g., thumbs-up/down) linked directly to specific query results.
    *   **Planned Usage:** A `query_log_id` column (Foreign Key to `query_logs.id`) needs to be added to the `feedback` table. Feedback submission logic (frontend + backend API) will be updated to store this ID. `/api/admin/consolidated-insights.ts` now reads from this table (joining via `query_log_id` if available in the RPC result) instead of `feedback.json`.

### Phase 1: API Call Logging (Complete)

This phase focused on tracking external API calls.

*   **Files Modified:** `utils/logger.ts`, `utils/embeddingClient.ts`, `utils/queryAnalysis.ts`, `utils/reranking.ts`, `utils/answerGenerator.ts`, `pages/api/chat.ts`, `pages/api/system-metrics.ts`.
*   **Outcome:** API call counts (success/error) and estimated costs displayed on the "System Status" tab are now sourced directly from the `api_call_logs` table in Supabase.

### Phase 2: Query Logging (Partially Complete)
*   **Files Modified:** `pages/api/query.ts`.
*   **Outcome:** Query details (timings, counts, metadata) are now logged to the `query_logs` table. The `queryLogId` is returned in the API response.

### Phase 3: Feedback Database Integration (In Progress)
*   **Files Modified:** `pages/api/admin/consolidated-insights.ts` (Reading part done).
*   **Database Changes:** RPC `get_consolidated_query_insights` updated to return `query_log_ids`. `query_log_id` column needs to be added to `feedback` table.
*   **Pending:** Update frontend feedback component and feedback saving API.

### Next Steps

1.  **Database Schema:** Manually add the `query_log_id UUID REFERENCES query_logs(id)` column to your `feedback` table in Supabase.
2.  **Feedback Saving:** Modify the frontend and the backend API endpoint responsible for saving feedback to store the `query_log_id`.
3.  **Average Query Time:** Implement accurate calculation in `/api/system-metrics.ts` using data from `query_logs` (potentially via an RPC).
4.  **Troubleshooting:** Resolve any remaining issues, such as the zero counts for documents/chunks or linter warnings.

## Future Authentication Integration

Integrating authentication is crucial for user-specific insights (e.g., Sales Rep Performance).

**Steps:**

1.  **Implement Auth System:** Choose and set up an authentication provider (e.g., Supabase Auth, NextAuth.js). Ensure users (especially sales reps) have unique accounts and roles.
2.  **Database Schema:**
    *   Add `sales_rep_id` (TEXT or UUID) and `sales_rep_name` (TEXT) columns to your `chat_sessions` table.
    *   *(Recommended)* Create a `users` table (`id`, `name`, `email`, `role`, etc.) and make `chat_sessions.sales_rep_id` a foreign key referencing `users.id`.
3.  **Frontend (`chat.tsx`/`company-chat.tsx`):**
    *   When a user is logged in, retrieve their `user_id` and `name` from the auth context.
    *   Modify `saveChatSession` and `updateChatSession` to include `sales_rep_id` and `sales_rep_name` in the payload sent to the backend.
4.  **Session Storage API (`/api/storage/...` or `/api/admin/chat-sessions`):**
    *   Update the backend endpoint that saves/updates sessions to receive `sales_rep_id` and `sales_rep_name` and store them in the corresponding `chat_sessions` row.
5.  **Modify RPC Function:** Add an optional parameter for filtering by user ID:
    ```sql
    -- Add parameter
    CREATE OR REPLACE FUNCTION get_consolidated_query_insights(
        time_filter_interval text DEFAULT '7 days',
        session_type_filter text DEFAULT 'all',
        sales_rep_filter_id text DEFAULT NULL -- New parameter
    )
    RETURNS TABLE (...) -- Keep existing return columns
    LANGUAGE plpgsql ...
    AS $$ ...
    BEGIN ...
        -- Add to WHERE clause in the main query:
        WHERE
            m.role = 'user'
            AND m.created_at >= start_time
            AND (session_type_filter = 'all' OR s.session_type = session_type_filter)
            AND (sales_rep_filter_id IS NULL OR s.sales_rep_id = sales_rep_filter_id) -- Add this line
        GROUP BY ...
    END;
    $$;
    ```
6.  **Modify Insights API (`/api/admin/consolidated-insights.ts`):**
    *   Accept an optional `salesRepId` query parameter from the frontend request.
    *   Pass this `sales_rep_filter_id` to the Supabase RPC call.
7.  **Modify Admin UI (`admin.tsx` - `InsightsTab`):**
    *   Add a dropdown filter for "Sales Rep". This dropdown would need to be populated by fetching a list of users (sales reps) who have recorded chat sessions.
    *   Pass the selected `salesRepId` as a query parameter in the `fetchInsightsData` API call.

## Other Future Enhancements

*   **"No Result" Tracking:** Add a `search_result_count` column to `chat_messages`, populate it in `/api/query`, and aggregate this in the insights API/RPC.
*   **Refine Feedback:** Link feedback directly to `chat_messages.id` if possible for more accurate correlation.
*   **Topic Clustering:** Use NLP to group similar queries instead of relying on exact text matches.
*   **Product/Feature Analysis:** Implement entity recognition in the API to count mentions. 
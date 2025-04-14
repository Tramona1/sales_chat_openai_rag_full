-- Add search_traces table for tracking search decisions and category balance
-- This table helps analyze search patterns, content distribution, and chain of thought

-- Create the search_traces table
CREATE TABLE IF NOT EXISTS public.search_traces (
    id UUID PRIMARY KEY,
    query TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    query_analysis JSONB NOT NULL,
    search_decisions JSONB NOT NULL,
    result_stats JSONB NOT NULL,
    timings JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_search_traces_timestamp ON public.search_traces(timestamp);
CREATE INDEX IF NOT EXISTS idx_search_traces_query_category ON public.search_traces((query_analysis->>'primaryCategory'));
CREATE INDEX IF NOT EXISTS idx_search_traces_sales_ratio ON public.search_traces((result_stats->>'salesContentRatio'));

-- Add text search index for searching queries
CREATE INDEX IF NOT EXISTS idx_search_traces_query_text ON public.search_traces USING GIN (to_tsvector('english', query));

-- Add RLS policy for security
ALTER TABLE public.search_traces ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access only
CREATE POLICY admin_policy ON public.search_traces
    USING (auth.role() = 'authenticated' AND auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.role() = 'authenticated' AND auth.jwt() ->> 'role' = 'admin');

-- Grant permissions to service role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_traces TO service_role;

-- Create a view for easy analysis
CREATE OR REPLACE VIEW public.search_trace_analysis AS
SELECT
    id,
    query,
    timestamp,
    query_analysis->>'primaryCategory' AS primary_category,
    query_analysis->>'intent' AS intent,
    query_analysis->>'technicalLevel' AS technical_level,
    search_decisions->>'filterRelaxed' AS filter_relaxed,
    search_decisions->>'relaxationReason' AS relaxation_reason,
    result_stats->>'initialResultCount' AS initial_result_count,
    result_stats->>'finalResultCount' AS final_result_count,
    result_stats->>'salesContentRatio' AS sales_content_ratio,
    timings->>'total' AS total_time_ms
FROM
    public.search_traces;

-- Create a function to get recent category distribution
CREATE OR REPLACE FUNCTION public.get_recent_category_distribution(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
    category TEXT,
    count BIGINT,
    percentage NUMERIC
)
LANGUAGE SQL
AS $$
    WITH category_counts AS (
        SELECT
            query_analysis->>'primaryCategory' AS category,
            COUNT(*) AS count
        FROM
            public.search_traces
        WHERE
            timestamp > (CURRENT_DATE - days_back * INTERVAL '1 day')
        GROUP BY
            query_analysis->>'primaryCategory'
    ),
    total AS (
        SELECT SUM(count) AS total_count FROM category_counts
    )
    SELECT
        cc.category,
        cc.count,
        ROUND((cc.count::NUMERIC / t.total_count::NUMERIC) * 100, 2) AS percentage
    FROM
        category_counts cc
    CROSS JOIN
        total t
    ORDER BY
        cc.count DESC;
$$;

COMMENT ON TABLE public.search_traces IS 'Stores detailed traces of search processing for analysis';
COMMENT ON VIEW public.search_trace_analysis IS 'Simplified view of search traces for easy querying';
COMMENT ON FUNCTION public.get_recent_category_distribution IS 'Function to analyze category distribution in recent searches'; 
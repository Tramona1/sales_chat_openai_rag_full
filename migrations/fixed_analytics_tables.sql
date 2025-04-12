-- Create function to update search_queries_aggregated table
-- FIXED VERSION - using query_text instead of query_text to match existing schema
CREATE OR REPLACE FUNCTION update_search_queries_aggregated()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO search_queries_aggregated (
        query_text, 
        query_count,
        avg_result_count,
        avg_execution_time_ms,
        last_queried_at,
        first_queried_at
    ) VALUES (
        NEW.query_text,
        1,
        NEW.result_count,
        NEW.execution_time_ms,
        NEW.timestamp,
        NEW.timestamp
    )
    ON CONFLICT (query_text) DO UPDATE SET
        query_count = search_queries_aggregated.query_count + 1,
        avg_result_count = (search_queries_aggregated.avg_result_count * search_queries_aggregated.query_count + NEW.result_count) / (search_queries_aggregated.query_count + 1),
        avg_execution_time_ms = CASE 
            WHEN NEW.execution_time_ms IS NOT NULL THEN
                (search_queries_aggregated.avg_execution_time_ms * search_queries_aggregated.query_count + NEW.execution_time_ms) / (search_queries_aggregated.query_count + 1)
            ELSE
                search_queries_aggregated.avg_execution_time_ms
        END,
        last_queried_at = NEW.timestamp,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update search_queries_aggregated table
DROP TRIGGER IF EXISTS update_search_queries_aggregated_trigger ON search_metrics;

CREATE TRIGGER update_search_queries_aggregated_trigger
AFTER INSERT ON search_metrics
FOR EACH ROW
EXECUTE FUNCTION update_search_queries_aggregated(); 
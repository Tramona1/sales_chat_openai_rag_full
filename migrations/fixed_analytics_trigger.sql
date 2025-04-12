-- Create function to update search_queries_aggregated table
-- FIXED VERSION - using the correct column names that match the existing schema
CREATE OR REPLACE FUNCTION update_search_queries_aggregated()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO search_queries_aggregated (
        query_normalized, 
        total_count,
        successful_count,
        zero_results_count,
        avg_result_count,
        first_seen,
        last_seen
    ) VALUES (
        LOWER(TRIM(NEW.query_text)),
        1,
        CASE WHEN NEW.result_count > 0 THEN 1 ELSE 0 END,
        CASE WHEN NEW.result_count = 0 THEN 1 ELSE 0 END,
        NEW.result_count,
        NEW.timestamp,
        NEW.timestamp
    )
    ON CONFLICT (query_normalized) DO UPDATE SET
        total_count = search_queries_aggregated.total_count + 1,
        successful_count = search_queries_aggregated.successful_count + 
            CASE WHEN NEW.result_count > 0 THEN 1 ELSE 0 END,
        zero_results_count = search_queries_aggregated.zero_results_count + 
            CASE WHEN NEW.result_count = 0 THEN 1 ELSE 0 END,
        avg_result_count = (search_queries_aggregated.avg_result_count * 
            search_queries_aggregated.total_count + NEW.result_count) / 
            (search_queries_aggregated.total_count + 1),
        last_seen = NEW.timestamp;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS update_search_queries_aggregated_trigger ON search_metrics;

-- Create trigger to update search_queries_aggregated table
CREATE TRIGGER update_search_queries_aggregated_trigger
AFTER INSERT ON search_metrics
FOR EACH ROW
EXECUTE FUNCTION update_search_queries_aggregated(); 
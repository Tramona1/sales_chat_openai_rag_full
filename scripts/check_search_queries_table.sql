-- Check if search_queries_aggregated table exists and get its structure
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'search_queries_aggregated'
AND table_schema = 'public'
ORDER BY ordinal_position; 
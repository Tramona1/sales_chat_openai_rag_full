-- Set a longer timeout for all sessions (30 seconds instead of the default)
ALTER DATABASE postgres SET statement_timeout = '30000';

-- Set a longer timeout for the current role (anon key)
ALTER ROLE authenticated SET statement_timeout = '30000';
ALTER ROLE anon SET statement_timeout = '30000';

-- For immediate effect in the current session
SET statement_timeout = '30000';

-- Set a specific timeout for the hybrid_search function to avoid long-running queries
ALTER FUNCTION public.hybrid_search(text, vector, integer, float, jsonb, float, float) SET statement_timeout = '30000'; 
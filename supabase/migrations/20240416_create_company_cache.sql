-- Create table for caching company information
CREATE TABLE IF NOT EXISTS company_information_cache (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index on expires_at column for efficient cleanup
CREATE INDEX IF NOT EXISTS idx_company_cache_expires_at ON company_information_cache (expires_at);

-- Create or replace function to handle table creation from RPC
CREATE OR REPLACE FUNCTION create_company_cache_table()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create the cache table if it doesn't exist
  CREATE TABLE IF NOT EXISTS company_information_cache (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
  );
  
  -- Create index on expires_at column if it doesn't exist
  CREATE INDEX IF NOT EXISTS idx_company_cache_expires_at ON company_information_cache (expires_at);
  
  RETURN jsonb_build_object('success', true, 'message', 'Company cache table created successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Create or replace function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_company_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM company_information_cache 
  WHERE expires_at < NOW()
  RETURNING COUNT(*) INTO deleted_count;
  
  RETURN deleted_count;
END;
$$;

-- Add RPC function for cache cleanup
DROP FUNCTION IF EXISTS rpc_cleanup_company_cache();
CREATE OR REPLACE FUNCTION rpc_cleanup_company_cache()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  SELECT cleanup_expired_company_cache() INTO deleted_count;
  RETURN jsonb_build_object('success', true, 'deleted_count', deleted_count);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON TABLE company_information_cache IS 'Cache for Perplexity company information API';
COMMENT ON FUNCTION create_company_cache_table() IS 'Creates the company cache table if it does not exist';
COMMENT ON FUNCTION cleanup_expired_company_cache() IS 'Deletes expired entries from the company cache';
COMMENT ON FUNCTION rpc_cleanup_company_cache() IS 'RPC function to clean up expired company cache entries'; 
-- Create the company information cache table for Perplexity API
CREATE TABLE IF NOT EXISTS company_information_cache (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create an index on expires_at for faster cache cleanup
CREATE INDEX IF NOT EXISTS idx_company_information_cache_expires_at 
ON company_information_cache(expires_at);

-- Add update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_cache_timestamp
BEFORE UPDATE ON company_information_cache
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create a function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_company_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM company_information_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql; 
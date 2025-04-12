
-- Create chat_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type TEXT NOT NULL CHECK (session_type IN ('company', 'general')),
  company_name TEXT,
  company_info JSONB,
  title TEXT NOT NULL,
  sales_notes TEXT,
  messages JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sales_rep_id TEXT,
  sales_rep_name TEXT,
  tags TEXT[],
  keywords TEXT[]
);

-- Create index on updated_at for sorting
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at 
ON chat_sessions(updated_at DESC);

-- Create index on session_type for filtering
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_type 
ON chat_sessions(session_type);

-- Create text search index on title for searching
CREATE INDEX IF NOT EXISTS idx_chat_sessions_title_search 
ON chat_sessions USING GIN (to_tsvector('english', title));

-- Create index on company_name for filtering and searching
CREATE INDEX IF NOT EXISTS idx_chat_sessions_company_name 
ON chat_sessions(company_name);

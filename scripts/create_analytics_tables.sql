-- Analytics and Document Management Tables
-- This script creates all the necessary tables for tracking search analytics,
-- document management, and user feedback in the sales chat application.

-- 1. Enhanced Search Metrics Table
CREATE TABLE IF NOT EXISTS search_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    session_id TEXT,
    query_text TEXT NOT NULL,
    search_type TEXT NOT NULL CHECK (search_type IN ('hybrid', 'vector', 'keyword', 'fallback')),
    result_count INTEGER NOT NULL DEFAULT 0,
    execution_time_ms INTEGER,
    clicked_results JSONB,
    relevance_feedback JSONB,
    filter_used JSONB,
    query_vector VECTOR(768),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    company_context TEXT,
    query_category TEXT
);

-- Index on timestamp for time-based analytics
CREATE INDEX IF NOT EXISTS idx_search_metrics_timestamp 
ON search_metrics(timestamp);

-- Index for query text search
CREATE INDEX IF NOT EXISTS idx_search_metrics_query_text 
ON search_metrics USING gin(to_tsvector('english', query_text));

-- 2. Visual Content Table for Multi-modal support
CREATE TABLE IF NOT EXISTS visual_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('image', 'chart', 'diagram', 'video', 'other')),
    file_path TEXT NOT NULL,
    title TEXT,
    description TEXT,
    embedding VECTOR(1536), -- For visual embeddings
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_public BOOLEAN DEFAULT FALSE,
    height INTEGER,
    width INTEGER,
    file_size_kb INTEGER,
    tags TEXT[]
);

-- Index for document_id to quickly find visuals for a document
CREATE INDEX IF NOT EXISTS idx_visual_content_document_id 
ON visual_content(document_id);

-- 3. Pending Documents Table (for approval workflow)
CREATE TABLE IF NOT EXISTS pending_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_type TEXT NOT NULL,
    submitter_id TEXT,
    submitter_email TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'requested_changes')),
    reviewer_id TEXT,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    metadata JSONB,
    document_category TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to TEXT,
    tags TEXT[]
);

-- Indexes for pending documents
CREATE INDEX IF NOT EXISTS idx_pending_documents_status 
ON pending_documents(status);

CREATE INDEX IF NOT EXISTS idx_pending_documents_created_at 
ON pending_documents(created_at);

-- Index for text search on title and content
CREATE INDEX IF NOT EXISTS idx_pending_documents_text_search 
ON pending_documents USING gin(to_tsvector('english', title || ' ' || content));

-- 4. Search Synonyms Table
CREATE TABLE IF NOT EXISTS search_synonyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term TEXT NOT NULL,
    synonyms TEXT[] NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT
);

-- Unique index on term to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_synonyms_term 
ON search_synonyms(term);

-- 5. Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    user_id TEXT,
    session_id TEXT,
    event_data JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    device_info JSONB,
    source_page TEXT,
    duration_ms INTEGER,
    success BOOLEAN
);

-- Indexes for analytics events
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp 
ON analytics_events(timestamp);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type 
ON analytics_events(event_type);

-- 6. Search Queries Aggregated Table
CREATE TABLE IF NOT EXISTS search_queries_aggregated (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text TEXT NOT NULL,
    query_normalized TEXT NOT NULL,
    total_count INTEGER NOT NULL DEFAULT 1,
    successful_count INTEGER NOT NULL DEFAULT 0,
    zero_results_count INTEGER NOT NULL DEFAULT 0,
    avg_result_count FLOAT DEFAULT 0,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    avg_execution_time_ms FLOAT DEFAULT 0,
    most_common_filters JSONB,
    clicked_document_ids TEXT[],
    related_query_ids TEXT[]
);

-- Unique index on normalized query
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_queries_agg_query_normalized 
ON search_queries_aggregated(query_normalized);

-- 7. User Feedback Table
CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    session_id TEXT,
    query_id UUID REFERENCES search_metrics(id),
    document_id UUID,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    feedback_category TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
    assigned_to TEXT
);

-- Indexes for user feedback
CREATE INDEX IF NOT EXISTS idx_user_feedback_query_id 
ON user_feedback(query_id);

CREATE INDEX IF NOT EXISTS idx_user_feedback_document_id 
ON user_feedback(document_id);

-- 8. Query Categories Table
CREATE TABLE IF NOT EXISTS query_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name TEXT NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES query_categories(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    examples TEXT[],
    related_categories UUID[],
    training_importance INTEGER CHECK (training_importance >= 1 AND training_importance <= 10)
);

-- Unique index on category name
CREATE UNIQUE INDEX IF NOT EXISTS idx_query_categories_name 
ON query_categories(category_name);

-- Set up triggers for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for tables with updated_at columns
CREATE TRIGGER update_visual_content_timestamp
BEFORE UPDATE ON visual_content
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_pending_documents_timestamp
BEFORE UPDATE ON pending_documents
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_search_synonyms_timestamp
BEFORE UPDATE ON search_synonyms
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_query_categories_timestamp
BEFORE UPDATE ON query_categories
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Function to merge query data into the aggregated table
CREATE OR REPLACE FUNCTION update_search_queries_aggregated()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO search_queries_aggregated (
        query_text, 
        query_normalized, 
        total_count,
        successful_count,
        zero_results_count,
        avg_result_count,
        first_seen,
        last_seen,
        avg_execution_time_ms
    ) VALUES (
        NEW.query_text,
        LOWER(TRIM(NEW.query_text)),
        1,
        CASE WHEN NEW.result_count > 0 THEN 1 ELSE 0 END,
        CASE WHEN NEW.result_count = 0 THEN 1 ELSE 0 END,
        NEW.result_count,
        NEW.timestamp,
        NEW.timestamp,
        NEW.execution_time_ms
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
        last_seen = NEW.timestamp,
        avg_execution_time_ms = (search_queries_aggregated.avg_execution_time_ms * 
            search_queries_aggregated.total_count + COALESCE(NEW.execution_time_ms, 0)) / 
            (search_queries_aggregated.total_count + 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatically updating the aggregated table
CREATE TRIGGER update_search_queries_aggregated_trigger
AFTER INSERT ON search_metrics
FOR EACH ROW EXECUTE FUNCTION update_search_queries_aggregated();

-- Enable RLS (Row Level Security) on pending_documents
ALTER TABLE pending_documents ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY admin_pending_docs_policy ON pending_documents
    USING (auth.role() = 'authenticated' AND auth.jwt() ->> 'role' = 'admin');

-- Create policy for submitter access (can only see their own submissions)
CREATE POLICY submitter_pending_docs_policy ON pending_documents
    USING (auth.role() = 'authenticated' AND submitter_id = auth.uid()); 
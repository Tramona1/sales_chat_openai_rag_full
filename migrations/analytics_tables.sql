-- Create tables for analytics tracking

-- Table for general analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    user_id TEXT,
    session_id TEXT,
    event_data JSONB,
    source_page TEXT,
    duration_ms INTEGER,
    success BOOLEAN,
    device_info JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);

-- Table for search metrics
CREATE TABLE IF NOT EXISTS search_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT,
    session_id TEXT,
    query_text TEXT NOT NULL,
    search_type VARCHAR(20) NOT NULL,
    result_count INTEGER NOT NULL,
    execution_time_ms INTEGER,
    clicked_results JSONB,
    relevance_feedback JSONB,
    filter_used JSONB,
    company_context TEXT,
    query_category TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_search_metrics_timestamp ON search_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_search_metrics_user_id ON search_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_metrics_query_text ON search_metrics(query_text);
CREATE INDEX IF NOT EXISTS idx_search_metrics_search_type ON search_metrics(search_type);

-- Table for aggregated search queries
CREATE TABLE IF NOT EXISTS search_queries_aggregated (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_text TEXT NOT NULL,
    query_count INTEGER NOT NULL DEFAULT 1,
    avg_result_count NUMERIC,
    avg_execution_time_ms NUMERIC,
    last_queried_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_queried_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint on query_text
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_queries_aggregated_query_text ON search_queries_aggregated(query_text);

-- Table for user feedback
CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT,
    session_id TEXT,
    query_id TEXT,
    document_id TEXT,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    feedback_text TEXT,
    feedback_category TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_feedback_timestamp ON user_feedback(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_feedback_rating ON user_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_user_feedback_document_id ON user_feedback(document_id);

-- Table for query categories and intents
CREATE TABLE IF NOT EXISTS query_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_name TEXT NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES query_categories(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint on category_name
CREATE UNIQUE INDEX IF NOT EXISTS idx_query_categories_name ON query_categories(category_name);

-- Table for search synonyms
CREATE TABLE IF NOT EXISTS search_synonyms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    term TEXT NOT NULL,
    synonyms TEXT[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint on term
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_synonyms_term ON search_synonyms(term);

-- Table for visual content tracking
CREATE TABLE IF NOT EXISTS visual_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    metadata JSONB,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create a view for most common searches
CREATE OR REPLACE VIEW v_top_searches AS
SELECT 
    query_text,
    query_count,
    last_queried_at
FROM 
    search_queries_aggregated
ORDER BY 
    query_count DESC;

-- Create a view for search performance by type
CREATE OR REPLACE VIEW v_search_performance_by_type AS
SELECT 
    search_type,
    COUNT(*) as search_count,
    AVG(result_count) as avg_result_count,
    AVG(execution_time_ms) as avg_execution_time_ms
FROM 
    search_metrics
GROUP BY 
    search_type
ORDER BY 
    search_count DESC;

-- Create a view for user feedback summary
CREATE OR REPLACE VIEW v_user_feedback_summary AS
SELECT 
    rating,
    COUNT(*) as feedback_count,
    AVG(rating) OVER () as avg_rating
FROM 
    user_feedback
GROUP BY 
    rating
ORDER BY 
    rating DESC;

-- Create function to update search_queries_aggregated table
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
CREATE TRIGGER update_search_queries_aggregated_trigger
AFTER INSERT ON search_metrics
FOR EACH ROW
EXECUTE FUNCTION update_search_queries_aggregated(); 
-- Create tables for analytics tracking if they don't exist

-- Make sure we have uuid support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Check if analytics_events table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'analytics_events') THEN
        -- Create the table if it doesn't exist
        CREATE TABLE analytics_events (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            event_type VARCHAR(100) NOT NULL,
            user_id TEXT,
            session_id TEXT,
            event_data JSONB, -- This is the missing column
            source_page TEXT,
            duration_ms INTEGER,
            success BOOLEAN,
            device_info JSONB,
            timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- Add indexes
        CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
        CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp);
        CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
    ELSE
        -- If table exists but column is missing, add it
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'analytics_events' AND column_name = 'event_data'
        ) THEN
            ALTER TABLE analytics_events ADD COLUMN event_data JSONB;
        END IF;
    END IF;
END $$;

-- Check if search_metrics table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'search_metrics') THEN
        -- Create the table if it doesn't exist
        CREATE TABLE search_metrics (
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

        -- Add indexes
        CREATE INDEX idx_search_metrics_timestamp ON search_metrics(timestamp);
        CREATE INDEX idx_search_metrics_user_id ON search_metrics(user_id);
        CREATE INDEX idx_search_metrics_query_text ON search_metrics(query_text);
        CREATE INDEX idx_search_metrics_search_type ON search_metrics(search_type);
    END IF;
END $$;

-- Check if user_feedback table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_feedback') THEN
        -- Create the table if it doesn't exist
        CREATE TABLE user_feedback (
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

        -- Add indexes
        CREATE INDEX idx_user_feedback_timestamp ON user_feedback(timestamp);
        CREATE INDEX idx_user_feedback_rating ON user_feedback(rating);
        CREATE INDEX idx_user_feedback_document_id ON user_feedback(document_id);
    END IF;
END $$;

-- Output status message
SELECT 'Analytics tables check completed. Missing tables and columns have been created.' as status; 
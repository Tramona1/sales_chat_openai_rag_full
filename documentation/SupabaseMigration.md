# Supabase Migration Guide

## Overview

This document outlines the migration process from a file-based storage system to Supabase for the Sales Knowledge Assistant. The migration includes setting up a Supabase project, creating the necessary database schema, and migrating existing data.

## Supabase Project Setup

### Project Information
- **Project ID**: iqnxlmfyduuxfrtsrzcu
- **Project URL**: https://iqnxlmfyduuxfrtsrzcu.supabase.co
- **API Keys**: (Stored in environment variables)
  - SUPABASE_URL: Project URL
  - SUPABASE_ANON_KEY: Public API key for client-side operations
  - SUPABASE_SERVICE_KEY: Secret API key for server-side operations

### Database Schema

The database schema consists of several tables designed to store documents, chunks, vector embeddings, and metadata for the RAG system:

1. **documents**: Stores document metadata and status information
2. **document_chunks**: Stores text chunks with references to parent documents
3. **vector_items**: Stores embeddings and metadata for vector search
4. **corpus_statistics**: Stores BM25 statistics for hybrid search
5. **visual_content**: Stores image data and metadata for multimodal retrieval

## Migration Process

### Prerequisites

1. Create a Supabase project
2. Set up environment variables in `.env.local`:
   ```
   SUPABASE_URL=https://iqnxlmfyduuxfrtsrzcu.supabase.co
   SUPABASE_ANON_KEY=eyJhbG...
   SUPABASE_SERVICE_KEY=eyJhbG...
   ```
3. Install required dependencies:
   ```
   npm install @supabase/supabase-js uuid dotenv
   ```

### Migration Steps

1. **Create Database Schema**: Run the SQL migration script to create tables, indexes, and functions
   ```
   node scripts/run_supabase_migration.js
   ```

2. **Migrate Existing Data**: Run the migration script to transfer data from files to Supabase
   ```
   node scripts/migrate_to_supabase.js
   ```

3. **Update Configuration**: Update the application to use Supabase instead of file-based storage
   ```
   node scripts/configure_supabase.js
   ```

4. **Test the Migration**: Run tests to ensure data integrity and functionality
   ```
   npm run test:supabase
   ```

## Technical Details

### Data Models

#### Documents Table
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT,
  mime_type TEXT,
  content_length INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending',
  owner_id UUID,
  is_approved BOOLEAN DEFAULT false
);
```

#### Document Chunks Table
```sql
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER,
  content TEXT,
  content_length INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(document_id, chunk_index)
);
```

#### Vector Items Table
```sql
CREATE TABLE vector_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  embedding VECTOR(768),
  content TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### Corpus Statistics Table
```sql
CREATE TABLE corpus_statistics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  total_documents INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 0,
  average_chunk_length FLOAT DEFAULT 0,
  document_frequencies JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### Visual Content Table
```sql
CREATE TABLE visual_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content_type TEXT,
  content_index INTEGER,
  image_data BYTEA,
  alt_text TEXT,
  caption TEXT,
  analysis JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Vector Search Functions

The database schema includes functions for vector similarity search:

```sql
CREATE OR REPLACE FUNCTION match_vectors(
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vector_items.id,
    vector_items.content,
    vector_items.metadata,
    1 - (vector_items.embedding <=> query_embedding) AS similarity
  FROM vector_items
  WHERE 1 - (vector_items.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

## Adapting Application Code

### Key File Changes

The following files need to be updated to use Supabase:

1. **utils/supabaseClient.ts**: Create a Supabase client instance
2. **utils/supabaseVectorStore.ts**: Implement vector store operations with Supabase
3. **utils/adminWorkflow.ts**: Update document approval workflow
4. **utils/documentProcessing.ts**: Update document processing pipeline

### Example Supabase Client Setup

```typescript
// utils/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or key in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
```

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Ensure environment variables are correctly set
   - Check network access to Supabase

2. **Migration Failures**
   - Check for data format inconsistencies
   - Ensure proper error handling in migration scripts

3. **Performance Issues**
   - Create appropriate indexes on frequently queried columns
   - Monitor query performance and optimize as needed

## Next Steps

1. **Implement Monitoring**: Set up monitoring for Supabase database performance
2. **Optimize Queries**: Review and optimize database queries for performance
3. **Scale Vector Store**: Implement strategies for scaling vector operations as data grows
4. **Backup Strategy**: Establish regular backup procedures for Supabase data

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction) 
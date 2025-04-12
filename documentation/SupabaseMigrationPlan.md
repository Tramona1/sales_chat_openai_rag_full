# Supabase Migration Plan

## Overview

This document outlines our plan to migrate the Sales Knowledge Assistant from file-based vector storage to Supabase PostgreSQL with pgvector. Since we are currently purging the vector store, this presents an ideal opportunity to implement the new database architecture from the ground up without complex data migration concerns.

## Goals

1. Implement a scalable database architecture using Supabase
2. Configure pgvector for efficient vector similarity search
3. Set up proper database schema for documents, chunks, and metadata
4. Ensure compatibility with our 768-dimension Gemini embeddings
5. Enable multi-user support and real-time features
6. Improve query performance and concurrency

## Timeline

| Phase | Timeframe | Description |
|-------|-----------|-------------|
| Setup | Days 1-2 | Supabase project setup, schema creation |
| Implementation | Days 3-5 | Vector operations, CRUD functionality |
| Integration | Days 6-8 | Connect application code to Supabase |
| Testing | Days 9-10 | Validation, performance testing |
| Deployment | Day 11 | Production deployment |
| Monitoring | Days 12+ | Performance monitoring, optimizations |

## Phase 1: Supabase Setup

### 1.1 Create Supabase Project

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Log in to Supabase
supabase login

# Create a new project (or use the Supabase dashboard)
supabase projects create sales-knowledge-assistant
```

### 1.2 Database Schema Creation

Create the following tables in Supabase:

```sql
-- Documents table to store original document information
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  file_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata fields
  category TEXT,
  technical_level INTEGER,
  approved BOOLEAN DEFAULT FALSE,
  review_status TEXT DEFAULT 'pending',
  approved_at TIMESTAMP WITH TIME ZONE,
  is_authoritative BOOLEAN DEFAULT FALSE,
  is_deprecated BOOLEAN DEFAULT FALSE,
  deprecated_by UUID REFERENCES documents(id),
  deprecated_at TIMESTAMP WITH TIME ZONE,
  
  -- Document context
  document_summary TEXT,
  primary_topics TEXT[],
  document_type TEXT,
  audience_type TEXT[],
  
  -- Additional metadata as JSON
  metadata JSONB
);

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Document chunks table to store individual chunks with embeddings
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  embedding VECTOR(768), -- Using 768 dimensions for Gemini embeddings
  chunk_index INTEGER,
  page_number INTEGER,
  
  -- Context and metadata
  is_structured BOOLEAN DEFAULT FALSE,
  info_type TEXT,
  context JSONB,
  has_visual_content BOOLEAN DEFAULT FALSE,
  visual_content JSONB,
  
  -- Additional metadata
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vector index for similarity search (using HNSW for better performance)
CREATE INDEX document_chunks_embedding_idx ON document_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Term frequencies table for BM25 search
CREATE TABLE term_frequencies (
  term TEXT PRIMARY KEY,
  frequency INTEGER NOT NULL
);

-- Document frequencies table for BM25 search
CREATE TABLE document_frequencies (
  term TEXT PRIMARY KEY,
  frequency INTEGER NOT NULL
);

-- Document count record for corpus statistics
CREATE TABLE corpus_stats (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Only one record
  document_count INTEGER NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (extends Supabase Auth)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT,
  department TEXT,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feedback table
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  response_id TEXT NOT NULL,
  query TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  comments TEXT,
  conversation_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Query logs table
CREATE TABLE query_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  response_text TEXT,
  hybrid_ratio FLOAT,
  result_count INTEGER,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

-- Pending documents queue
CREATE TABLE pending_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_comments TEXT,
  has_conflicts BOOLEAN DEFAULT FALSE,
  conflicting_docs JSONB,
  metadata JSONB
);
```

### 1.3 Create Stored Procedures

```sql
-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT,
  filter_category TEXT DEFAULT NULL,
  filter_technical_level INT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  text TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.text,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (filter_category IS NULL OR d.category = filter_category)
    AND (filter_technical_level IS NULL OR d.technical_level <= filter_technical_level)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Function to calculate average document length
CREATE OR REPLACE FUNCTION calculate_avg_document_length()
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
  avg_length FLOAT;
BEGIN
  SELECT AVG(array_length(string_to_array(text, ' '), 1)) INTO avg_length
  FROM document_chunks;
  
  RETURN COALESCE(avg_length, 0);
END;
$$;

-- Function to calculate BM25 score for a document
CREATE OR REPLACE FUNCTION calculate_bm25_score(
  query_text TEXT,
  doc_id UUID,
  k1_param FLOAT DEFAULT 1.2,
  b_param FLOAT DEFAULT 0.75
)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
  score FLOAT := 0;
  doc_length INT;
  avg_doc_length FLOAT;
  doc_count INT;
  query_terms TEXT[];
  term TEXT;
  tf INT;
  df INT;
  idf FLOAT;
  term_score FLOAT;
BEGIN
  -- Get document length (word count)
  SELECT array_length(string_to_array(text, ' '), 1) INTO doc_length
  FROM document_chunks
  WHERE id = doc_id;
  
  -- Get average document length
  SELECT calculate_avg_document_length() INTO avg_doc_length;
  
  -- Get document count
  SELECT document_count INTO doc_count
  FROM corpus_stats
  WHERE id = 1;
  
  -- If any values are missing, return 0
  IF doc_length IS NULL OR avg_doc_length IS NULL OR doc_count IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Tokenize query
  SELECT string_to_array(lower(query_text), ' ') INTO query_terms;
  
  -- Calculate score for each term
  FOREACH term IN ARRAY query_terms
  LOOP
    -- Skip short terms
    IF length(term) <= 2 THEN
      CONTINUE;
    END IF;
    
    -- Get term frequency in document
    SELECT count(*) INTO tf
    FROM unnest(string_to_array(lower((
      SELECT text FROM document_chunks WHERE id = doc_id
    )), ' ')) AS words
    WHERE words = term;
    
    -- Get document frequency
    SELECT frequency INTO df
    FROM document_frequencies
    WHERE term = term;
    
    -- If term not found in any document, skip
    IF df IS NULL OR df = 0 THEN
      CONTINUE;
    END IF;
    
    -- Calculate IDF (Inverse Document Frequency)
    idf := ln((doc_count - df + 0.5) / (df + 0.5) + 1);
    
    -- Calculate term score using BM25 formula
    term_score := idf * (tf * (k1_param + 1)) / 
                  (tf + k1_param * (1 - b_param + b_param * doc_length / avg_doc_length));
    
    -- Add to total score
    score := score + term_score;
  END LOOP;
  
  RETURN score;
END;
$$;

-- Function to search documents using BM25
CREATE OR REPLACE FUNCTION search_documents_bm25(
  query_text TEXT,
  result_limit INT DEFAULT 10,
  k1_param FLOAT DEFAULT 1.2,
  b_param FLOAT DEFAULT 0.75
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  text TEXT,
  metadata JSONB,
  score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.text,
    dc.metadata,
    calculate_bm25_score(query_text, dc.id, k1_param, b_param) AS score
  FROM document_chunks dc
  WHERE calculate_bm25_score(query_text, dc.id, k1_param, b_param) > 0
  ORDER BY score DESC
  LIMIT result_limit;
END;
$$;

-- Function to rebuild corpus statistics
CREATE OR REPLACE FUNCTION rebuild_corpus_statistics()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  doc_count INTEGER;
BEGIN
  -- Get document count
  SELECT COUNT(DISTINCT document_id) INTO doc_count FROM document_chunks;
  
  -- Clear existing statistics
  TRUNCATE term_frequencies;
  TRUNCATE document_frequencies;
  
  -- Rebuild term frequencies
  INSERT INTO term_frequencies (term, frequency)
  SELECT 
    word, 
    COUNT(*) as frequency
  FROM 
    document_chunks,
    unnest(string_to_array(lower(text), ' ')) as word
  WHERE 
    length(word) > 1
  GROUP BY 
    word;
  
  -- Rebuild document frequencies
  INSERT INTO document_frequencies (term, frequency)
  SELECT 
    word, 
    COUNT(DISTINCT document_id) as doc_frequency
  FROM 
    document_chunks,
    unnest(string_to_array(lower(text), ' ')) as word
  WHERE 
    length(word) > 1
  GROUP BY 
    word;
  
  -- Update corpus stats
  INSERT INTO corpus_stats (document_count, last_updated)
  VALUES (doc_count, NOW())
  ON CONFLICT (id) DO UPDATE
  SET document_count = EXCLUDED.document_count,
      last_updated = EXCLUDED.last_updated;
END;
$$;

-- Function to test vector operations
CREATE OR REPLACE FUNCTION test_vector_operations()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  vec1 VECTOR(768);
  vec2 VECTOR(768);
  result jsonb;
BEGIN
  -- Create two test vectors
  SELECT array_fill(1.0::float, ARRAY[768])::vector INTO vec1;
  SELECT array_fill(0.5::float, ARRAY[768])::vector INTO vec2;
  
  -- Calculate cosine similarity
  SELECT jsonb_build_object(
    'status', 'success',
    'cosine_similarity', 1 - (vec1 <=> vec2),
    'pgvector_version', current_setting('server.extensions.vector.version'),
    'dimension', 768
  ) INTO result;
  
  RETURN result;
END;
$$;
```

## Phase 2: Implementation

### 2.1 Environment Configuration

Create or update `.env.local` with Supabase credentials:

```
# Supabase Configuration
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_KEY=<your-service-key>

# Set this to true to use Supabase instead of file-based storage
USE_SUPABASE=true
```

### 2.2 Vector Store Implementation

Create a new file `utils/supabaseVectorStore.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { VectorStoreItem } from '../types/vectorStore';
import { logError, logInfo } from './errorHandling';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Add items to the vector store
 * 
 * This function handles both document and chunk insertion following a two-step process:
 * 1. First, it inserts the parent document into the documents table
 * 2. Then, it inserts the associated chunks into the document_chunks table with the parent document ID
 */
export async function addToVectorStore(
  items: VectorStoreItem | VectorStoreItem[]
): Promise<void> {
  const itemsArray = Array.isArray(items) ? items : [items];
  
  // Group items by document
  const documents = new Map<string, VectorStoreItem>();
  const chunks = new Map<string, VectorStoreItem[]>();
  
  for (const item of itemsArray) {
    const isChunk = item.metadata?.isChunk === true;
    const parentDocId = item.metadata?.parentDocument as string;
    
    if (!isChunk || !parentDocId) {
      // This is a document or standalone item
      const docId = item.id || crypto.randomUUID();
      documents.set(docId, item);
      chunks.set(docId, []);
    } else {
      // This is a chunk with a parent document
      if (!chunks.has(parentDocId)) {
        chunks.set(parentDocId, []);
      }
      chunks.get(parentDocId)?.push(item);
    }
  }
  
  // Process each document and its chunks
  for (const [docId, document] of documents.entries()) {
    try {
      // 1. First insert or update the document
      const { data: insertedDoc, error: docError } = await supabase
        .from('documents')
        .upsert({
          id: docId,
          title: document.metadata?.source || 'Untitled',
          source: document.metadata?.source || 'Unknown',
          file_path: document.metadata?.filePath,
          category: document.metadata?.category,
          technical_level: document.metadata?.technicalLevel || 0,
          document_summary: document.metadata?.documentSummary,
          primary_topics: document.metadata?.primaryTopics 
            ? (typeof document.metadata.primaryTopics === 'string' 
              ? JSON.parse(document.metadata.primaryTopics) 
              : document.metadata.primaryTopics)
            : null,
          document_type: document.metadata?.documentType,
          audience_type: document.metadata?.audienceType
            ? (typeof document.metadata.audienceType === 'string'
              ? JSON.parse(document.metadata.audienceType)
              : document.metadata.audienceType)
            : null,
          metadata: document.metadata,
          updated_at: new Date()
        }, {
          onConflict: 'id',
          returning: 'minimal'
        });
      
      if (docError) {
        logError(`Error upserting document ${docId}:`, docError);
        continue;
      }
      
      // 2. Insert document's full text as a chunk if it's not chunked
      const documentChunks = chunks.get(docId) || [];
      
      if (documentChunks.length === 0 && document.text) {
        // Document has no separate chunks, add the full text as a single chunk
        const { error: fullTextError } = await supabase
          .from('document_chunks')
          .insert({
            document_id: docId,
            text: document.text,
            embedding: document.embedding,
            chunk_index: 0,
            metadata: {
              ...document.metadata,
              isFullDocument: true
            }
          });
        
        if (fullTextError) {
          logError(`Error inserting full text chunk for document ${docId}:`, fullTextError);
        }
      }
      
      // 3. Now insert all the chunks associated with this document
      if (documentChunks.length > 0) {
        const chunksToInsert = documentChunks.map((chunk, index) => ({
          document_id: docId,
          text: chunk.text,
          embedding: chunk.embedding,
          chunk_index: chunk.metadata?.chunkIndex || index,
          page_number: chunk.metadata?.page || null,
          is_structured: chunk.metadata?.isStructured || false,
          info_type: chunk.metadata?.infoType || null,
          context: chunk.metadata?.context || null,
          has_visual_content: chunk.metadata?.hasVisualContent || false,
          visual_content: chunk.metadata?.visualContent || null,
          metadata: chunk.metadata
        }));
        
        // Insert chunks in batches to avoid hitting request size limits
        for (let i = 0; i < chunksToInsert.length; i += 50) {
          const batch = chunksToInsert.slice(i, i + 50);
          
          const { error: chunkError } = await supabase
            .from('document_chunks')
            .insert(batch);
          
          if (chunkError) {
            logError(`Error inserting chunks batch for document ${docId}:`, chunkError);
          }
        }
      }
      
      logInfo(`Successfully added document ${docId} with ${documentChunks.length} chunks`);
    } catch (error) {
      logError(`Error processing document ${docId}:`, error as Error);
    }
  }
  
  // After adding items, update corpus statistics
  try {
    await supabase.rpc('rebuild_corpus_statistics');
    logInfo('Corpus statistics updated successfully');
  } catch (error) {
    logError('Error updating corpus statistics:', error as Error);
  }
}

/**
 * Get similar items from the vector store
 */
export async function getSimilarItems(
  queryEmbedding: number[],
  limit: number = 5,
  queryText?: string,
  priorityInfoType?: string,
  options?: {
    category?: string;
    technicalLevel?: number;
  }
): Promise<(VectorStoreItem & { score: number })[]> {
  // Query using the match_documents function
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: limit,
    filter_category: options?.category || null,
    filter_technical_level: options?.technicalLevel || null
  });
  
  if (error) {
    logError('Error performing vector search:', error);
    return [];
  }
  
  // Convert to VectorStoreItem format
  return data.map(item => ({
    item: {
      id: item.id,
      text: item.text,
      metadata: item.metadata,
      embedding: [] // Don't return the full embedding to save bandwidth
    },
    score: item.similarity
  }));
}

/**
 * Clear the vector store
 */
export async function clearVectorStore(): Promise<void> {
  // Clear all tables in the right order
  await supabase.from('document_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  // Reset corpus statistics
  await supabase.from('term_frequencies').delete().neq('term', '');
  await supabase.from('document_frequencies').delete().neq('term', '');
  await supabase.from('corpus_stats').delete().eq('id', 1);
  await supabase.from('corpus_stats').insert({ id: 1, document_count: 0 });
}

/**
 * Get the size of the vector store
 */
export async function getVectorStoreSize(): Promise<number> {
  const { count, error } = await supabase
    .from('document_chunks')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    logError('Error getting vector store size:', error);
    return 0;
  }
  
  return count || 0;
}

/**
 * Get all items from the vector store
 */
export async function getAllVectorStoreItems(): Promise<VectorStoreItem[]> {
  const { data, error } = await supabase
    .from('document_chunks')
    .select('id, text, metadata, document_id');
  
  if (error) {
    logError('Error getting all vector store items:', error);
    return [];
  }
  
  return data.map(item => ({
    id: item.id,
    text: item.text,
    metadata: {
      ...item.metadata,
      parentDocument: item.document_id
    },
    embedding: [] // Don't return the full embedding
  }));
}
```

### 2.3 Update BM25 Search Implementation

Create `utils/supabaseBM25Search.ts`:

```typescript
/**
 * BM25 Search implementation using Supabase
 */
import { createClient } from '@supabase/supabase-js';
import { VectorStoreItem } from '../types/vectorStore';
import { BM25SearchResult } from '../types/search';
import { logError } from './errorHandling';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Get corpus statistics from Supabase
 */
export async function getCorpusStatistics() {
  // Get corpus stats
  const { data: statsData, error: statsError } = await supabase
    .from('corpus_stats')
    .select('*')
    .eq('id', 1)
    .single();
  
  if (statsError) {
    logError('Error fetching corpus stats', statsError);
    return { documentCount: 0, avgDocLength: 0 };
  }
  
  // Get document count
  const documentCount = statsData?.document_count || 0;
  
  // Calculate average document length
  const { data: avgLengthData, error: avgLengthError } = await supabase
    .rpc('calculate_avg_document_length');
  
  if (avgLengthError) {
    logError('Error calculating average document length', avgLengthError);
    return { documentCount, avgDocLength: 0 };
  }
  
  return {
    documentCount,
    avgDocLength: avgLengthData?.avg_length || 0,
    k1: 1.2,
    b: 0.75
  };
}

/**
 * Calculate BM25 score using Supabase
 */
export async function calculateBM25Score(query: string, document: { id: string, text: string }) {
  // Get corpus statistics
  const corpusStats = await getCorpusStatistics();
  
  // Use Supabase RPC to calculate BM25 score
  const { data, error } = await supabase
    .rpc('calculate_bm25_score', {
      query_text: query,
      doc_id: document.id,
      k1_param: corpusStats.k1,
      b_param: corpusStats.b
    });
  
  if (error) {
    logError('Error calculating BM25 score', error);
    return 0;
  }
  
  return data || 0;
}

/**
 * Perform BM25 search using Supabase
 */
export async function performBM25Search(
  query: string,
  limit: number = 10,
  filter?: (item: VectorStoreItem) => boolean
): Promise<BM25SearchResult[]> {
  try {
    // Use Supabase RPC to perform BM25 search
    const { data, error } = await supabase
      .rpc('search_documents_bm25', {
        query_text: query,
        result_limit: limit
      });
    
    if (error) {
      logError('Error performing BM25 search', error);
      return [];
    }
    
    // Process results
    let results: BM25SearchResult[] = data.map((item: any) => ({
      item: {
        id: item.id,
        text: item.text,
        metadata: item.metadata,
        embedding: []
      },
      score: item.score,
      bm25Score: item.score
    }));
    
    // Apply filter if provided
    if (filter) {
      results = results.filter(result => filter(result.item));
    }
    
    return results;
  } catch (error) {
    logError('Error in performBM25Search', error as Error);
    return [];
  }
}
```

## Phase 3: Integration

### 3.1 Create Factory Pattern for Vector Store

Create a new file `utils/vectorStoreFactory.ts`:

```typescript
import * as FileVectorStore from './vectorStore';
import * as SupabaseVectorStore from './supabaseVectorStore';
import { VectorStoreItem } from '../types/vectorStore';

// Check environment to determine which implementation to use
const useSupabase = process.env.USE_SUPABASE === 'true';

/**
 * Add items to the vector store
 */
export async function addToVectorStore(
  items: VectorStoreItem | VectorStoreItem[]
): Promise<void> {
  if (useSupabase) {
    return SupabaseVectorStore.addToVectorStore(items);
  } else {
    return FileVectorStore.addToVectorStore(items);
  }
}

/**
 * Get similar items from the vector store
 */
export async function getSimilarItems(
  queryEmbedding: number[],
  limit: number = 5,
  queryText?: string,
  priorityInfoType?: string,
  options?: any
) {
  if (useSupabase) {
    return SupabaseVectorStore.getSimilarItems(
      queryEmbedding,
      limit,
      queryText,
      priorityInfoType,
      options
    );
  } else {
    return FileVectorStore.getSimilarItems(
      queryEmbedding,
      limit,
      queryText,
      priorityInfoType
    );
  }
}

/**
 * Clear the vector store
 */
export async function clearVectorStore(): Promise<void> {
  if (useSupabase) {
    return SupabaseVectorStore.clearVectorStore();
  } else {
    return FileVectorStore.clearVectorStore();
  }
}

/**
 * Get the size of the vector store
 */
export async function getVectorStoreSize(): Promise<number> {
  if (useSupabase) {
    return SupabaseVectorStore.getVectorStoreSize();
  } else {
    return FileVectorStore.getVectorStoreSize();
  }
}

/**
 * Get all items from the vector store
 */
export async function getAllVectorStoreItems(): Promise<VectorStoreItem[]> {
  if (useSupabase) {
    return SupabaseVectorStore.getAllVectorStoreItems();
  } else {
    return FileVectorStore.getAllVectorStoreItems();
  }
}

// Export other functions as needed, following the same pattern
```

### 3.2 Update BM25 Search Factory

Create a similar factory for BM25 search in `utils/bm25SearchFactory.ts`.

### 3.3 Update Admin Workflow

Adapt the admin workflow to use Supabase by creating `utils/supabaseAdminWorkflow.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { 
  EnhancedMetadata, 
  PendingDocumentMetadata,
  ExtractedEntity
} from '../types/metadata';
import { logError, logInfo } from './errorHandling';
import { ContextualChunk } from '../types/documentProcessing';
import { serializeEntities } from './metadataUtils';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Get all pending documents
 */
export async function getPendingDocuments() {
  const { data, error } = await supabase
    .from('pending_documents')
    .select(`
      id,
      text,
      status,
      submitted_at,
      reviewed_at,
      reviewer_comments,
      has_conflicts,
      conflicting_docs,
      metadata
    `)
    .order('submitted_at', { ascending: false });
  
  if (error) {
    logError('Error fetching pending documents', error);
    return [];
  }
  
  return data;
}

/**
 * Add document to pending queue
 */
export async function addToPendingDocuments(
  text: string,
  metadata: EnhancedMetadata,
  embedding?: number[] | null,
  contextualChunks?: ContextualChunk[] | null
): Promise<string> {
  try {
    // Check for conflicts
    const { hasConflicts, conflictingDocIds } = await checkForContentConflicts(metadata, text);
    
    // Create document in pending queue
    const { data, error } = await supabase
      .from('pending_documents')
      .insert({
        text,
        metadata,
        status: 'pending',
        has_conflicts: hasConflicts,
        conflicting_docs: conflictingDocIds.length > 0 ? conflictingDocIds : null,
        has_contextual_chunks: contextualChunks != null && contextualChunks.length > 0
      })
      .select('id')
      .single();
    
    if (error) {
      logError('Error adding to pending documents', error);
      throw error;
    }
    
    // If there are contextual chunks, store them
    if (contextualChunks && contextualChunks.length > 0) {
      const chunksToStore = contextualChunks.map(chunk => ({
        pending_document_id: data.id,
        text: chunk.text,
        metadata: chunk.metadata || {}
      }));
      
      const { error: chunksError } = await supabase
        .from('pending_document_chunks')
        .insert(chunksToStore);
      
      if (chunksError) {
        logError('Error storing contextual chunks', chunksError);
      }
    }
    
    return data.id;
  } catch (error) {
    logError('Error in addToPendingDocuments', error as Error);
    throw error;
  }
}

// Implement other admin functions similarly
```

### 3.4 Visual Content Storage Strategy

To properly handle visual content when using Supabase, we need a storage solution for the actual image files, while storing metadata and references in the database:

```typescript
// utils/visualStorageStrategy.ts

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Upload an image file to Supabase Storage
 */
export async function uploadImage(
  file: Buffer | File | Blob,
  fileName: string,
  documentId: string
): Promise<string | null> {
  try {
    // Define the storage path based on document ID
    // This groups related images together and avoids collisions
    const storagePath = `documents/${documentId}/${fileName}`;
    
    // Upload the file to Supabase Storage
    const { data, error } = await supabase
      .storage
      .from('visual_content')
      .upload(storagePath, file, {
        upsert: true,
        contentType: getContentType(fileName)
      });
    
    if (error) {
      console.error('Error uploading image to Supabase Storage:', error);
      return null;
    }
    
    // Get the public URL
    const { data: publicUrlData } = supabase
      .storage
      .from('visual_content')
      .getPublicUrl(storagePath);
    
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadImage:', error);
    return null;
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  const contentTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'pdf': 'application/pdf'
  };
  
  return contentTypes[extension] || 'application/octet-stream';
}

/**
 * Delete an image from Supabase Storage
 */
export async function deleteImage(url: string): Promise<boolean> {
  try {
    // Extract path from URL
    const path = url.split('visual_content/')[1];
    
    if (!path) {
      console.error('Invalid storage URL format:', url);
      return false;
    }
    
    // Delete the file
    const { error } = await supabase
      .storage
      .from('visual_content')
      .remove([path]);
    
    if (error) {
      console.error('Error deleting image from Supabase Storage:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in deleteImage:', error);
    return false;
  }
}

/**
 * Get image URLs for a document
 */
export async function getDocumentImages(documentId: string): Promise<string[]> {
  try {
    // List files in the document's folder
    const { data, error } = await supabase
      .storage
      .from('visual_content')
      .list(`documents/${documentId}`);
    
    if (error) {
      console.error('Error listing images for document:', error);
      return [];
    }
    
    // Convert to public URLs
    return data.map(file => {
      const path = `documents/${documentId}/${file.name}`;
      const { data } = supabase
        .storage
        .from('visual_content')
        .getPublicUrl(path);
      
      return data.publicUrl;
    });
  } catch (error) {
    console.error('Error in getDocumentImages:', error);
    return [];
  }
}
```

#### Storage Setup

Before using the visual storage functionality, we need to set up Supabase Storage:

1. In the Supabase dashboard, go to "Storage"
2. Create a new bucket named `visual_content`
3. Set the security policy to allow authenticated uploads:

```sql
-- Allow read access to all files (for public access to images)
CREATE POLICY "Allow public read access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'visual_content');

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" 
ON storage.objects FOR INSERT 
TO authenticated 
USING (bucket_id = 'visual_content');

-- Allow users to delete their own uploads (based on document ownership)
CREATE POLICY "Allow users to delete their uploads" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'visual_content' AND 
  (storage.foldername(name))[1] = 'documents' AND
  EXISTS (
    SELECT 1 FROM documents
    WHERE id::text = (storage.foldername(name))[2] AND
    documents.created_by = auth.uid()
  )
);
```

#### Integration with Multi-Modal Processing

Update the multi-modal processing functions to use Supabase Storage:

```typescript
// utils/multiModalProcessing.ts

import { uploadImage, getDocumentImages } from './visualStorageStrategy';

// Update the processDocumentWithVisualContent function
export async function processDocumentWithVisualContent(
  textContent: string,
  imagePaths: string[],
  sourceMetadata: Record<string, any>,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    keepSeparateVisualChunks?: boolean;
  } = {}
): Promise<MultiModalChunk[]> {
  // Create a document ID if not provided
  const documentId = sourceMetadata.id || crypto.randomUUID();
  
  // Process and upload images to Supabase Storage
  const processedImages = await Promise.all(
    imagePaths.map(async (imagePath) => {
      // Extract file name from path
      const fileName = imagePath.split('/').pop() || `image-${Date.now()}.jpg`;
      
      // Read the image file
      const imageFile = await fs.promises.readFile(imagePath);
      
      // Upload to Supabase Storage
      const imageUrl = await uploadImage(imageFile, fileName, documentId);
      
      if (!imageUrl) {
        console.error(`Failed to upload image: ${imagePath}`);
        return null;
      }
      
      // Process the image (analyze content, extract text, etc.)
      const analysis = await analyzeImage(imagePath);
      
      return {
        url: imageUrl,
        originalPath: imagePath,
        analysis,
        page: getPageNumberFromImagePath(imagePath)
      };
    })
  );
  
  // Filter out failed uploads
  const validImages = processedImages.filter(img => img !== null) as ProcessedImage[];
  
  // Continue with existing logic to create multi-modal chunks
  // ...existing code...
  
  // Update chunk metadata to use image URLs instead of file paths
  return chunks.map(chunk => {
    if (chunk.hasVisualContent && chunk.visualContent) {
      chunk.visualContent = chunk.visualContent.map(visual => ({
        ...visual,
        // Replace file paths with URLs
        filePath: undefined,
        url: visual.url || validImages.find(img => 
          img.originalPath === visual.filePath)?.url || ''
      }));
    }
    return chunk;
  });
}
```

### 3.5 Update Rebuild Vector Store Script

Update the `scripts/rebuildVectorStoreGemini.js` script to use the factory pattern:

```typescript
// scripts/rebuildVectorStoreGemini.ts

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { embedText, embedBatch } from '../utils/embeddingClient.js';
import { addToVectorStore } from '../utils/vectorStoreFactory';  // <-- Use factory instead of direct import
import { splitIntoChunksWithContext } from '../utils/documentProcessing.js';
import { processDocumentWithGemini } from '../utils/geminiProcessor';
import { logInfo, logError } from '../utils/errorHandling';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Check if USE_SUPABASE is enabled
const useSupabase = process.env.USE_SUPABASE === 'true';
logInfo(`Rebuilding vector store using ${useSupabase ? 'Supabase' : 'file-based'} storage`);

// Main rebuild function - existing implementation
async function rebuildVectorStore() {
  // ... existing code ...
  
  // Process each document
  for (const document of documents) {
    try {
      // ... existing document processing code ...
      
      // Use the factory-provided addToVectorStore function
      // This will route to either file-based or Supabase implementation
      // based on the USE_SUPABASE environment variable
      await addToVectorStore(vectorItems);
      
      // ... existing code ...
    } catch (error) {
      logError(`Error processing document ${document.filename}:`, error as Error);
    }
  }
  
  // ... existing code ...
}

// Run the rebuild
rebuildVectorStore()
  .then(() => {
    logInfo('Vector store rebuild completed successfully');
    process.exit(0);
  })
  .catch(error => {
    logError('Error rebuilding vector store:', error);
    process.exit(1);
  });
```

Similar updates should be made to all scripts that interact with the vector store, ensuring they use the factory pattern instead of direct imports of the file-based implementation.

## Phase 4: Advanced Implementation Patterns

### 4.1 Factory Pattern for Vector Store Transition

To ensure a smooth transition between file-based and Supabase storage systems, we've implemented a factory pattern that selects the appropriate implementation based on environment configuration:

```typescript
// utils/vectorStoreFactory.ts

import * as FileVectorStore from './vectorStore';
import * as SupabaseVectorStore from './supabaseVectorStore';
import { VectorStoreItem } from '../types/vectorStore';

// Check environment to determine which implementation to use
const useSupabase = process.env.USE_SUPABASE === 'true';

/**
 * Add items to the vector store
 */
export async function addToVectorStore(
  items: VectorStoreItem | VectorStoreItem[]
): Promise<void> {
  if (useSupabase) {
    return SupabaseVectorStore.addToVectorStore(items);
  } else {
    return FileVectorStore.addToVectorStore(items);
  }
}

// Additional functions following the same pattern...
```

This pattern allows gradual migration and easy rollback if needed. By setting the `USE_SUPABASE` environment variable, we can switch between implementations without changing application code.

### 4.2 Handling Unique IDs and Stats Tracking

When migrating to Supabase, we need to ensure proper tracking of unique document and chunk IDs:

```typescript
// Extract unique chunk IDs
const chunkIds = new Set();
chunkData.forEach((item: { metadata: string }) => {
  const metadata = JSON.parse(item.metadata || '{}');
  if (metadata.chunk_id) {
    chunkIds.add(metadata.chunk_id);
  }
});

const stats = {
  totalCount: totalCount || 0,
  documentCount: documentIds.size,
  chunkCount: chunkIds.size,
};
```

This approach ensures accurate statistics even when the same document has been chunked or processed multiple times.

### 4.3 Enhanced Vector Rebuild Script

The `rebuildVectorStoreGemini.ts` script has been updated to support both storage systems:

```typescript
// scripts/rebuildVectorStoreGemini.ts

import { addToVectorStore } from '../utils/vectorStoreFactory';  // Use factory instead of direct import

// Check if USE_SUPABASE is enabled
const useSupabase = process.env.USE_SUPABASE === 'true';
logInfo(`Rebuilding vector store using ${useSupabase ? 'Supabase' : 'file-based'} storage`);

// Process documents and add to vector store using the factory
// This will route to either file-based or Supabase implementation
await addToVectorStore(vectorItems);
```

This script now handles both storage mechanisms transparently, making migration much simpler.

## Phase 5: Database Migration Process

### 5.1 Detailed Migration Steps

The migration script (`migrateDbSchema.ts`) performs these key steps:

1. **Validate environment**: Ensures Supabase credentials are configured
2. **Check database state**: Warns if documents exist and confirms before proceeding
3. **Create utility functions**: Sets up SQL execution functions if needed
4. **Alter vector dimension**: Changes column type from VECTOR(1536) to VECTOR(768)
5. **Rebuild indices**: Drops and recreates optimized indices for the new dimension
6. **Update statistics tables**: Adjusts corpus statistics for BM25 search

```typescript
// Example migration step
{
  description: "Update vector column to 768 dimensions",
  sql: `
    ALTER TABLE document_chunks 
    ALTER COLUMN embedding 
    TYPE vector(768)
  `
}
```

### 5.2 Rollback Strategy

In case of migration issues, a rollback plan is in place:

1. **Immediate rollback**: Set `USE_SUPABASE=false` to revert to file-based storage
2. **Database reset**: If schema changes cause issues, restore from backup
3. **Gradual transition**: Use the factory pattern to route new documents to Supabase while keeping existing documents in file storage during testing

### 5.3 Multi-Modal Compatibility

The migration includes special handling for multi-modal content:

1. **Storage integration**: Using Supabase Storage for visual content
2. **Reference management**: Maintaining proper references between text and visual elements
3. **Query optimization**: Enhanced indexing for multi-modal queries

### 5.4 Entity Handling and Metadata Management

The migration to Supabase requires careful handling of entity data and metadata serialization. Entity data is particularly important for search faceting, filtering, and semantic understanding:

#### Entity Serialization Strategy

Ensure consistent entity serialization when storing in Supabase:

```typescript
// utils/supabaseMetadataUtils.ts

import { ExtractedEntity } from '../types/metadata';

/**
 * Prepare metadata for storage in Supabase
 * Properly handles entity serialization
 */
export function prepareMetadataForStorage(metadata: Record<string, any>): Record<string, any> {
  const prepared = { ...metadata };
  
  // Ensure entities are properly serialized
  if (prepared.entities) {
    if (Array.isArray(prepared.entities)) {
      // Convert to string to ensure consistent storage
      prepared.entities = JSON.stringify(prepared.entities);
    } else if (typeof prepared.entities === 'object' && !Array.isArray(prepared.entities)) {
      // Legacy format with categorized entities - convert to string
      prepared.entities = JSON.stringify(prepared.entities);
    }
    // If already a string, keep as is
  }
  
  // Similar handling for other complex metadata fields
  if (prepared.keywords && Array.isArray(prepared.keywords)) {
    prepared.keywords = prepared.keywords.join(',');
  }
  
  return prepared;
}

/**
 * Process metadata retrieved from Supabase
 * Handles entity parsing and type conversion
 */
export function processMetadataFromStorage(metadata: Record<string, any>): Record<string, any> {
  const processed = { ...metadata };
  
  // Parse entities if they're stored as a string
  if (processed.entities && typeof processed.entities === 'string') {
    try {
      processed.entities = JSON.parse(processed.entities);
    } catch (error) {
      console.error('Error parsing entities:', error);
      processed.entities = [];
    }
  }
  
  // Convert numeric values that might have been stored as strings
  if (processed.technicalLevel && typeof processed.technicalLevel === 'string') {
    processed.technicalLevel = parseInt(processed.technicalLevel, 10);
  }
  
  // Convert boolean values that might have been stored as strings
  ['isAuthoritative', 'isDeprecated', 'hasVisualContent'].forEach(field => {
    if (processed[field] && typeof processed[field] === 'string') {
      processed[field] = processed[field].toLowerCase() === 'true';
    }
  });
  
  return processed;
}
```

#### Entity Search Optimization

Implement optimized queries for entity search in Supabase:

```sql
-- Create a GIN index for faster entity searches
CREATE INDEX document_chunks_entities_idx ON document_chunks 
USING GIN ((metadata->'entities') jsonb_path_ops);

-- Function to search by entity name
CREATE OR REPLACE FUNCTION search_by_entity(
  entity_name TEXT,
  entity_type TEXT DEFAULT NULL,
  confidence TEXT DEFAULT NULL,
  limit_val INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  text TEXT,
  metadata JSONB,
  entity_match JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.text,
    dc.metadata,
    jsonb_path_query(dc.metadata->'entities', '$[*] ? (@.name like_regex $1 flag "i")')::jsonb AS entity_match
  FROM
    document_chunks dc
  WHERE
    dc.metadata->'entities' @> jsonb_path_query_array(
      jsonb_build_array(),
      '$[*] ? (@.name like_regex $1 flag "i"' || 
      CASE WHEN entity_type IS NOT NULL THEN ' && @.type == $2' ELSE '' END ||
      CASE WHEN confidence IS NOT NULL THEN ' && @.confidence == $3' ELSE '' END ||
      ')',
      entity_name,
      entity_type,
      confidence
    )
  ORDER BY
    jsonb_path_query(dc.metadata->'entities', '$[*] ? (@.name like_regex $1 flag "i").mentions')::int DESC
  LIMIT limit_val;
END;
$$;
```

#### Handling Legacy Entity Formats

Our migration needs to properly handle legacy entity formats:

```typescript
// During migration, normalize all entity formats
async function normalizeEntities() {
  const { data, error } = await supabase
    .from('vector_items')
    .select('id, metadata')
    .not('metadata->entities', 'is', null);
  
  if (error) {
    logError('Error retrieving entities for normalization:', error);
    return;
  }
  
  for (const item of data) {
    try {
      // Parse the metadata
      const metadata = typeof item.metadata === 'string' 
        ? JSON.parse(item.metadata) 
        : item.metadata;
      
      // Parse entities with our utility that handles legacy formats
      const parsedEntities = parseEntities(metadata.entities);
      
      // Serialize back to consistent format
      const serializedEntities = serializeEntities(parsedEntities);
      
      // Update the item with normalized entities
      const updatedMetadata = {
        ...metadata,
        entities: serializedEntities
      };
      
      await supabase
        .from('vector_items')
        .update({ metadata: updatedMetadata })
        .eq('id', item.id);
      
    } catch (error) {
      logError(`Error normalizing entities for item ${item.id}:`, error);
    }
  }
  
  logInfo(`Normalized entities for ${data.length} items`);
}
```

This approach ensures consistent entity handling across the database, regardless of how they were originally stored or formatted.

## Phase 6: Performance Optimization

### 6.1 Advanced Indexing Strategies

For improved performance with larger datasets, implement these indexing strategies:

```sql
-- Create specialized indices for different query patterns
CREATE INDEX document_chunks_category_embedding_idx 
ON document_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE metadata->>'category' IS NOT NULL;

-- Composite index for filtered queries
CREATE INDEX document_chunks_technical_level_idx
ON document_chunks (
  (metadata->>'technical_level')::int
)
WHERE (metadata->>'technical_level') IS NOT NULL;
```

### 6.2 Connection Pooling Configuration

For production deployment, optimize connection pooling:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.SUPABASE_POSTGRES_URL,
  max: 20, // Maximum number of clients
  idleTimeoutMillis: 30000,
  statement_timeout: 10000, // Prevent long-running queries
  connectionTimeoutMillis: 5000 // Fail fast if connection can't be established
});
```

### 6.3 Query Optimization

Implement query timeouts and cancellation for better user experience:

```typescript
// Set query timeout to prevent long-running queries
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const response = await supabase
    .from('document_chunks')
    .select('*')
    .limit(10)
    .abortSignal(controller.signal);
  
  // Process response...
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Query timed out');
  } else {
    console.error('Query error:', error);
  }
} finally {
  clearTimeout(timeoutId);
}
```

## Phase 7: Monitoring and Maintenance

### 7.1 Health Checks and Alerting

Implement comprehensive health checks for the Supabase integration:

```typescript
// utils/dbHealthCheck.ts

import { createClient } from '@supabase/supabase-js';
import { logError, logInfo } from './errorHandling';

// Run health check
export async function runHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  metrics: Record<string, number>;
}> {
  const issues: string[] = [];
  const metrics: Record<string, number> = {};
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string
  );
  
  try {
    // Test database connectivity
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('vector_items')
      .select('count(*)', { count: 'exact', head: true });
    
    const responseTime = Date.now() - startTime;
    metrics.responseTimeMs = responseTime;
    
    if (error) {
      issues.push(`Database connection error: ${error.message}`);
    } else {
      // Get total count
      metrics.totalItems = data.count || 0;
      
      // Check vector store stats
      try {
        const stats = await getSupabaseVectorStoreStats();
        metrics.documentCount = stats.documentCount;
        metrics.chunkCount = stats.chunkCount;
        
        // Check for anomalies
        if (metrics.totalItems > 0 && metrics.documentCount === 0) {
          issues.push('Database contains items but no documents');
        }
      } catch (error) {
        issues.push(`Stats check error: ${(error as Error).message}`);
      }
      
      // Check recent activity
      try {
        const { data: recentData, error: recentError } = await supabase
          .from('vector_items')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (!recentError && recentData && recentData.length > 0) {
          const lastItemAge = Date.now() - new Date(recentData[0].created_at).getTime();
          metrics.lastItemAgeMs = lastItemAge;
          
          // Alert if no new items in 7 days (indicates potential ingestion issues)
          if (lastItemAge > 7 * 24 * 60 * 60 * 1000) {
            issues.push(`No new items in ${Math.floor(lastItemAge / (24 * 60 * 60 * 1000))} days`);
          }
        }
      } catch (error) {
        issues.push(`Recent activity check error: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    issues.push(`Unexpected error: ${(error as Error).message}`);
  }
  
  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (issues.length > 0) {
    status = issues.some(issue => issue.includes('connection error')) ? 'unhealthy' : 'degraded';
  }
  
  // Log results
  if (status === 'healthy') {
    logInfo(`Health check: ${status}, metrics: ${JSON.stringify(metrics)}`);
  } else {
    logError(`Health check: ${status}, issues: ${issues.join(', ')}`);
  }
  
  return { status, issues, metrics };
}
```

### 7.2 Enhanced Backup Strategy

Implement a comprehensive backup strategy for Supabase:

```bash
#!/bin/bash
# supabase-backup.sh

# Configuration
BACKUP_DIR="/path/to/backups"
RETENTION_DAYS=14
DATABASE_URL=$SUPABASE_DB_URL
TODAY=$(date +%Y%m%d)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup database
echo "Starting backup: $TODAY"
pg_dump "$DATABASE_URL" -F c -b -v -f "$BACKUP_DIR/vector_store_$TODAY.backup"

# Backup storage bucket (if applicable)
# Use Supabase CLI or storage API for this

# Verify backup integrity
pg_restore -l "$BACKUP_DIR/vector_store_$TODAY.backup" >/dev/null
if [ $? -eq 0 ]; then
  echo "Backup verification successful"
else
  echo "ERROR: Backup verification failed!"
  # Send alert (email, Slack, etc.)
  exit 1
fi

# Clean up old backups
find "$BACKUP_DIR" -name "vector_store_*.backup" -mtime +$RETENTION_DAYS -delete
echo "Cleaned up backups older than $RETENTION_DAYS days"

# Log success
echo "Backup completed successfully: $BACKUP_DIR/vector_store_$TODAY.backup"
```

Schedule this script to run daily:

```cron
# Run backup at 2 AM every day
0 2 * * * /path/to/supabase-backup.sh >> /var/log/supabase-backup.log 2>&1
```

### 7.3 Monitoring Dashboard

Create a monitoring dashboard for Supabase using their built-in features or a third-party tool like Grafana:

1. **Database metrics**:
   - Connection pool utilization
   - Query performance
   - Storage usage
   - Error rates

2. **Application metrics**:
   - Vector search latency
   - Ingest throughput
   - BM25 search performance
   - Cache hit rates

3. **Alerts**:
   - Database connectivity issues
   - High error rates
   - Long-running queries
   - Storage approaching limits

## Phase 8: Future Optimizations

### 8.1 Advanced Caching Strategy

For high-volume deployments, implement a multi-level caching strategy:

```typescript
import { createClient } from 'redis';

// Initialize Redis client
const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
});

// Connect to Redis
await redis.connect();

// Cache frequently accessed data with tiered expiration
async function cacheSimilarItems(query: string, results: any[], options: {
  tier: 'frequent' | 'standard' | 'rare'
}) {
  const cacheKey = `similar:${hash(query)}`;
  
  // Set expiration based on query frequency tier
  const expiration = {
    frequent: 3600, // 1 hour
    standard: 1800, // 30 minutes
    rare: 300       // 5 minutes
  }[options.tier];
  
  await redis.set(cacheKey, JSON.stringify(results), {
    EX: expiration
  });
}

// Implement cache warming for common queries
async function warmCache() {
  // Get common queries from query logs
  const { data: commonQueries } = await supabase
    .from('query_logs')
    .select('query, COUNT(*) as count')
    .group('query')
    .order('count', { ascending: false })
    .limit(20);
  
  // Pre-cache results for common queries
  for (const { query } of commonQueries) {
    const results = await performSearch(query);
    await cacheSimilarItems(query, results, { tier: 'frequent' });
  }
}
```

### 8.2 Sharding Strategy for Large Deployments

For deployments with millions of vectors, implement a sharding strategy:

```typescript
// Simplified example of a sharded vector store approach
class ShardedVectorStore {
  private shardCount: number;
  private shards: Map<number, VectorStore>;

  constructor(shardCount: number = 4) {
    this.shardCount = shardCount;
    this.shards = new Map();
    
    // Initialize shards
    for (let i = 0; i < shardCount; i++) {
      this.shards.set(i, new SupabaseVectorStore(`shard_${i}`));
    }
  }
  
  private getShardForItem(item: VectorStoreItem): number {
    // Determine shard based on metadata or document ID
    const docId = item.metadata?.document_id || '';
    return this.getShardForDocumentId(docId);
  }
  
  private getShardForDocumentId(documentId: string): number {
    // Simple hash-based sharding
    let hash = 0;
    for (let i = 0; i < documentId.length; i++) {
      hash = ((hash << 5) - hash) + documentId.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash) % this.shardCount;
  }
  
  // API methods that route to appropriate shards
  async addItems(items: VectorStoreItem[]): Promise<void> {
    // Group items by shard
    const itemsByShards = new Map<number, VectorStoreItem[]>();
    
    for (const item of items) {
      const shardId = this.getShardForItem(item);
      if (!itemsByShards.has(shardId)) {
        itemsByShards.set(shardId, []);
      }
      itemsByShards.get(shardId)!.push(item);
    }
    
    // Add items to each shard in parallel
    await Promise.all(
      Array.from(itemsByShards.entries()).map(([shardId, shardItems]) => 
        this.shards.get(shardId)!.addItems(shardItems)
      )
    );
  }
  
  async search(query: string, embedding: number[]): Promise<SearchResult[]> {
    // Search all shards in parallel
    const results = await Promise.all(
      Array.from(this.shards.values()).map(shard => 
        shard.search(query, embedding)
      )
    );
    
    // Merge and rank results
    return mergeAndRankResults(results.flat());
  }
}
```

## Conclusion

This migration plan takes advantage of the current vector store purge to implement a clean transition to Supabase. By following these steps, we'll establish a scalable database architecture that can support multiple users, larger document collections, and improved query performance. 

The implementation of the factory pattern ensures a smooth transition and easy rollback if needed, while the advanced monitoring and maintenance strategies will help ensure the system remains reliable and performant over time.

With this migration, we're not just changing our storage system—we're building a foundation for future enhancements and growth of the Sales Knowledge Assistant.
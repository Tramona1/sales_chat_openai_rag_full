import dotenv from 'dotenv';
import path from 'path'; // Keep path for dotenv
import { supabase } from './supabaseClient';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Type definitions (Consider moving to a dedicated types file)
// Align this more closely with the document_chunks table + search results
export interface VectorStoreItem {
  id?: string; // Chunk ID (UUID)
  document_id?: string; // Document ID (UUID) - Required for adding
  chunk_index?: number; // Required for adding
  embedding: number[];
  text?: string; // Contextualized text (potentially)
  originalText?: string; // Original chunk text
  metadata?: any; // Keep flexible for now, align with DB jsonb
  context?: any; // Context field from document_chunks
  // Fields returned by search functions
  score?: number;
  similarity?: number;
  rank?: number;
  search_type?: string;
}

// TODO: Define more specific types based on Supabase schema if needed
// e.g., type DocumentChunk = Database['public']['Tables']['document_chunks']['Row'];

// Remove old file system imports and variables
// import fs from 'fs';
// import path from 'path';
// const VECTOR_STORE_DIR = path.join(process.cwd(), 'data', 'vector_batches');
// const BATCH_INDEX_FILE = path.join(process.cwd(), 'data', 'batch_index.json');
// const MAX_BATCH_SIZE = 1000;
// let vectorStore: VectorStoreItem[] = []; // REMOVED - No longer in-memory
// let activeBatches: string[] = []; // REMOVED

// REMOVED File I/O Functions:
// initVectorStore()
// loadVectorStore()
// createNewBatch()
// saveBatch()
// saveVectorStore()

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  // Keep this utility function as it's pure math
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    // console.error("Invalid vectors for cosine similarity", { aLength: vecA?.length, bLength: vecB?.length });
    return 0;
  }

  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const normA_sqrt = Math.sqrt(normA);
  const normB_sqrt = Math.sqrt(normB);

  if (normA_sqrt === 0 || normB_sqrt === 0) {
    // console.warn("Zero vector encountered in cosine similarity");
    return 0;
  }

  const similarity = dotProduct / (normA_sqrt * normB_sqrt);
  // Clamp similarity to [-1, 1] due to potential floating point inaccuracies
  return Math.max(-1, Math.min(1, similarity));
}

// --- Functions below need complete refactoring --- 

export async function addToVectorStore(items: VectorStoreItem | VectorStoreItem[]): Promise<void> {
  const itemsArray = Array.isArray(items) ? items : [items];
  if (itemsArray.length === 0) return;

  const chunksToInsert = itemsArray.map(item => {
    // Basic validation
    if (!item.document_id || item.chunk_index === undefined || !item.embedding) {
      console.error('Skipping item due to missing required fields (document_id, chunk_index, embedding):', item);
      return null;
    }
    return {
      document_id: item.document_id,
      chunk_index: item.chunk_index,
      embedding: item.embedding,
      original_text: item.originalText, // Assumes originalText exists
      text: item.text,                 // Assumes text (contextualized?) exists
      metadata: item.metadata || {},
      context: item.context || {}
      // created_at is handled by default value in DB
    };
  }).filter(item => item !== null); // Filter out invalid items

  if (chunksToInsert.length === 0) {
    console.warn('No valid items provided to addToVectorStore');
    return;
  }

  try {
    const { error } = await supabase
      .from('document_chunks')
      .insert(chunksToInsert as any); // Use 'as any' for now, refine type mapping later

    if (error) {
      console.error('Error adding items to Supabase vector store:', error);
      throw new Error(`Failed to add items to vector store: ${error.message}`);
    }
    console.log(`Successfully added ${chunksToInsert.length} items to the vector store.`);
  } catch (error) {
    console.error('Supabase operation failed in addToVectorStore:', error);
    // Re-throw or handle as appropriate for the application
    throw error;
  }
}

export async function getSimilarItems(
  queryEmbedding: number[],
  limit: number = 5,
  options?: { match_threshold?: number } // Add options object for flexibility
): Promise<(VectorStoreItem & { score: number })[]> { // Ensure score is part of the return type

  const match_threshold = options?.match_threshold ?? 0.7; // Default threshold
  const match_count = limit;

  try {
    const { data, error } = await supabase.rpc('search_vectors', {
      query_embedding: queryEmbedding,
      match_threshold,
      match_count
    });

    if (error) {
      console.error('Error fetching similar items from Supabase:', error);
      throw new Error(`Failed to get similar items: ${error.message}`);
    }

    if (!data) {
    return [];
  }
  
    // Map RPC result (which includes 'similarity') to VectorStoreItem & { score: number }
    const results: (VectorStoreItem & { score: number })[] = data.map((item: any) => ({
      id: item.id,
      document_id: item.document_id,
      chunk_index: item.chunk_index,
      // We defined the search_vectors function to return original_text as 'content'
      originalText: item.content, 
      metadata: item.metadata,
      embedding: [], // Embedding not returned by search_vectors, set empty array
      score: item.similarity // Map similarity to score
    }));

    return results;

  } catch (error) {
    console.error('Supabase RPC failed in getSimilarItems:', error);
    // Re-throw or handle as appropriate for the application
    throw error;
  }
}

export async function clearVectorStore(): Promise<void> {
  // TODO: Refactor to delete from Supabase tables. BE CAREFUL!
  console.warn('clearVectorStore is a destructive operation and currently only logs a warning.');
  console.warn('To implement, it should delete from document_chunks and potentially documents tables.');
  console.warn('Example (USE WITH EXTREME CAUTION):');
  console.warn('// const { error: chunkError } = await supabase.from(\'document_chunks\').delete().neq(\'id\', \'00000000-0000-0000-0000-000000000000\'); // Delete all chunks');
  console.warn('// const { error: docError } = await supabase.from(\'documents\').delete().neq(\'id\', \'00000000-0000-0000-0000-000000000000\'); // Delete all documents');
  // Implementation removed - was clearing memory and deleting files
}

export async function getVectorStoreSize(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error fetching vector store size from Supabase:', error);
      throw new Error(`Failed to get vector store size: ${error.message}`);
    }
    return count ?? 0;
  } catch (error) {
    console.error('Supabase operation failed in getVectorStoreSize:', error);
    throw error;
  }
}

export async function getAllVectorStoreItems(): Promise<VectorStoreItem[]> {
  // WARNING: Fetching all items can be inefficient for large datasets.
  // Consider adding pagination or filtering in a real application.
  console.warn('Fetching all vector store items. This might be inefficient for large datasets.')
  try {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id, document_id, chunk_index, original_text, text, metadata, context');

    if (error) {
      console.error('Error fetching all vector store items from Supabase:', error);
      throw new Error(`Failed to get all vector store items: ${error.message}`);
    }

    // Map Supabase rows to VectorStoreItem type
    const results: VectorStoreItem[] = (data || []).map((item: any) => ({
      id: item.id,
      document_id: item.document_id,
      chunk_index: item.chunk_index,
      originalText: item.original_text,
      text: item.text,
      metadata: item.metadata,
      context: item.context,
      embedding: [] // Embedding not selected by default
    }));

    return results;
  } catch (error) {
    console.error('Supabase operation failed in getAllVectorStoreItems:', error);
    throw error;
  }
}

// Initial load is no longer needed as we query DB directly
// loadVectorStore(); 
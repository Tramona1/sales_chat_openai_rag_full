/**
 * Vector Store Factory
 * 
 * This factory module selects between file-based and Supabase vector store implementations
 * based on the USE_SUPABASE environment variable.
 */

import { logInfo, logError } from './logger';
import { VectorStoreItem } from './vectorStore';

// Determine if we should use Supabase
const useSupabase = process.env.USE_SUPABASE === 'true';

// Log which implementation is being used
logInfo(`Using ${useSupabase ? 'Supabase' : 'file-based'} vector store implementation`);

/**
 * Add item(s) to the vector store
 * @param items Single item or array of items to add to vector store
 */
export async function addToVectorStore(items: VectorStoreItem | VectorStoreItem[]): Promise<void> {
  if (useSupabase) {
    // Import dynamically to avoid circular dependencies
    const { insertDocumentChunks } = await import('./supabaseClient');
    const itemsArray = Array.isArray(items) ? items : [items];
    
    try {
      // Convert VectorStoreItems to the format expected by Supabase
      const chunks = itemsArray.map(item => ({
        document_id: item.document_id,
        chunk_index: item.chunk_index,
        content: item.text,
        original_text: item.originalText,
        embedding: item.embedding,
        metadata: item.metadata || {}
      }));
      
      await insertDocumentChunks(chunks);
    } catch (error) {
      logError('Error adding items to Supabase vector store', error);
      throw error;
    }
  } else {
    // Use file-based implementation
    const { addToVectorStore: fileAddToVectorStore } = await import('./vectorStore');
    await fileAddToVectorStore(items);
  }
}

/**
 * Get similar items from the vector store
 * @param queryEmbedding Vector embedding to compare against
 * @param limit Maximum number of results to return
 * @param options Additional options for the search
 */
export async function getSimilarItems(
  queryEmbedding: number[],
  limit: number = 5,
  options?: { match_threshold?: number }
): Promise<(VectorStoreItem & { score: number })[]> {
  if (useSupabase) {
    // Import dynamically to avoid circular dependencies
    const { hybridSearch } = await import('./supabaseClient');
    
    try {
      // Query Supabase using the hybrid search function
      const results = await hybridSearch('', limit, options?.match_threshold || 0.5);
      
      // Format results to match the expected VectorStoreItem format
      return results.map((item: any) => ({
        id: item.id,
        document_id: item.document_id,
        text: item.content,
        embedding: [], // Supabase doesn't return the embedding
        metadata: item.metadata,
        score: item.similarity
      }));
    } catch (error) {
      logError('Error getting similar items from Supabase', error);
      throw error;
    }
  } else {
    // Use file-based implementation
    const { getSimilarItems: fileGetSimilarItems } = await import('./vectorStore');
    return fileGetSimilarItems(queryEmbedding, limit, options);
  }
}

/**
 * Get the size of the vector store
 */
export async function getVectorStoreSize(): Promise<number> {
  if (useSupabase) {
    // Import dynamically to avoid circular dependencies
    const { supabase } = await import('./supabaseClient');
    
    try {
      const { count, error } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        throw error;
      }
      
      return count || 0;
    } catch (error) {
      logError('Error getting vector store size from Supabase', error);
      throw error;
    }
  } else {
    // Use file-based implementation
    const { getVectorStoreSize: fileGetVectorStoreSize } = await import('./vectorStore');
    return fileGetVectorStoreSize();
  }
}

/**
 * Get all items from the vector store
 */
export async function getAllVectorStoreItems(): Promise<VectorStoreItem[]> {
  if (useSupabase) {
    // Import dynamically to avoid circular dependencies
    const { supabase } = await import('./supabaseClient');
    
    try {
      const { data, error } = await supabase
        .from('document_chunks')
        .select('id, document_id, chunk_index, content, original_text, metadata');
      
      if (error) {
        throw error;
      }
      
      // Format results to match the expected VectorStoreItem format
      return (data || []).map((item: any) => ({
        id: item.id,
        document_id: item.document_id,
        chunk_index: item.chunk_index,
        text: item.content,
        originalText: item.original_text,
        embedding: [], // Embeddings are not returned by default
        metadata: item.metadata
      }));
    } catch (error) {
      logError('Error getting all vector store items from Supabase', error);
      throw error;
    }
  } else {
    // Use file-based implementation
    const { getAllVectorStoreItems: fileGetAllVectorStoreItems } = await import('./vectorStore');
    return fileGetAllVectorStoreItems();
  }
}

/**
 * Clear the vector store
 */
export async function clearVectorStore(): Promise<void> {
  if (useSupabase) {
    // Import dynamically to avoid circular dependencies
    const { supabase } = await import('./supabaseClient');
    
    try {
      // Warning: This is a destructive operation!
      const { error: chunksError } = await supabase
        .from('document_chunks')
        .delete()
        .not('id', 'eq', '00000000-0000-0000-0000-000000000000'); // Delete all except placeholder
      
      if (chunksError) {
        throw chunksError;
      }
      
      logInfo('Successfully cleared document_chunks table');
    } catch (error) {
      logError('Error clearing vector store in Supabase', error);
      throw error;
    }
  } else {
    // Use file-based implementation
    const { clearVectorStore: fileClearVectorStore } = await import('./vectorStore');
    await fileClearVectorStore();
  }
} 
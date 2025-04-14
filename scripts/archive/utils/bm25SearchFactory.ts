/**
 * BM25 Search Factory
 * 
 * This factory module selects between file-based and Supabase BM25 search implementations
 * based on the USE_SUPABASE environment variable.
 */

import { logInfo, logError } from './logger';
import { VectorStoreItem } from './vectorStore';

// Determine if we should use Supabase
const useSupabase = process.env.USE_SUPABASE === 'true';

// Log which implementation is being used
logInfo(`Using ${useSupabase ? 'Supabase' : 'file-based'} BM25 search implementation`);

/**
 * Interface for search result item from BM25 search
 */
export interface BM25SearchResult {
  item: VectorStoreItem;
  score: number;
  bm25Score: number;
}

/**
 * Perform BM25 keyword search
 * 
 * @param query The search query
 * @param limit Maximum number of results to return
 * @param filter Optional filter to apply to results
 * @returns Array of search results with scores
 */
export async function performBM25Search(
  query: string,
  limit: number = 10,
  filter?: (item: VectorStoreItem) => boolean
): Promise<BM25SearchResult[]> {
  if (useSupabase) {
    // Import dynamically to avoid circular dependencies
    const { supabase } = await import('./supabaseClient');
    
    try {
      // Call the Supabase RPC function for BM25 search
      const { data, error } = await supabase.rpc('search_documents_bm25', {
        query_text: query,
        match_count: limit
      });
      
      if (error) {
        throw error;
      }
      
      // Format results to match the expected BM25SearchResult format
      return (data || []).map((item: any) => {
        const vectorItem: VectorStoreItem = {
          id: item.id,
          document_id: item.document_id,
          text: item.content,
          embedding: [], // BM25 search doesn't use embeddings
          metadata: item.metadata
        };
        
        // Apply filter if provided
        if (filter && !filter(vectorItem)) {
          return null;
        }
        
        return {
          item: vectorItem,
          score: item.rank_score,
          bm25Score: item.rank_score
        };
      }).filter((result: BM25SearchResult | null) => result !== null) as BM25SearchResult[];
      
    } catch (error) {
      logError('Error performing BM25 search in Supabase', error);
      return [];
    }
  } else {
    // Use file-based implementation
    try {
      const { performBM25Search: filePerformBM25Search } = await import('./bm25Search');
      return filePerformBM25Search(query, limit, filter);
    } catch (error) {
      logError('Error performing file-based BM25 search', error);
      return [];
    }
  }
}

/**
 * Calculate BM25 corpus statistics
 */
export async function updateBM25CorpusStatistics(): Promise<void> {
  if (useSupabase) {
    // Import dynamically to avoid circular dependencies
    const { supabase } = await import('./supabaseClient');
    
    try {
      // Call the Supabase RPC function to rebuild BM25 statistics
      const { error } = await supabase.rpc('rebuild_bm25_statistics');
      
      if (error) {
        throw error;
      }
      
      logInfo('Successfully updated BM25 corpus statistics in Supabase');
    } catch (error) {
      logError('Error updating BM25 corpus statistics in Supabase', error);
      throw error;
    }
  } else {
    // Use file-based implementation
    try {
      const { calculateCorpusStatistics, saveCorpusStatistics } = await import('./bm25');
      // Get all vector store items to calculate statistics
      const { getAllVectorStoreItems } = await import('./vectorStore');
      const documents = await getAllVectorStoreItems();
      const stats = await calculateCorpusStatistics(documents);
      await saveCorpusStatistics(stats);
      logInfo('Successfully updated BM25 corpus statistics in file-based storage');
    } catch (error) {
      logError('Error updating BM25 corpus statistics in file-based storage', error);
      throw error;
    }
  }
} 
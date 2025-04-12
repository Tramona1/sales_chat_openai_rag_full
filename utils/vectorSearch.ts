/**
 * Vector Search Utilities
 * 
 * This module provides functions for performing vector-based similarity search.
 */

import { VectorStoreItem } from './vectorStore';
import { cosineSimilarity, getSimilarItems } from './vectorStore';
import { embedText } from './embeddingClient';
import { logError } from './logger';

/**
 * Interface for search result item from vector search
 */
export interface VectorSearchResult {
  item: VectorStoreItem;
  score: number;
  vectorScore: number;
}

/**
 * Perform vector search using cosine similarity
 * 
 * @param query The search query or embedding vector
 * @param limit Maximum number of results to return
 * @param filter Optional filter to apply to results
 * @returns Array of search results with scores
 */
export async function performVectorSearch(
  query: string | number[],
  limit: number = 10,
  filter?: (item: VectorStoreItem) => boolean
): Promise<VectorSearchResult[]> {
  try {
    // Convert query to embedding if it's a string
    const queryEmbedding = Array.isArray(query) ? query : await embedText(query);
    
    // Get similar items from vector store
    const results = await getSimilarItems(queryEmbedding, limit * 2);
    
    // Apply filter if provided
    const filteredResults = filter 
      ? results.filter((result: VectorStoreItem & { score: number }) => filter(result))
      : results;
    
    // Format results
    return filteredResults.slice(0, limit).map((result: VectorStoreItem & { score: number }) => ({
      item: result,
      score: result.score,
      vectorScore: result.score
    }));
  } catch (error) {
    logError('Error in performVectorSearch', error as Error);
    return [];
  }
} 
/**
 * BM25 Keyword Search Utilities
 * 
 * This module provides functions for performing keyword-based search using the BM25 algorithm.
 */

import { VectorStoreItem } from './vectorStore';
import { tokenize, calculateBM25Score, getCorpusStatistics } from './bm25';
import { logError } from './logger';

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
  try {
    // Get corpus statistics
    const corpusStats = await getCorpusStatistics();
    
    // Get all items from the vector store using require instead of dynamic import
    const { getAllVectorStoreItems } = require('./vectorStore');
    const allItems = getAllVectorStoreItems();
    
    // Calculate BM25 score for each item
    const scoredItems = allItems.map((item: VectorStoreItem) => {
      const document = {
        id: item.id || '',
        text: item.text ?? ''
      };
      
      const score = calculateBM25Score(query, document, corpusStats);
      
      return {
        item,
        score,
        bm25Score: score
      };
    });
    
    // Apply filter if provided
    const filteredResults = filter 
      ? scoredItems.filter((result: BM25SearchResult) => filter(result.item))
      : scoredItems;
    
    // Sort by score (descending) and take top results
    return filteredResults
      .sort((a: BM25SearchResult, b: BM25SearchResult) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    logError('Error in performBM25Search', error as Error);
    return [];
  }
} 
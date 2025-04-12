/**
 * BM25 Keyword Search Utilities
 *
 * This module provides functions for performing keyword-based search using the BM25 algorithm.
 */
import { VectorStoreItem } from './vectorStore';
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
export declare function performBM25Search(query: string, limit?: number, filter?: (item: VectorStoreItem) => boolean): Promise<BM25SearchResult[]>;

/**
 * Vector Search Utilities
 *
 * This module provides functions for performing vector-based similarity search.
 */
import { VectorStoreItem } from './vectorStore';
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
export declare function performVectorSearch(query: string | number[], limit?: number, filter?: (item: VectorStoreItem) => boolean): Promise<VectorSearchResult[]>;

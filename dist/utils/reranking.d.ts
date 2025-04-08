/**
 * Reranking Module for Smart Query Routing
 *
 * This module applies LLM-based reranking to improve search result ordering.
 */
import { HybridSearchResult } from './hybridSearch';
/**
 * Reranking configuration options
 */
export interface RerankOptions {
    model?: string;
    timeoutMs?: number;
    includeExplanations?: boolean;
}
/**
 * Result from the reranking process
 */
export interface RerankResult {
    original: HybridSearchResult;
    relevanceScore: number;
    explanation?: string;
}
/**
 * Reranks search results based on relevance to the query
 *
 * @param query The original user query
 * @param results The search results to rerank
 * @param topK Number of top results to return
 * @param options Optional reranking configuration
 * @returns Reranked results (topK of them)
 */
export declare function rerank(query: string, results: any[], topK?: number, options?: RerankOptions): Promise<any[]>;

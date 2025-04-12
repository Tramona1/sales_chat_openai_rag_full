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
    provider?: 'openai' | 'gemini';
    model?: string;
    timeoutMs?: number;
    includeExplanations?: boolean;
    useContextualInfo?: boolean;
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
/**
 * Options for multi-modal reranking with Gemini
 */
export interface MultiModalRerankOptions {
    /** Maximum number of results to return */
    limit?: number;
    /** Whether to include scores in the results */
    includeScores?: boolean;
    /** Whether to include visual context during reranking */
    useVisualContext?: boolean;
    /** Whether to prioritize visual results for visual queries */
    visualFocus?: boolean;
    /** Types of visuals to prioritize (if visual focus is enabled) */
    visualTypes?: string[];
    /** Maximum time to wait for reranking (ms) */
    timeoutMs?: number;
}
/**
 * Represents a search result item with reranking information
 */
interface RankedSearchResult {
    item: any;
    score: number;
    matchType?: string;
    matchedVisual?: any;
    explanation?: string;
    originalScore?: number;
    [key: string]: any;
}
/**
 * Specialized reranking function for multi-modal content using Gemini
 * This reranker is designed to process both text and visual context
 *
 * @param query The user query
 * @param results The search results to rerank
 * @param options Reranking options
 * @returns Reranked results optimized for multi-modal content
 */
export declare function rerankWithGemini(query: string, results: RankedSearchResult[], options?: MultiModalRerankOptions): Promise<RankedSearchResult[]>;
export {};

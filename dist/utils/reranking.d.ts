/**
 * Re-ranking Module
 *
 * This module provides LLM-based re-ranking functionality for search results,
 * improving result relevance by using AI to judge the quality of each result
 * in relation to the user's query.
 */
import { EnhancedRetrievalResult } from './enhancedRetrieval';
/**
 * Configuration options for re-ranking
 */
export interface RerankingOptions {
    returnTopN: number;
    model: string;
    parallelBatching: boolean;
    timeoutMs: number;
    batchSize: number;
    debug: boolean;
}
/**
 * Default re-ranking options
 */
export declare const DEFAULT_RERANKING_OPTIONS: RerankingOptions;
/**
 * Result from re-ranking
 */
export interface RerankingResult {
    originalResult: EnhancedRetrievalResult;
    rerankScore: number;
    finalScore: number;
}
/**
 * Re-rank search results using LLM relevance judgments
 *
 * This function takes the results from hybrid search and uses an LLM to
 * evaluate how relevant each document is to the original query.
 */
export declare function rerankResults(query: string, results: EnhancedRetrievalResult[], options?: Partial<RerankingOptions>): Promise<RerankingResult[]>;
/**
 * Enhanced version of reranking that provides explanation for each score
 * Useful for debugging and understanding why results were ranked as they were
 */
export declare function rerankResultsWithExplanations(query: string, results: EnhancedRetrievalResult[], options?: Partial<RerankingOptions>): Promise<(RerankingResult & {
    explanation: string;
})[]>;

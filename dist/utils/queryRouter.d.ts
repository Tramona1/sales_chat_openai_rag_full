/**
 * Query Router Module
 *
 * This module provides functionality to route queries to the appropriate retrieval strategy
 * based on query analysis, metadata, and category information.
 */
import { QueryAnalysis } from './queryAnalysis';
import { HybridSearchResult, SearchResult } from './hybridSearch';
export interface RouterSearchOptions {
    limit?: number;
    useQueryExpansion?: boolean;
    useReranking?: boolean;
    rerankCount?: number;
    applyMetadataFiltering?: boolean;
    fallbackToGeneral?: boolean;
    debug?: boolean;
}
type SearchResults = SearchResult[] | HybridSearchResult[];
/**
 * Routes a query through the intelligent retrieval pipeline
 *
 * This function:
 * 1. Analyzes the query to determine categories, type, etc.
 * 2. Derives optimal retrieval parameters
 * 3. Optionally expands the query
 * 4. Performs a hybrid search with metadata filtering
 * 5. Optionally re-ranks the results
 *
 * @param query The user query
 * @param options Search options
 * @returns The search results
 */
export declare function routeQuery(query: string, options?: RouterSearchOptions): Promise<{
    results: SearchResults;
    queryAnalysis: QueryAnalysis;
    processingTime: {
        analysis: number;
        expansion?: number;
        search: number;
        reranking?: number;
        total: number;
    };
}>;
/**
 * Converts search results to a format suitable for the response
 */
export declare function formatResults(results: HybridSearchResult[]): Array<{
    text: string;
    source: string;
    metadata: Record<string, any>;
    relevanceScore: number;
}>;
/**
 * Generate a brief explanation of search strategy based on query analysis
 */
export declare function explainSearchStrategy(queryAnalysis: QueryAnalysis): string;
export {};

/**
 * Query Expansion Module
 *
 * This module provides functionality to expand user queries with related terms
 * to improve retrieval performance, especially for complex or ambiguous queries.
 */
/**
 * Configuration options for query expansion
 */
export interface QueryExpansionOptions {
    maxExpandedTerms: number;
    model: string;
    useSemanticExpansion: boolean;
    useKeywordExpansion: boolean;
    semanticWeight: number;
    includeMetadata: boolean;
    timeoutMs: number;
    enableCaching: boolean;
    cacheTtlSeconds: number;
    debug: boolean;
}
/**
 * Default options for query expansion
 */
export declare const DEFAULT_EXPANSION_OPTIONS: QueryExpansionOptions;
/**
 * Result of query expansion
 */
export interface ExpandedQuery {
    originalQuery: string;
    expandedQuery: string;
    addedTerms: string[];
    expansionType: 'semantic' | 'keyword' | 'hybrid' | 'none';
    technicalLevel?: number;
    domainContext?: string;
    processingTimeMs?: number;
}
/**
 * Expand a query using semantic techniques (LLM-based)
 *
 * This approach uses language models to understand query intent
 * and generate related terms.
 */
export declare function semanticQueryExpansion(query: string, options?: Partial<QueryExpansionOptions>): Promise<string[]>;
/**
 * Expand a query using keyword-based techniques
 *
 * This simpler approach uses word forms, common synonyms, and
 * domain-specific transformations.
 */
export declare function keywordQueryExpansion(query: string, options?: Partial<QueryExpansionOptions>): string[];
/**
 * Analyze query to determine domain context and technical level
 */
export declare function analyzeQuery(query: string): Promise<{
    technicalLevel: number;
    domainContext: string;
    complexity: number;
}>;
/**
 * Main function to expand a query using multiple techniques
 */
export declare function expandQuery(query: string, options?: Partial<QueryExpansionOptions>): Promise<ExpandedQuery>;

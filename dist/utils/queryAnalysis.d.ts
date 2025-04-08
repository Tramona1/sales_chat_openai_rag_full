/**
 * Query Analysis Module for Intelligent Query Routing
 *
 * This module analyzes incoming queries to determine:
 * 1. Which entities are being referenced
 * 2. What category the query falls into
 * 3. The query's information need type
 *
 * This information is used to optimize retrieval parameters and improve results.
 */
import { DocumentCategory } from '../types/metadata';
export type QueryType = 'FACTUAL' | 'COMPARATIVE' | 'PROCEDURAL' | 'EXPLANATORY' | 'DEFINITIONAL' | 'EXPLORATORY';
export interface QueryEntity {
    name: string;
    type: string;
    confidence: number;
}
export interface QueryAnalysis {
    categories: DocumentCategory[];
    primaryCategory: DocumentCategory;
    entities: QueryEntity[];
    queryType: QueryType;
    technicalLevel: number;
    estimatedResultCount: number;
    isTimeDependent: boolean;
    query: string;
}
/**
 * Analyzes a query to extract entities and determine query characteristics
 *
 * @param query The user query to analyze
 * @returns Analysis result with entities, categories, and query type
 */
export declare function analyzeQuery(query: string): Promise<QueryAnalysis>;
/**
 * Determines the optimal retrieval parameters based on query analysis
 *
 * @param analysis The query analysis result
 * @returns Optimization parameters for retrieval
 */
export declare function getRetrievalParameters(analysis: QueryAnalysis): {
    limit: number;
    hybridRatio: number;
    rerank: boolean;
    rerankCount: number;
    categoryFilter: {
        categories: DocumentCategory[];
        strict: boolean;
    };
    technicalLevelRange: {
        min: number;
        max: number;
    };
    expandQuery: boolean;
};

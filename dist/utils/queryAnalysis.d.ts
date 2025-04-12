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
import { QueryIntent, RetrievalParameters, Entity } from '../types/queryAnalysis';
export type QueryType = 'FACTUAL' | 'COMPARATIVE' | 'PROCEDURAL' | 'EXPLANATORY' | 'DEFINITIONAL' | 'EXPLORATORY';
export interface QueryEntity {
    name: string;
    type: string;
    confidence: number;
}
export interface LocalQueryAnalysis {
    originalQuery: string;
    intent: QueryIntent;
    topics: string[];
    entities: Entity[];
    technicalLevel: number;
    primaryCategory: string;
    secondaryCategories?: string[];
    keywords?: string[];
    queryType?: string;
    expandedQuery?: string;
    isAmbiguous?: boolean;
    categories?: DocumentCategory[];
    estimatedResultCount?: number;
    isTimeDependent?: boolean;
    query?: string;
}
/**
 * Result of query context analysis for retrieval optimization
 */
export interface QueryContextAnalysis {
    /** Key search terms extracted from the query */
    searchTerms: string[];
    /** Likely topic categories for the query */
    topicCategories: string[];
    /** Technical complexity level (0-3) */
    technicalLevel: number;
    /** Type of answer expected for this query */
    expectedAnswerType: 'factual' | 'conceptual' | 'procedural' | 'comparative';
    /** Specific entities the query is focused on */
    entityFocus: string[];
    /** Whether the query is about visual content */
    visualFocus: boolean;
    /** Types of visual content the query might be asking about */
    visualTypes?: string[];
}
/**
 * Analyzes a query to extract entities and determine query characteristics
 *
 * @param query The user query to analyze
 * @returns Analysis result with entities, categories, and query type
 */
export declare function analyzeQuery(query: string): Promise<LocalQueryAnalysis>;
/**
 * Get optimized retrieval parameters based on query analysis
 *
 * @param analysis The query analysis
 * @returns Parameters for optimizing retrieval
 */
export declare function getRetrievalParameters(analysis: LocalQueryAnalysis): RetrievalParameters;
/**
 * Analyzes a query to determine visual focus, search terms, and other contextual information
 *
 * @param query The user query to analyze
 * @returns Analysis of query context with visual focus detection
 */
export declare function analyzeQueryForContext(query: string): Promise<QueryContextAnalysis>;
/**
 * Determines if a query is likely about visual content
 *
 * @param query - The search query to analyze
 * @returns True if the query is likely about visual content
 */
export declare function isQueryAboutVisuals(query: string): boolean;
/**
 * Interface for results from visual query analysis
 */
export interface VisualQueryAnalysis {
    /** Whether the query is about visual content */
    isVisualQuery: boolean;
    /** Specific types of visuals being requested */
    visualTypes: string[];
    /** Confidence score (0-1) */
    confidence: number;
    /** Whether the query is explicitly visual or implicitly visual */
    explicitVisualRequest: boolean;
}
/**
 * Analyze a query to determine if it's requesting visual content
 * and what specific type of visual content is being requested
 *
 * @param query - The search query to analyze
 * @returns Analysis of the visual aspects of the query
 */
export declare function analyzeVisualQuery(query: string): VisualQueryAnalysis;

/**
 * Hybrid Search Module for Smart Query Routing
 *
 * This module combines vector search and BM25 with metadata-aware filtering
 * to improve retrieval accuracy based on query analysis and document metadata.
 */
import { VectorStoreItem } from './vectorStore';
import { DocumentCategory } from '../types/metadata';
import { CategoryHierarchy } from './hierarchicalCategories';
interface Document {
    id: string;
    text: string;
    metadata?: Record<string, any>;
}
interface MetadataFilter {
    categories?: DocumentCategory[];
    strictCategoryMatch?: boolean;
    technicalLevelMin?: number;
    technicalLevelMax?: number;
    lastUpdatedAfter?: string;
    entities?: string[];
    keywords?: string[];
}
export interface SearchResult {
    item: Document;
    score: number;
    vectorScore?: number;
    bm25Score?: number;
}
export interface HybridSearchResult {
    item: VectorStoreItem;
    score: number;
    bm25Score: number;
    vectorScore: number;
    metadata: {
        matchesCategory: boolean;
        categoryBoost: number;
        technicalLevelMatch: number;
    };
}
export interface HybridSearchFilter {
    categories?: DocumentCategory[];
    strictCategoryMatch?: boolean;
    technicalLevelMin?: number;
    technicalLevelMax?: number;
    requiredEntities?: string[];
    customFilters?: Record<string, any>;
}
export interface HybridSearchOptions {
    limit?: number;
    includeDeprecated?: boolean;
    onlyAuthoritative?: boolean;
    priorityInfoType?: string;
    categoryPath?: string[];
    includeFacets?: boolean;
    technicalLevelRange?: {
        min: number;
        max: number;
    };
    entityFilters?: Record<string, string[]>;
}
export interface HybridSearchResponse {
    results: Array<VectorStoreItem & {
        score: number;
    }>;
    facets?: {
        categories: CategoryHierarchy[];
        entities: Record<string, Array<{
            name: string;
            count: number;
        }>>;
        technicalLevels: Array<{
            level: number;
            count: number;
        }>;
    };
    [Symbol.iterator](): Iterator<VectorStoreItem & {
        score: number;
    }>;
}
/**
 * Initialize the hybrid search system
 */
export declare function initializeHybridSearch(): Promise<void>;
/**
 * Perform hybrid search combining vector and BM25 search
 *
 * @param query The search query
 * @param limit Maximum number of results to return
 * @param hybridRatio Ratio of vector to BM25 scores (0-1, where 1 is all vector)
 * @param filter Optional metadata filters
 */
export declare function performHybridSearch(query: string, limit?: number, hybridRatio?: number, filter?: MetadataFilter): Promise<SearchResult[]>;
/**
 * Enhanced hybrid search that combines vector search with keyword-based content filtering
 * and can exclude deprecated documents
 *
 * @param query User query text
 * @param options Search options like limit, includeDeprecated, etc.
 * @returns Array of matching documents with scores
 */
export declare function hybridSearch(query: string, options?: HybridSearchOptions): Promise<HybridSearchResponse>;
/**
 * Perform multiple search variants and return the best results
 * This is used as a fallback if the primary search returns no results
 *
 * @param query User query text
 * @returns Best search results from various search variants
 */
export declare function fallbackSearch(query: string): Promise<(VectorStoreItem & {
    score: number;
})[]>;
export {};

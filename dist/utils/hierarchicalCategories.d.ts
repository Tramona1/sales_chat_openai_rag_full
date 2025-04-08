/**
 * Hierarchical Categories Management
 *
 * This module implements hierarchical category management for document classification
 * and navigation. It allows building parent-child relationships between categories
 * and navigating document collections through topic hierarchies.
 */
export interface CategoryHierarchy {
    id: string;
    displayName: string;
    documentCount: number;
    children: CategoryHierarchy[];
    name?: string;
    color?: string;
    description?: string;
    parentId?: string;
}
import { VectorStoreItem } from './vectorStore';
export declare const DEFAULT_CATEGORY_HIERARCHY: CategoryHierarchy[];
/**
 * Category path representation
 */
export interface CategoryPath {
    path: string[];
    displayPath: string[];
}
/**
 * Build a full category hierarchy from all available categories
 */
export declare function buildFullCategoryHierarchy(): CategoryHierarchy[];
/**
 * Extend VectorStoreItem metadata to clarify the metadata structure
 */
export interface EnhancedMetadata {
    source?: string;
    page?: number;
    batch?: string;
    isStructured?: boolean;
    infoType?: string;
    priority?: string;
    category?: string;
    technicalLevel?: number;
    entities?: string | Record<string, any[]>;
    keywords?: string;
    summary?: string;
    lastUpdated?: string;
    timestamp?: string;
    createdAt?: string;
    approvedAt?: string;
    isAuthoritative?: string;
    isDeprecated?: string;
    deprecatedBy?: string;
    deprecatedAt?: string;
    primaryCategory?: string;
    secondaryCategories?: string[];
    industryCategories?: string[];
    functionCategories?: string[];
    useCases?: string[];
}
/**
 * Define enhanced vector store item without conflicting with base interface
 */
export type EnhancedVectorStoreItem = VectorStoreItem & {
    metadata?: EnhancedMetadata;
};
/**
 * Flattens a category hierarchy into a single-level array
 */
export declare function flattenHierarchy(categories: CategoryHierarchy[]): CategoryHierarchy[];
/**
 * Rolls up counts from child categories to their parents
 */
export declare function rollUpCounts(categories: CategoryHierarchy[]): void;
/**
 * Build category hierarchy with document counts from a set of documents
 */
export declare function buildCategoryHierarchyWithCounts(documents: VectorStoreItem[]): CategoryHierarchy[];
/**
 * Get category path from category ID
 */
export declare function getCategoryPath(categoryId: string): CategoryPath;
/**
 * Extract category IDs from a path string (e.g., "product/features")
 */
export declare function parseCategoryPath(pathString: string): string[];
/**
 * Filter documents by category path
 */
export declare function filterDocumentsByCategoryPath(documents: VectorStoreItem[], categoryPath: string[]): VectorStoreItem[];
/**
 * Get all entity types from documents
 */
export declare function getAllEntitiesFromDocuments(documents: VectorStoreItem[]): Record<string, {
    name: string;
    count: number;
}[]>;
/**
 * Get technical level distribution from documents
 */
export declare function getTechnicalLevelDistribution(documents: VectorStoreItem[]): {
    level: number;
    count: number;
}[];
/**
 * Perform hierarchical search with facets
 */
export declare function hierarchicalSearch(query: string, options?: {
    limit?: number;
    categoryPath?: string[];
    includeFacets?: boolean;
    technicalLevelRange?: {
        min: number;
        max: number;
    };
    entityFilters?: Record<string, string[]>;
}): Promise<{
    results: VectorStoreItem[];
    facets?: {
        categories: {
            id: string;
            name: string;
            count: number;
            path: string[];
        }[];
        entities: Record<string, {
            name: string;
            count: number;
        }[]>;
        technicalLevels: {
            level: number;
            count: number;
        }[];
    };
}>;

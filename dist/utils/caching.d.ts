/**
 * Simple caching utilities for the RAG system
 *
 * Provides in-memory caching functionality for query results
 * to improve performance for repeated queries.
 */
/**
 * Generate a cache key for a query
 */
export declare function generateCacheKey(query: string): string;
/**
 * Check if a query result is cached
 */
export declare function getCachedResult(query: string): Promise<any | null>;
/**
 * Cache a query result
 */
export declare function cacheResult(query: string, result: any, ttlSeconds?: number): Promise<void>;
/**
 * Get cache statistics
 */
export declare function getCacheStats(): {
    size: number;
    activeEntries: number;
    expiredEntries: number;
};
/**
 * Clear the entire cache
 */
export declare function clearCache(): void;

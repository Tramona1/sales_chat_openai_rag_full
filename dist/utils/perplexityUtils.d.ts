/**
 * Perplexity API Utilities
 *
 * Utility functions specific to Perplexity API integration
 */
/**
 * Store data in cache with expiration time
 *
 * @param key Cache key
 * @param data Data to cache
 * @param ttl Time to live in milliseconds
 */
export declare function cacheWithExpiry(key: string, data: any, ttl: number): void;
/**
 * Get data from cache if not expired
 *
 * @param key Cache key
 * @returns Cached data or null if expired/not found
 */
export declare function getFromCache<T>(key: string): T | null;
/**
 * Remove an item from the cache
 *
 * @param key Cache key to invalidate
 */
export declare function invalidateCache(key: string): void;
/**
 * Clear all items from the cache
 */
export declare function clearCache(): void;
/**
 * Get cache statistics
 *
 * @returns Statistics about the cache
 */
export declare function getCacheStats(): {
    size: number;
    keys: string[];
    expiryTimes: Record<string, number>;
};
/**
 * Log detailed information on Perplexity API usage
 *
 * @param action The API action being performed
 * @param details Details about the API call
 * @param error Optional error if the call failed
 */
export declare function logPerplexityUsage(action: string, details: Record<string, any>, error?: any): void;

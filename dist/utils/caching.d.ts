/**
 * Simple caching utility for application data
 *
 * Provides in-memory caching with expiration for API responses
 * and other frequently accessed data.
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

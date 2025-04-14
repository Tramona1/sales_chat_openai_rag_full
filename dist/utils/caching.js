/**
 * Simple caching utility for application data
 *
 * Provides in-memory caching with expiration for API responses
 * and other frequently accessed data.
 */
const cache = {};
/**
 * Store data in cache with expiration time
 *
 * @param key Cache key
 * @param data Data to cache
 * @param ttl Time to live in milliseconds
 */
export function cacheWithExpiry(key, data, ttl) {
    const now = Date.now();
    const expiry = now + ttl;
    cache[key] = {
        data,
        expiry
    };
    // Optional: log caching for debugging
    console.log(`Cached data for key: ${key}, expires in ${ttl / 1000}s`);
}
/**
 * Get data from cache if not expired
 *
 * @param key Cache key
 * @returns Cached data or null if expired/not found
 */
export function getFromCache(key) {
    const item = cache[key];
    const now = Date.now();
    if (!item) {
        return null; // Not in cache
    }
    if (now > item.expiry) {
        // Expired, remove from cache
        delete cache[key];
        return null;
    }
    // Calculate remaining TTL for logging
    const remainingTtl = Math.round((item.expiry - now) / 1000);
    console.log(`Cache hit for key: ${key}, expires in ${remainingTtl}s`);
    return item.data;
}
/**
 * Remove an item from the cache
 *
 * @param key Cache key to invalidate
 */
export function invalidateCache(key) {
    if (cache[key]) {
        delete cache[key];
        console.log(`Invalidated cache for key: ${key}`);
    }
}
/**
 * Clear all items from the cache
 */
export function clearCache() {
    Object.keys(cache).forEach(key => {
        delete cache[key];
    });
    console.log('Cache cleared');
}
/**
 * Get cache statistics
 *
 * @returns Statistics about the cache
 */
export function getCacheStats() {
    const keys = Object.keys(cache);
    const expiryTimes = {};
    keys.forEach(key => {
        expiryTimes[key] = Math.round((cache[key].expiry - Date.now()) / 1000);
    });
    return {
        size: keys.length,
        keys,
        expiryTimes
    };
}

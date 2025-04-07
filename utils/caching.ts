/**
 * Caching Utility
 * 
 * Provides simple in-memory caching with expiry functionality.
 */

interface CacheEntry<T> {
  value: T;
  expiry: number | null;
}

// In-memory cache store
const cache: Record<string, CacheEntry<any>> = {};

/**
 * Stores a value in the cache with an optional expiry time
 * 
 * @param key Cache key
 * @param value Value to store
 * @param expiryMs Expiry time in milliseconds (optional)
 */
export function cacheWithExpiry<T>(key: string, value: T, expiryMs?: number): void {
  cache[key] = {
    value,
    expiry: expiryMs ? Date.now() + expiryMs : null
  };
}

/**
 * Retrieves a value from the cache if it exists and hasn't expired
 * 
 * @param key Cache key
 * @returns The cached value or null if not found or expired
 */
export function getFromCache<T>(key: string): T | null {
  const entry = cache[key];
  
  if (!entry) {
    return null;
  }
  
  // Check if entry has expired
  if (entry.expiry && Date.now() > entry.expiry) {
    delete cache[key]; // Remove expired entry
    return null;
  }
  
  return entry.value;
}

/**
 * Clears an item from the cache
 * 
 * @param key Cache key to clear
 */
export function clearCache(key: string): void {
  delete cache[key];
}

/**
 * Clears all items from the cache
 */
export function clearAllCache(): void {
  Object.keys(cache).forEach(key => {
    delete cache[key];
  });
}

/**
 * Gets cache statistics
 * 
 * @returns Object containing cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: Object.keys(cache).length,
    keys: Object.keys(cache)
  };
} 
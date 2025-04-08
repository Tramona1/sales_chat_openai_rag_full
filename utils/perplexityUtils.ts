/**
 * Perplexity API Utilities
 * 
 * Utility functions specific to Perplexity API integration
 */

import { logError } from './errorHandling';

// Simple in-memory cache object
interface CacheItem {
  data: any;
  expiry: number;
}

const cache: Record<string, CacheItem> = {};

/**
 * Store data in cache with expiration time
 * 
 * @param key Cache key
 * @param data Data to cache
 * @param ttl Time to live in milliseconds
 */
export function cacheWithExpiry(key: string, data: any, ttl: number): void {
  const now = Date.now();
  const expiry = now + ttl;
  
  cache[key] = {
    data,
    expiry
  };
  
  // Optional: log caching for debugging
  console.log(`Cached data for key: ${key}, expires in ${ttl/1000}s`);
}

/**
 * Get data from cache if not expired
 * 
 * @param key Cache key
 * @returns Cached data or null if expired/not found
 */
export function getFromCache<T>(key: string): T | null {
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
  
  return item.data as T;
}

/**
 * Remove an item from the cache
 * 
 * @param key Cache key to invalidate
 */
export function invalidateCache(key: string): void {
  if (cache[key]) {
    delete cache[key];
    console.log(`Invalidated cache for key: ${key}`);
  }
}

/**
 * Clear all items from the cache
 */
export function clearCache(): void {
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
export function getCacheStats(): {
  size: number;
  keys: string[];
  expiryTimes: Record<string, number>;
} {
  const keys = Object.keys(cache);
  const expiryTimes: Record<string, number> = {};
  
  keys.forEach(key => {
    expiryTimes[key] = Math.round((cache[key].expiry - Date.now()) / 1000);
  });
  
  return {
    size: keys.length,
    keys,
    expiryTimes
  };
}

/**
 * Log detailed information on Perplexity API usage
 * 
 * @param action The API action being performed
 * @param details Details about the API call
 * @param error Optional error if the call failed
 */
export function logPerplexityUsage(
  action: string, 
  details: Record<string, any>, 
  error?: any
): void {
  if (error) {
    logError(`Perplexity API error during ${action}`, error);
    // Log details separately if needed
    console.log(`[Perplexity API details]`, JSON.stringify(details, null, 2));
  } else {
    console.log(`[Perplexity API] ${action}:`, JSON.stringify(details, null, 2));
  }
} 
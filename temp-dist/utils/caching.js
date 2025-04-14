"use strict";
/**
 * Simple caching utility for application data
 *
 * Provides in-memory caching with expiration for API responses
 * and other frequently accessed data.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheWithExpiry = cacheWithExpiry;
exports.getFromCache = getFromCache;
exports.invalidateCache = invalidateCache;
exports.clearCache = clearCache;
exports.getCacheStats = getCacheStats;
var cache = {};
/**
 * Store data in cache with expiration time
 *
 * @param key Cache key
 * @param data Data to cache
 * @param ttl Time to live in milliseconds
 */
function cacheWithExpiry(key, data, ttl) {
    var now = Date.now();
    var expiry = now + ttl;
    cache[key] = {
        data: data,
        expiry: expiry
    };
    // Optional: log caching for debugging
    console.log("Cached data for key: ".concat(key, ", expires in ").concat(ttl / 1000, "s"));
}
/**
 * Get data from cache if not expired
 *
 * @param key Cache key
 * @returns Cached data or null if expired/not found
 */
function getFromCache(key) {
    var item = cache[key];
    var now = Date.now();
    if (!item) {
        return null; // Not in cache
    }
    if (now > item.expiry) {
        // Expired, remove from cache
        delete cache[key];
        return null;
    }
    // Calculate remaining TTL for logging
    var remainingTtl = Math.round((item.expiry - now) / 1000);
    console.log("Cache hit for key: ".concat(key, ", expires in ").concat(remainingTtl, "s"));
    return item.data;
}
/**
 * Remove an item from the cache
 *
 * @param key Cache key to invalidate
 */
function invalidateCache(key) {
    if (cache[key]) {
        delete cache[key];
        console.log("Invalidated cache for key: ".concat(key));
    }
}
/**
 * Clear all items from the cache
 */
function clearCache() {
    Object.keys(cache).forEach(function (key) {
        delete cache[key];
    });
    console.log('Cache cleared');
}
/**
 * Get cache statistics
 *
 * @returns Statistics about the cache
 */
function getCacheStats() {
    var keys = Object.keys(cache);
    var expiryTimes = {};
    keys.forEach(function (key) {
        expiryTimes[key] = Math.round((cache[key].expiry - Date.now()) / 1000);
    });
    return {
        size: keys.length,
        keys: keys,
        expiryTimes: expiryTimes
    };
}

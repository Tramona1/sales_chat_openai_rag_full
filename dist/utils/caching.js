"use strict";
/**
 * Simple caching utilities for the RAG system
 *
 * Provides in-memory caching functionality for query results
 * to improve performance for repeated queries.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCacheKey = generateCacheKey;
exports.getCachedResult = getCachedResult;
exports.cacheResult = cacheResult;
exports.getCacheStats = getCacheStats;
exports.clearCache = clearCache;
const crypto_1 = __importDefault(require("crypto"));
// Simple in-memory cache
const cache = {};
/**
 * Generate a cache key for a query
 */
function generateCacheKey(query) {
    return `query:${crypto_1.default.createHash('sha256').update(query).digest('hex')}`;
}
/**
 * Check if a query result is cached
 */
async function getCachedResult(query) {
    try {
        const cacheKey = generateCacheKey(query);
        const entry = cache[cacheKey];
        if (entry && entry.expiresAt > Date.now()) {
            console.log('Cache hit for query:', query);
            return entry.data;
        }
        if (entry) {
            // Expired entry, clean up
            console.log('Cache entry expired for query:', query);
            delete cache[cacheKey];
        }
        return null;
    }
    catch (error) {
        console.error('Error retrieving from cache:', error);
        return null;
    }
}
/**
 * Cache a query result
 */
async function cacheResult(query, result, ttlSeconds = 3600) {
    try {
        const cacheKey = generateCacheKey(query);
        const expiresAt = Date.now() + (ttlSeconds * 1000);
        cache[cacheKey] = {
            data: result,
            expiresAt
        };
        console.log(`Cached result for query "${query}" (expires in ${ttlSeconds}s)`);
        // Cleanup old entries every 100 cache operations
        if (Math.random() < 0.01) {
            cleanupExpiredEntries();
        }
    }
    catch (error) {
        console.error('Error caching result:', error);
    }
}
/**
 * Remove all expired entries from the cache
 */
function cleanupExpiredEntries() {
    const now = Date.now();
    let cleanedCount = 0;
    Object.keys(cache).forEach(key => {
        if (cache[key].expiresAt < now) {
            delete cache[key];
            cleanedCount++;
        }
    });
    if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired cache entries`);
    }
}
/**
 * Get cache statistics
 */
function getCacheStats() {
    const now = Date.now();
    const keys = Object.keys(cache);
    const activeEntries = keys.filter(key => cache[key].expiresAt >= now).length;
    return {
        size: keys.length,
        activeEntries,
        expiredEntries: keys.length - activeEntries
    };
}
/**
 * Clear the entire cache
 */
function clearCache() {
    const count = Object.keys(cache).length;
    Object.keys(cache).forEach(key => delete cache[key]);
    console.log(`Cleared ${count} entries from cache`);
}

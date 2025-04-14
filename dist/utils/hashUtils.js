/**
 * Hash Utilities
 *
 * Provides functions for generating content hashes and other hashing functionality.
 */
import crypto from 'crypto';
/**
 * Generate a content hash for a document
 *
 * @param content Text content to hash
 * @returns SHA-256 hash of the content
 */
export function generateContentHash(content) {
    return crypto
        .createHash('sha256')
        .update(content)
        .digest('hex');
}
/**
 * Generate a random ID with a prefix
 *
 * @param prefix Prefix for the ID
 * @returns Random ID with prefix
 */
export function generateRandomId(prefix = 'id') {
    const randomPart = Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now().toString(36);
    return `${prefix}_${timestamp}_${randomPart}`;
}

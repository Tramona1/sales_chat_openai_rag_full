/**
 * File Utilities
 *
 * Helper functions for file operations and type detection.
 */
import fs from 'fs/promises';
import path from 'path';
/**
 * Supported image MIME types
 */
const IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/tiff'
];
/**
 * Check if a file exists
 *
 * @param filePath Path to check
 * @returns True if file exists
 */
export async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Get file size in bytes
 *
 * @param filePath Path to file
 * @returns File size in bytes
 */
export async function getFileSize(filePath) {
    try {
        const stats = await fs.stat(filePath);
        return stats.size;
    }
    catch (error) {
        throw new Error(`Failed to get file size: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Check if file is an image based on MIME type
 *
 * @param mimetype MIME type to check
 * @returns True if MIME type is an image type
 */
export function isImageFile(mimetype) {
    return IMAGE_MIME_TYPES.includes(mimetype);
}
/**
 * Get file extension from MIME type
 *
 * @param mimetype MIME type
 * @returns File extension (including dot) or empty string if not found
 */
export function getExtensionFromMimeType(mimetype) {
    const mimeToExtension = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
        'image/tiff': '.tiff',
        'application/pdf': '.pdf',
        'text/plain': '.txt',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'text/csv': '.csv',
        'application/json': '.json'
    };
    return mimeToExtension[mimetype] || '';
}
/**
 * Get safe filename
 *
 * Replaces invalid characters and ensures uniqueness
 *
 * @param filename Original filename
 * @returns Safe filename
 */
export function getSafeFilename(filename) {
    // Replace invalid characters
    const sanitized = filename
        .replace(/[/\\?%*:|"<>]/g, '-')
        .replace(/\s+/g, '_');
    // Add timestamp to ensure uniqueness
    const extension = path.extname(sanitized);
    const basename = path.basename(sanitized, extension);
    const timestamp = Date.now().toString(36);
    return `${basename}_${timestamp}${extension}`;
}

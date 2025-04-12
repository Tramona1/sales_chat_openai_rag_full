"use strict";
/**
 * Visual Storage Manager
 *
 * Manages storage and retrieval of visual content (images, charts, diagrams, etc.)
 * Current implementation uses local file system storage, designed to be easily
 * migrated to cloud storage (S3, Google Cloud Storage, etc.) in the future.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisualType = exports.VISUAL_STORAGE_ROOT = void 0;
exports.initVisualStorage = initVisualStorage;
exports.storeVisual = storeVisual;
exports.getVisual = getVisual;
exports.getVisualsForDocument = getVisualsForDocument;
exports.deleteVisual = deleteVisual;
exports.updateVisualMetadata = updateVisualMetadata;
exports.getVisualUrl = getVisualUrl;
exports.readVisualContent = readVisualContent;
exports.visualExists = visualExists;
exports.getVisualStorageStats = getVisualStorageStats;
exports.prepareForCloudMigration = prepareForCloudMigration;
exports.cleanupUnusedVisuals = cleanupUnusedVisuals;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const util_1 = require("util");
const performanceMonitoring_1 = require("./performanceMonitoring");
// Promisify file system operations
const mkdir = (0, util_1.promisify)(fs_1.default.mkdir);
const writeFile = (0, util_1.promisify)(fs_1.default.writeFile);
const readFile = (0, util_1.promisify)(fs_1.default.readFile);
const unlink = (0, util_1.promisify)(fs_1.default.unlink);
const access = (0, util_1.promisify)(fs_1.default.access);
// Constants
exports.VISUAL_STORAGE_ROOT = process.env.VISUAL_STORAGE_PATH || path_1.default.join(process.cwd(), 'data', 'visuals');
const VISUAL_CONTENT_INDEX = path_1.default.join(exports.VISUAL_STORAGE_ROOT, 'index.json');
const THUMBNAIL_SIZE = '300x300'; // Default thumbnail size
// Visual content types
var VisualType;
(function (VisualType) {
    VisualType["IMAGE"] = "image";
    VisualType["CHART"] = "chart";
    VisualType["DIAGRAM"] = "diagram";
    VisualType["TABLE"] = "table";
    VisualType["GRAPH"] = "graph";
    VisualType["SCREENSHOT"] = "screenshot";
    VisualType["OTHER"] = "other";
})(VisualType || (exports.VisualType = VisualType = {}));
/**
 * Initialize the visual storage system
 * Creates necessary directories if they don't exist
 */
async function initVisualStorage() {
    try {
        // Ensure the base directory exists
        await ensureDirectoryExists(exports.VISUAL_STORAGE_ROOT);
        // Create subdirectories for different types of visuals
        const visualTypes = Object.values(VisualType);
        for (const type of visualTypes) {
            await ensureDirectoryExists(path_1.default.join(exports.VISUAL_STORAGE_ROOT, type));
        }
        // Create thumbnails directory
        await ensureDirectoryExists(path_1.default.join(exports.VISUAL_STORAGE_ROOT, 'thumbnails'));
        // Initialize index file if it doesn't exist
        if (!fs_1.default.existsSync(VISUAL_CONTENT_INDEX)) {
            await writeFile(VISUAL_CONTENT_INDEX, JSON.stringify({ visuals: [] }));
        }
        console.log(`Visual storage initialized at ${exports.VISUAL_STORAGE_ROOT}`);
    }
    catch (error) {
        console.error('Failed to initialize visual storage:', error);
        throw error;
    }
}
/**
 * Helper function to ensure a directory exists
 */
async function ensureDirectoryExists(dir) {
    try {
        await access(dir);
    }
    catch (error) {
        await mkdir(dir, { recursive: true });
    }
}
/**
 * Store a visual file in the local storage system
 *
 * @param sourceFilePath - Path to the source file
 * @param metadata - Metadata about the visual
 * @param analysisResult - Optional pre-existing analysis result
 * @returns Visual metadata including storage path
 */
async function storeVisual(sourceFilePath, metadata, analysisResult) {
    const startTime = Date.now();
    try {
        // Initialize storage if needed
        await initVisualStorage();
        // Generate a unique ID if not provided
        const id = metadata.id || generateVisualId();
        // Get file information
        const fileStats = fs_1.default.statSync(sourceFilePath);
        const fileExtension = path_1.default.extname(sourceFilePath);
        const originalFilename = metadata.originalFilename || path_1.default.basename(sourceFilePath);
        const mimeType = metadata.mimeType || getMimeTypeFromExtension(fileExtension);
        // Determine visual type from analysis or filename
        let type = metadata.type;
        if (!type && analysisResult && analysisResult.type) {
            type = analysisResult.type;
        }
        if (!type) {
            type = determineVisualTypeFromMimeType(mimeType);
        }
        // Create destination path in appropriate subdirectory
        const destinationFilename = `${id}${fileExtension}`;
        const destinationDir = path_1.default.join(exports.VISUAL_STORAGE_ROOT, String(type));
        const destinationPath = path_1.default.join(destinationDir, destinationFilename);
        // Ensure destination directory exists
        await ensureDirectoryExists(destinationDir);
        // Copy file to destination
        await copyFile(sourceFilePath, destinationPath);
        // Prepare analysis results to store if provided
        const hasBeenAnalyzed = !!analysisResult || !!metadata.analysisResults;
        const analysisToStore = analysisResult || metadata.analysisResults || undefined;
        // Create metadata record with contextual information
        const visualMetadata = {
            id,
            originalFilename,
            filePath: destinationPath,
            mimeType,
            type,
            size: fileStats.size,
            uploadedAt: new Date().toISOString(),
            hasBeenAnalyzed,
            ...metadata,
            // Add analysis results if available
            analysisResults: hasBeenAnalyzed ? {
                detectedType: (analysisToStore === null || analysisToStore === void 0 ? void 0 : analysisToStore.type) || type,
                description: (analysisToStore === null || analysisToStore === void 0 ? void 0 : analysisToStore.description) || '',
                extractedText: (analysisToStore === null || analysisToStore === void 0 ? void 0 : analysisToStore.detectedText) || (analysisToStore === null || analysisToStore === void 0 ? void 0 : analysisToStore.extractedText) || '',
                structuredData: (analysisToStore === null || analysisToStore === void 0 ? void 0 : analysisToStore.data) || (analysisToStore === null || analysisToStore === void 0 ? void 0 : analysisToStore.structuredData)
            } : undefined
        };
        // Add contextual information if available from analysis
        if (analysisResult) {
            // Get document level context
            const documentContext = await Promise.resolve().then(() => __importStar(require('./imageAnalysis/imageAnalyzer.js'))).then(module => module.ImageAnalyzer.generateDocumentContext(analysisResult));
            if (documentContext) {
                visualMetadata.contextualMetadata = {
                    documentContext,
                    chunkContext: await Promise.resolve().then(() => __importStar(require('./imageAnalysis/imageAnalyzer.js'))).then(module => module.ImageAnalyzer.generateChunkContext(analysisResult))
                };
            }
        }
        // Add to index
        await addToVisualIndex(visualMetadata);
        // Generate thumbnail if image
        if (isImageMimeType(mimeType) && !metadata.thumbnailPath) {
            try {
                const thumbnailPath = await generateThumbnail(destinationPath, id);
                if (thumbnailPath) {
                    visualMetadata.thumbnailPath = thumbnailPath;
                    await addToVisualIndex(visualMetadata); // Update with thumbnail
                }
            }
            catch (thumbnailError) {
                console.error('Failed to generate thumbnail:', thumbnailError);
                // Continue without thumbnail
            }
        }
        // Record performance metric
        const duration = Date.now() - startTime;
        (0, performanceMonitoring_1.recordMetric)('visualStorage', 'storeVisual', duration, true, {
            visualId: id,
            visualType: type,
            fileSize: fileStats.size,
            hasAnalysis: hasBeenAnalyzed
        });
        return visualMetadata;
    }
    catch (error) {
        const duration = Date.now() - startTime;
        (0, performanceMonitoring_1.recordMetric)('visualStorage', 'storeVisual', duration, false, {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error('Failed to store visual:', error);
        throw error;
    }
}
/**
 * Copy a file from source to destination
 */
async function copyFile(source, destination) {
    const fileContent = await readFile(source);
    await writeFile(destination, fileContent);
}
/**
 * Add visual metadata to the index
 */
async function addToVisualIndex(visualMetadata) {
    try {
        // Read current index
        const indexContent = await readFile(VISUAL_CONTENT_INDEX, 'utf8');
        const index = JSON.parse(indexContent);
        // Add or update visual entry
        const existingIndex = index.visuals.findIndex((v) => v.id === visualMetadata.id);
        if (existingIndex >= 0) {
            index.visuals[existingIndex] = visualMetadata;
        }
        else {
            index.visuals.push(visualMetadata);
        }
        // Write updated index
        await writeFile(VISUAL_CONTENT_INDEX, JSON.stringify(index, null, 2));
    }
    catch (error) {
        console.error('Failed to update visual index:', error);
        throw error;
    }
}
/**
 * Get a visual by ID
 *
 * @param id - Visual ID
 * @returns Visual metadata
 */
async function getVisual(id) {
    try {
        const indexContent = await readFile(VISUAL_CONTENT_INDEX, 'utf8');
        const index = JSON.parse(indexContent);
        const visual = index.visuals.find((v) => v.id === id);
        return visual || null;
    }
    catch (error) {
        console.error(`Failed to get visual with ID ${id}:`, error);
        return null;
    }
}
/**
 * Get all visuals for a document
 *
 * @param documentId - Document ID
 * @returns Array of visual metadata
 */
async function getVisualsForDocument(documentId) {
    try {
        const indexContent = await readFile(VISUAL_CONTENT_INDEX, 'utf8');
        const index = JSON.parse(indexContent);
        return index.visuals.filter((v) => v.associatedDocumentId === documentId);
    }
    catch (error) {
        console.error(`Failed to get visuals for document ${documentId}:`, error);
        return [];
    }
}
/**
 * Delete a visual by ID
 *
 * @param id - Visual ID
 * @returns Success status
 */
async function deleteVisual(id) {
    try {
        // Get visual metadata
        const visual = await getVisual(id);
        if (!visual) {
            return false;
        }
        // Delete the file
        if (visual.filePath && fs_1.default.existsSync(visual.filePath)) {
            await unlink(visual.filePath);
        }
        // Delete thumbnail if it exists
        if (visual.thumbnailPath && fs_1.default.existsSync(visual.thumbnailPath)) {
            await unlink(visual.thumbnailPath);
        }
        // Update index
        const indexContent = await readFile(VISUAL_CONTENT_INDEX, 'utf8');
        const index = JSON.parse(indexContent);
        index.visuals = index.visuals.filter((v) => v.id !== id);
        await writeFile(VISUAL_CONTENT_INDEX, JSON.stringify(index, null, 2));
        return true;
    }
    catch (error) {
        console.error(`Failed to delete visual ${id}:`, error);
        return false;
    }
}
/**
 * Update visual metadata
 *
 * @param id - Visual ID
 * @param updatedMetadata - Updated metadata
 * @returns Updated visual metadata
 */
async function updateVisualMetadata(id, updatedMetadata) {
    try {
        // Get current visual metadata
        const currentVisual = await getVisual(id);
        if (!currentVisual) {
            return null;
        }
        // Merge updates with current metadata
        const updatedVisual = {
            ...currentVisual,
            ...updatedMetadata,
            id // Ensure ID stays the same
        };
        // Update index
        await addToVisualIndex(updatedVisual);
        return updatedVisual;
    }
    catch (error) {
        console.error(`Failed to update visual metadata for ${id}:`, error);
        return null;
    }
}
/**
 * Generate a unique ID for a visual
 */
function generateVisualId() {
    return `vis_${crypto_1.default.randomBytes(16).toString('hex')}`;
}
/**
 * Determine MIME type from file extension
 */
function getMimeTypeFromExtension(extension) {
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.tiff': 'image/tiff',
        '.tif': 'image/tiff'
    };
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}
/**
 * Determine visual type from MIME type
 */
function determineVisualTypeFromMimeType(mimeType) {
    if (mimeType.startsWith('image/')) {
        return VisualType.IMAGE;
    }
    return VisualType.OTHER;
}
/**
 * Get a URL for accessing a visual
 *
 * @param id - Visual ID
 * @param options - Options for URL generation
 * @returns URL for accessing the visual
 */
function getVisualUrl(id, options = {}) {
    const { useThumbnail = false, forceDownload = false, baseUrl = '/api/visuals' } = options;
    let url = `${baseUrl}/${id}`;
    const queryParams = [];
    if (useThumbnail) {
        queryParams.push('thumbnail=true');
    }
    if (forceDownload) {
        queryParams.push('download=true');
    }
    if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
    }
    return url;
}
/**
 * Read visual content as buffer
 *
 * @param id - Visual ID
 * @param useThumbnail - Whether to return the thumbnail instead of full image
 * @returns Buffer containing visual data or null if not found
 */
async function readVisualContent(id, useThumbnail = false) {
    try {
        const startTime = Date.now();
        // Get the visual metadata
        const visual = await getVisual(id);
        if (!visual) {
            return null;
        }
        // Determine the path to read from
        let filePath = visual.filePath;
        if (useThumbnail && visual.thumbnailPath) {
            filePath = visual.thumbnailPath;
        }
        // Check if the file exists
        try {
            await access(filePath);
        }
        catch (error) {
            console.error(`File not found: ${filePath}`);
            return null;
        }
        // Read the file
        const data = await readFile(filePath);
        // Record performance metric
        const duration = Date.now() - startTime;
        (0, performanceMonitoring_1.recordMetric)('visualStorage', 'readVisualContent', duration, true, {
            visualId: id,
            useThumbnail,
            fileSize: data.length
        });
        return data;
    }
    catch (error) {
        console.error('Error reading visual content:', error);
        // Record error
        (0, performanceMonitoring_1.recordMetric)('visualStorage', 'readVisualContent', 0, false, {
            error: error instanceof Error ? error.message : 'Unknown error',
            visualId: id
        });
        return null;
    }
}
/**
 * Check if a visual file exists
 *
 * @param id - Visual ID
 * @returns Boolean indicating if the visual exists
 */
async function visualExists(id) {
    const visual = await getVisual(id);
    return visual !== null && fs_1.default.existsSync(visual.filePath);
}
/**
 * Get statistics about stored visuals
 *
 * @returns Visual storage statistics
 */
async function getVisualStorageStats() {
    try {
        const indexContent = await readFile(VISUAL_CONTENT_INDEX, 'utf8');
        const index = JSON.parse(indexContent);
        const stats = {
            totalCount: index.visuals.length,
            byType: {},
            totalSize: 0,
            analyzedCount: 0
        };
        // Calculate stats
        for (const visual of index.visuals) {
            // Count by type
            stats.byType[visual.type] = (stats.byType[visual.type] || 0) + 1;
            // Add to total size
            stats.totalSize += visual.size || 0;
            // Count analyzed visuals
            if (visual.hasBeenAnalyzed) {
                stats.analyzedCount++;
            }
        }
        return stats;
    }
    catch (error) {
        console.error('Failed to get visual storage stats:', error);
        return {
            totalCount: 0,
            byType: {},
            totalSize: 0,
            analyzedCount: 0
        };
    }
}
/**
 * Prepare for migration to cloud storage
 * Exports metadata in a format suitable for cloud migration
 *
 * @returns Cloud migration preparation data
 */
async function prepareForCloudMigration() {
    try {
        const indexContent = await readFile(VISUAL_CONTENT_INDEX, 'utf8');
        const index = JSON.parse(indexContent);
        // Calculate total size for cost estimation
        const totalSizeBytes = index.visuals.reduce((sum, visual) => sum + (visual.size || 0), 0);
        const totalSizeGB = totalSizeBytes / (1024 * 1024 * 1024);
        // Rough estimate based on standard cloud storage pricing
        // This is just an example - actual costs vary by provider
        const estimatedMonthlyCost = (totalSizeGB * 0.02).toFixed(2); // $0.02/GB is a common price point
        return {
            visuals: index.visuals,
            migrationInfo: {
                totalCount: index.visuals.length,
                totalSize: totalSizeBytes,
                estimatedCloudStorageCost: `$${estimatedMonthlyCost}/month (estimate)`
            }
        };
    }
    catch (error) {
        console.error('Failed to prepare for cloud migration:', error);
        throw error;
    }
}
/**
 * Cleanup old or unused visual files
 *
 * @param options - Cleanup options
 * @returns Cleanup results
 */
async function cleanupUnusedVisuals(options) {
    try {
        const { olderThan, onlyUnreferenced = true } = options;
        // Read index
        const indexContent = await readFile(VISUAL_CONTENT_INDEX, 'utf8');
        const index = JSON.parse(indexContent);
        const visualsToRemove = [];
        // Find visuals that match criteria for removal
        for (const visual of index.visuals) {
            let shouldRemove = false;
            // Check if older than specified date
            if (olderThan && new Date(visual.uploadedAt) < olderThan) {
                shouldRemove = true;
            }
            // Check if unreferenced (no document ID)
            if (onlyUnreferenced && !visual.associatedDocumentId) {
                shouldRemove = true;
            }
            if (shouldRemove) {
                visualsToRemove.push(visual);
            }
        }
        // Delete each visual
        let spaceFreed = 0;
        for (const visual of visualsToRemove) {
            if (await deleteVisual(visual.id)) {
                spaceFreed += visual.size || 0;
            }
        }
        return {
            visualsRemoved: visualsToRemove.length,
            spaceFreed
        };
    }
    catch (error) {
        console.error('Failed to cleanup unused visuals:', error);
        return {
            visualsRemoved: 0,
            spaceFreed: 0
        };
    }
}
/**
 * Check if a MIME type represents an image
 */
function isImageMimeType(mimeType) {
    const imageMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'image/tiff',
        'image/bmp'
    ];
    return imageMimeTypes.includes(mimeType.toLowerCase());
}
/**
 * Generate a thumbnail for an image
 *
 * @param imagePath - Path to the original image
 * @param id - ID of the visual
 * @returns Path to the thumbnail or null if generation failed
 */
async function generateThumbnail(imagePath, id) {
    try {
        // Create thumbnails directory if it doesn't exist
        const thumbnailsDir = path_1.default.join(exports.VISUAL_STORAGE_ROOT, 'thumbnails');
        await ensureDirectoryExists(thumbnailsDir);
        // Determine thumbnail extension based on original
        const extension = path_1.default.extname(imagePath);
        const thumbnailPath = path_1.default.join(thumbnailsDir, `${id}_thumb${extension}`);
        // For now, just copy the file as a placeholder
        // In a real implementation, you would use a library like sharp to resize the image
        await copyFile(imagePath, thumbnailPath);
        return thumbnailPath;
    }
    catch (error) {
        console.error('Error generating thumbnail:', error);
        return null;
    }
}

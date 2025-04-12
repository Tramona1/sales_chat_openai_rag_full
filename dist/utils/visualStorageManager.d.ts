/**
 * Visual Storage Manager
 *
 * Manages storage and retrieval of visual content (images, charts, diagrams, etc.)
 * Current implementation uses local file system storage, designed to be easily
 * migrated to cloud storage (S3, Google Cloud Storage, etc.) in the future.
 */
export declare const VISUAL_STORAGE_ROOT: string;
export declare enum VisualType {
    IMAGE = "image",
    CHART = "chart",
    DIAGRAM = "diagram",
    TABLE = "table",
    GRAPH = "graph",
    SCREENSHOT = "screenshot",
    OTHER = "other"
}
export interface VisualMetadata {
    id: string;
    originalFilename: string;
    filePath: string;
    mimeType: string;
    type: VisualType | string;
    size: number;
    dimensions?: {
        width: number;
        height: number;
    };
    description?: string;
    extractedText?: string;
    thumbnailPath?: string;
    uploadedAt: string;
    associatedDocumentId?: string;
    pageNumber?: number;
    figureNumber?: number;
    hasBeenAnalyzed: boolean;
    analysisResults?: {
        detectedType?: string;
        description?: string;
        extractedText?: string;
        structuredData?: any;
    };
    contextualMetadata?: {
        documentContext: string;
        chunkContext: string;
    };
}
/**
 * Initialize the visual storage system
 * Creates necessary directories if they don't exist
 */
export declare function initVisualStorage(): Promise<void>;
/**
 * Store a visual file in the local storage system
 *
 * @param sourceFilePath - Path to the source file
 * @param metadata - Metadata about the visual
 * @param analysisResult - Optional pre-existing analysis result
 * @returns Visual metadata including storage path
 */
export declare function storeVisual(sourceFilePath: string, metadata: Partial<VisualMetadata>, analysisResult?: any): Promise<VisualMetadata>;
/**
 * Get a visual by ID
 *
 * @param id - Visual ID
 * @returns Visual metadata
 */
export declare function getVisual(id: string): Promise<VisualMetadata | null>;
/**
 * Get all visuals for a document
 *
 * @param documentId - Document ID
 * @returns Array of visual metadata
 */
export declare function getVisualsForDocument(documentId: string): Promise<VisualMetadata[]>;
/**
 * Delete a visual by ID
 *
 * @param id - Visual ID
 * @returns Success status
 */
export declare function deleteVisual(id: string): Promise<boolean>;
/**
 * Update visual metadata
 *
 * @param id - Visual ID
 * @param updatedMetadata - Updated metadata
 * @returns Updated visual metadata
 */
export declare function updateVisualMetadata(id: string, updatedMetadata: Partial<VisualMetadata>): Promise<VisualMetadata | null>;
/**
 * Get a URL for accessing a visual
 *
 * @param id - Visual ID
 * @param options - Options for URL generation
 * @returns URL for accessing the visual
 */
export declare function getVisualUrl(id: string, options?: {
    useThumbnail?: boolean;
    forceDownload?: boolean;
    baseUrl?: string;
}): string;
/**
 * Read visual content as buffer
 *
 * @param id - Visual ID
 * @param useThumbnail - Whether to return the thumbnail instead of full image
 * @returns Buffer containing visual data or null if not found
 */
export declare function readVisualContent(id: string, useThumbnail?: boolean): Promise<Buffer | null>;
/**
 * Check if a visual file exists
 *
 * @param id - Visual ID
 * @returns Boolean indicating if the visual exists
 */
export declare function visualExists(id: string): Promise<boolean>;
/**
 * Get statistics about stored visuals
 *
 * @returns Visual storage statistics
 */
export declare function getVisualStorageStats(): Promise<{
    totalCount: number;
    byType: Record<string, number>;
    totalSize: number;
    analyzedCount: number;
}>;
/**
 * Prepare for migration to cloud storage
 * Exports metadata in a format suitable for cloud migration
 *
 * @returns Cloud migration preparation data
 */
export declare function prepareForCloudMigration(): Promise<{
    visuals: VisualMetadata[];
    migrationInfo: {
        totalCount: number;
        totalSize: number;
        estimatedCloudStorageCost: string;
    };
}>;
/**
 * Cleanup old or unused visual files
 *
 * @param options - Cleanup options
 * @returns Cleanup results
 */
export declare function cleanupUnusedVisuals(options: {
    olderThan?: Date;
    onlyUnreferenced?: boolean;
}): Promise<{
    visualsRemoved: number;
    spaceFreed: number;
}>;

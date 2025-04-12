/**
 * Visual Storage Manager
 * 
 * Manages storage and retrieval of visual content (images, charts, diagrams, etc.)
 * Current implementation uses local file system storage, designed to be easily 
 * migrated to cloud storage (S3, Google Cloud Storage, etc.) in the future.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { recordMetric } from './performanceMonitoring';

// Promisify file system operations
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const access = promisify(fs.access);

// Constants
export const VISUAL_STORAGE_ROOT = process.env.VISUAL_STORAGE_PATH || path.join(process.cwd(), 'data', 'visuals');
const VISUAL_CONTENT_INDEX = path.join(VISUAL_STORAGE_ROOT, 'index.json');
const THUMBNAIL_SIZE = '300x300'; // Default thumbnail size

// Visual content types
export enum VisualType {
  IMAGE = 'image',
  CHART = 'chart',
  DIAGRAM = 'diagram',
  TABLE = 'table',
  GRAPH = 'graph',
  SCREENSHOT = 'screenshot',
  OTHER = 'other'
}

// Interface for visual content metadata
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
export async function initVisualStorage(): Promise<void> {
  try {
    // Ensure the base directory exists
    await ensureDirectoryExists(VISUAL_STORAGE_ROOT);
    
    // Create subdirectories for different types of visuals
    const visualTypes = Object.values(VisualType);
    for (const type of visualTypes) {
      await ensureDirectoryExists(path.join(VISUAL_STORAGE_ROOT, type));
    }
    
    // Create thumbnails directory
    await ensureDirectoryExists(path.join(VISUAL_STORAGE_ROOT, 'thumbnails'));
    
    // Initialize index file if it doesn't exist
    if (!fs.existsSync(VISUAL_CONTENT_INDEX)) {
      await writeFile(VISUAL_CONTENT_INDEX, JSON.stringify({ visuals: [] }));
    }
    
    console.log(`Visual storage initialized at ${VISUAL_STORAGE_ROOT}`);
  } catch (error) {
    console.error('Failed to initialize visual storage:', error);
    throw error;
  }
}

/**
 * Helper function to ensure a directory exists
 */
async function ensureDirectoryExists(dir: string): Promise<void> {
  try {
    await access(dir);
  } catch (error) {
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
export async function storeVisual(
  sourceFilePath: string,
  metadata: Partial<VisualMetadata>,
  analysisResult?: any
): Promise<VisualMetadata> {
  const startTime = Date.now();
  try {
    // Initialize storage if needed
    await initVisualStorage();
    
    // Generate a unique ID if not provided
    const id = metadata.id || generateVisualId();
    
    // Get file information
    const fileStats = fs.statSync(sourceFilePath);
    const fileExtension = path.extname(sourceFilePath);
    const originalFilename = metadata.originalFilename || path.basename(sourceFilePath);
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
    const destinationDir = path.join(VISUAL_STORAGE_ROOT, String(type));
    const destinationPath = path.join(destinationDir, destinationFilename);
    
    // Ensure destination directory exists
    await ensureDirectoryExists(destinationDir);
    
    // Copy file to destination
    await copyFile(sourceFilePath, destinationPath);
    
    // Prepare analysis results to store if provided
    const hasBeenAnalyzed = !!analysisResult || !!metadata.analysisResults;
    const analysisToStore = analysisResult || metadata.analysisResults || undefined;
    
    // Create metadata record with contextual information
    const visualMetadata: VisualMetadata = {
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
        detectedType: analysisToStore?.type || type,
        description: analysisToStore?.description || '',
        extractedText: analysisToStore?.detectedText || analysisToStore?.extractedText || '',
        structuredData: analysisToStore?.data || analysisToStore?.structuredData
      } : undefined
    };
    
    // Add contextual information if available from analysis
    if (analysisResult) {
      // Get document level context
      const documentContext = await import('./imageAnalysis/imageAnalyzer').then(
        module => module.ImageAnalyzer.generateDocumentContext(analysisResult)
      );
      
      if (documentContext) {
        visualMetadata.contextualMetadata = {
          documentContext,
          chunkContext: await import('./imageAnalysis/imageAnalyzer').then(
            module => module.ImageAnalyzer.generateChunkContext(analysisResult)
          )
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
      } catch (thumbnailError) {
        console.error('Failed to generate thumbnail:', thumbnailError);
        // Continue without thumbnail
      }
    }
    
    // Record performance metric
    const duration = Date.now() - startTime;
    recordMetric(
      'visualStorage',
      'storeVisual',
      duration,
      true,
      { 
        visualId: id,
        visualType: type,
        fileSize: fileStats.size,
        hasAnalysis: hasBeenAnalyzed
      }
    );
    
    return visualMetadata;
  } catch (error) {
    const duration = Date.now() - startTime;
    recordMetric(
      'visualStorage',
      'storeVisual',
      duration,
      false,
      { 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    );
    
    console.error('Failed to store visual:', error);
    throw error;
  }
}

/**
 * Copy a file from source to destination
 */
async function copyFile(source: string, destination: string): Promise<void> {
  const fileContent = await readFile(source);
  await writeFile(destination, fileContent);
}

/**
 * Add visual metadata to the index
 */
async function addToVisualIndex(visualMetadata: VisualMetadata): Promise<void> {
  try {
    // Read current index
    const indexContent = await readFile(VISUAL_CONTENT_INDEX, 'utf8');
    const index = JSON.parse(indexContent);
    
    // Add or update visual entry
    const existingIndex = index.visuals.findIndex((v: VisualMetadata) => v.id === visualMetadata.id);
    
    if (existingIndex >= 0) {
      index.visuals[existingIndex] = visualMetadata;
    } else {
      index.visuals.push(visualMetadata);
    }
    
    // Write updated index
    await writeFile(VISUAL_CONTENT_INDEX, JSON.stringify(index, null, 2));
  } catch (error) {
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
export async function getVisual(id: string): Promise<VisualMetadata | null> {
  try {
    const indexContent = await readFile(VISUAL_CONTENT_INDEX, 'utf8');
    const index = JSON.parse(indexContent);
    
    const visual = index.visuals.find((v: VisualMetadata) => v.id === id);
    return visual || null;
  } catch (error) {
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
export async function getVisualsForDocument(documentId: string): Promise<VisualMetadata[]> {
  try {
    const indexContent = await readFile(VISUAL_CONTENT_INDEX, 'utf8');
    const index = JSON.parse(indexContent);
    
    return index.visuals.filter((v: VisualMetadata) => v.associatedDocumentId === documentId);
  } catch (error) {
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
export async function deleteVisual(id: string): Promise<boolean> {
  try {
    // Get visual metadata
    const visual = await getVisual(id);
    if (!visual) {
      return false;
    }
    
    // Delete the file
    if (visual.filePath && fs.existsSync(visual.filePath)) {
      await unlink(visual.filePath);
    }
    
    // Delete thumbnail if it exists
    if (visual.thumbnailPath && fs.existsSync(visual.thumbnailPath)) {
      await unlink(visual.thumbnailPath);
    }
    
    // Update index
    const indexContent = await readFile(VISUAL_CONTENT_INDEX, 'utf8');
    const index = JSON.parse(indexContent);
    
    index.visuals = index.visuals.filter((v: VisualMetadata) => v.id !== id);
    
    await writeFile(VISUAL_CONTENT_INDEX, JSON.stringify(index, null, 2));
    
    return true;
  } catch (error) {
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
export async function updateVisualMetadata(
  id: string,
  updatedMetadata: Partial<VisualMetadata>
): Promise<VisualMetadata | null> {
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
  } catch (error) {
    console.error(`Failed to update visual metadata for ${id}:`, error);
    return null;
  }
}

/**
 * Generate a unique ID for a visual
 */
function generateVisualId(): string {
  return `vis_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Determine MIME type from file extension
 */
function getMimeTypeFromExtension(extension: string): string {
  const mimeTypes: Record<string, string> = {
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
function determineVisualTypeFromMimeType(mimeType: string): string {
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
export function getVisualUrl(
  id: string,
  options: {
    useThumbnail?: boolean;
    forceDownload?: boolean;
    baseUrl?: string;
  } = {}
): string {
  const {
    useThumbnail = false,
    forceDownload = false,
    baseUrl = '/api/visuals'
  } = options;
  
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
export async function readVisualContent(
  id: string,
  useThumbnail: boolean = false
): Promise<Buffer | null> {
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
    } catch (error) {
      console.error(`File not found: ${filePath}`);
      return null;
    }
    
    // Read the file
    const data = await readFile(filePath);
    
    // Record performance metric
    const duration = Date.now() - startTime;
    recordMetric(
      'visualStorage',
      'readVisualContent',
      duration,
      true,
      { 
        visualId: id,
        useThumbnail,
        fileSize: data.length
      }
    );
    
    return data;
  } catch (error) {
    console.error('Error reading visual content:', error);
    
    // Record error
    recordMetric(
      'visualStorage',
      'readVisualContent',
      0,
      false,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        visualId: id
      }
    );
    
    return null;
  }
}

/**
 * Check if a visual file exists
 * 
 * @param id - Visual ID
 * @returns Boolean indicating if the visual exists
 */
export async function visualExists(id: string): Promise<boolean> {
  const visual = await getVisual(id);
  return visual !== null && fs.existsSync(visual.filePath);
}

/**
 * Get statistics about stored visuals
 * 
 * @returns Visual storage statistics
 */
export async function getVisualStorageStats(): Promise<{
  totalCount: number;
  byType: Record<string, number>;
  totalSize: number;
  analyzedCount: number;
}> {
  try {
    const indexContent = await readFile(VISUAL_CONTENT_INDEX, 'utf8');
    const index = JSON.parse(indexContent);
    
    const stats = {
      totalCount: index.visuals.length,
      byType: {} as Record<string, number>,
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
  } catch (error) {
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
export async function prepareForCloudMigration(): Promise<{
  visuals: VisualMetadata[];
  migrationInfo: {
    totalCount: number;
    totalSize: number;
    estimatedCloudStorageCost: string;
  };
}> {
  try {
    const indexContent = await readFile(VISUAL_CONTENT_INDEX, 'utf8');
    const index = JSON.parse(indexContent);
    
    // Calculate total size for cost estimation
    const totalSizeBytes = index.visuals.reduce((sum: number, visual: VisualMetadata) => sum + (visual.size || 0), 0);
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
  } catch (error) {
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
export async function cleanupUnusedVisuals(options: {
  olderThan?: Date;
  onlyUnreferenced?: boolean;
}): Promise<{
  visualsRemoved: number;
  spaceFreed: number;
}> {
  try {
    const { olderThan, onlyUnreferenced = true } = options;
    
    // Read index
    const indexContent = await readFile(VISUAL_CONTENT_INDEX, 'utf8');
    const index = JSON.parse(indexContent);
    
    const visualsToRemove: VisualMetadata[] = [];
    
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
  } catch (error) {
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
function isImageMimeType(mimeType: string): boolean {
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
async function generateThumbnail(imagePath: string, id: string): Promise<string | null> {
  try {
    // Create thumbnails directory if it doesn't exist
    const thumbnailsDir = path.join(VISUAL_STORAGE_ROOT, 'thumbnails');
    await ensureDirectoryExists(thumbnailsDir);
    
    // Determine thumbnail extension based on original
    const extension = path.extname(imagePath);
    const thumbnailPath = path.join(thumbnailsDir, `${id}_thumb${extension}`);
    
    // For now, just copy the file as a placeholder
    // In a real implementation, you would use a library like sharp to resize the image
    await copyFile(imagePath, thumbnailPath);
    
    return thumbnailPath;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
} 
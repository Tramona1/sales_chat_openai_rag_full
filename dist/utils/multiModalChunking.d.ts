/**
 * Multi-Modal Chunking Utilities
 *
 * This file provides functionality for processing documents that contain
 * both text and visual elements, ensuring proper association between them.
 */
import { ContextualChunk } from '../types/documentProcessing';
import { ProcessedImage } from '../types/baseTypes';
import { MultiModalChunk } from '../types/multiModal';
import { VisualContent } from '../types/visualContent';
/**
 * Find visual elements relevant to a specific text chunk
 *
 * @param chunk - Text chunk to find relevant visuals for
 * @param visuals - Array of available visual elements
 * @param options - Configuration options
 * @returns Array of relevant visuals
 */
export declare function findRelevantVisualElements(chunk: ContextualChunk, visuals: ProcessedImage[], options?: {
    maxDistance?: number;
    maxVisuals?: number;
    requirePageMatch?: boolean;
}): ProcessedImage[];
/**
 * Prepare multi-modal chunks for embedding by creating enhanced text representation
 *
 * @param chunk - The multi-modal chunk to prepare
 * @returns Text string optimized for embedding
 */
export declare function prepareMultiModalChunkForEmbedding(chunk: MultiModalChunk): string;
/**
 * Create multi-modal chunks from text and visuals
 *
 * @param text - Document text
 * @param visuals - Visual contents from the document
 * @param metadata - Metadata to include with chunks
 * @param options - Chunking options
 * @returns Array of multi-modal chunks
 */
export declare function createMultiModalChunks(text: string, visuals: VisualContent[], metadata?: Record<string, any>, options?: {
    chunkSize?: number;
    chunkOverlap?: number;
    keepSeparateVisualChunks?: boolean;
}): Promise<MultiModalChunk[]>;
/**
 * Process a document with both text and visual content
 *
 * @param textContent - The document's text content
 * @param imagePaths - Paths to images extracted from the document
 * @param sourceMetadata - Document source metadata
 * @returns Array of multi-modal chunks
 */
export declare function processDocumentWithVisualContent(textContent: string, imagePaths: string[], sourceMetadata: Record<string, any>, options?: {
    chunkSize?: number;
    chunkOverlap?: number;
    keepSeparateVisualChunks?: boolean;
}): Promise<MultiModalChunk[]>;

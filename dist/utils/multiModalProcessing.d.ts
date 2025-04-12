/**
 * Multi-Modal Processing Utilities
 *
 * This module provides functions for processing visual elements in documents
 * using Gemini's vision capabilities.
 */
import { MultiModalVectorStoreItem } from '../types/vectorStore';
import { ImageAnalysisResult, DocumentVisualAnalysis, MultiModalSearchOptions, MultiModalSearchResult } from '../types/multiModal';
/**
 * Analyze an image file using Gemini vision capabilities
 *
 * @param imagePath Path to the image file
 * @returns Analysis result with description, extracted text, and type
 */
export declare function analyzeImage(imagePath: string): Promise<ImageAnalysisResult>;
/**
 * Extract images from a PDF file
 * This is a placeholder - in a real implementation, you would use a PDF library
 * such as pdf.js or a server-side library to extract images
 *
 * @param pdfPath Path to the PDF file
 * @returns Array of extracted image paths
 */
export declare function extractImagesFromPDF(pdfPath: string): Promise<string[]>;
/**
 * Process a document with images and create multi-modal chunks
 *
 * @param documentText The text content of the document
 * @param images Array of image paths or image data
 * @param source Source identifier for the document
 * @returns Array of multi-modal chunks
 */
export declare function createMultiModalChunks(documentText: string, images: Array<string | {
    path: string;
    page?: number;
    position?: any;
}>, source: string): Promise<MultiModalVectorStoreItem[]>;
/**
 * Generate embeddings for multi-modal content
 *
 * @param chunks Array of multi-modal chunks
 * @returns The chunks with embeddings added
 */
export declare function generateMultiModalEmbeddings(chunks: MultiModalVectorStoreItem[]): Promise<MultiModalVectorStoreItem[]>;
/**
 * Detect images in a document and analyze them
 *
 * @param filePath Path to the document file
 * @returns Analysis of images in the document
 */
export declare function analyzeDocumentVisuals(filePath: string): Promise<DocumentVisualAnalysis>;
/**
 * Perform a search that includes visual content
 *
 * @param query The search query
 * @param options Search options
 * @returns Search results with matched visual content
 */
export declare function performMultiModalSearch(query: string, options?: MultiModalSearchOptions): Promise<MultiModalSearchResult[]>;

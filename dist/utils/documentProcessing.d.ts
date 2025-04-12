import { ContextualChunk, SplitIntoChunksWithContextFn } from '../types/documentProcessing';
export type SupportedMimeType = 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | 'text/plain';
/**
 * Extract text content from various document formats
 * @param filePath Path to the file
 * @param mimetype MIME type of the file
 * @returns Extracted text content
 */
export declare function extractText(filePath: string, mimetype: string): Promise<string>;
/**
 * Detect if text contains structured information like company values, investors,
 * leadership, pricing, or sales-related content
 */
export declare function detectStructuredInfo(text: string): {
    hasCompanyValues: boolean;
    hasInvestors: boolean;
    hasLeadership: boolean;
    hasPricing: boolean;
    hasProductFeatures: boolean;
    hasSalesInfo: boolean;
};
/**
 * Split text into chunks of approximately the specified size
 * Enhanced to preserve context and structured information
 * @param text Text to split
 * @param chunkSize Target size for each chunk
 * @param source Optional source metadata for context-aware chunking
 * @returns Array of text chunks with metadata
 */
export declare function splitIntoChunks(text: string, chunkSize?: number, source?: string): Array<{
    text: string;
    metadata?: {
        isStructured?: boolean;
        infoType?: string;
    };
}>;
/**
 * Split text into chunks with enhanced contextual information
 *
 * This advanced chunking method extracts contextual information about each chunk
 * to improve retrieval accuracy and answer generation quality.
 *
 * @param text The text to split into chunks
 * @param chunkSize Size of each chunk
 * @param source Source identifier for the document
 * @param generateContext Whether to generate context for each chunk
 * @param existingContext Optional existing document context to use
 * @returns Array of chunks with contextual metadata
 */
export declare const splitIntoChunksWithContext: SplitIntoChunksWithContextFn;
/**
 * Prepares text for embedding by incorporating contextual information
 * This is a critical part of the contextual retrieval system as it enriches the text
 * with semantic information before embedding
 *
 * @param chunk The contextual chunk containing text and metadata
 * @returns Enhanced text string to be embedded
 */
export declare function prepareTextForEmbedding(chunk: ContextualChunk): string;

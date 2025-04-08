/**
 * Metadata Extraction Module
 *
 * This module provides functions to extract structured metadata from documents
 * using LLMs (OpenAI/Gemini).
 */
import { EnhancedMetadata } from '../types/metadata';
/**
 * Extract metadata from document text
 */
export declare function extractMetadata(text: string, source: string, options?: {
    useCaching?: boolean;
    model?: string;
}): Promise<EnhancedMetadata>;
/**
 * Batch process multiple documents for metadata extraction
 */
export declare function batchExtractMetadata(documents: Array<{
    text: string;
    source: string;
}>, options?: {
    useCaching?: boolean;
    model?: string;
    concurrency?: number;
}): Promise<EnhancedMetadata[]>;

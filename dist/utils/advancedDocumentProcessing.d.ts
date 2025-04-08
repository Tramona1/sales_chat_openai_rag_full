/**
 * Advanced Document Processing Utility
 *
 * This module provides utilities for advanced document processing with semantic understanding.
 */
/**
 * Process text with semantic understanding
 *
 * @param text The text to process
 * @param options Processing options
 * @returns The processed text result
 */
export declare function processTextWithUnderstanding(text: string, options?: {
    extractEntities?: boolean;
    summarize?: boolean;
    categorize?: boolean;
}): Promise<{
    processedText: string;
    entities?: string[];
    summary?: string;
    categories?: string[];
}>;
/**
 * Process a document with semantic understanding
 *
 * @param document The document to process
 * @param options Processing options
 * @returns The processed document result
 */
export declare function processDocumentWithUnderstanding(document: {
    text: string;
    metadata?: Record<string, any>;
    filename?: string;
}, options?: {
    extractEntities?: boolean;
    summarize?: boolean;
    categorize?: boolean;
}): Promise<{
    processedDocument: {
        text: string;
        metadata?: Record<string, any>;
        filename?: string;
    };
    entities?: string[];
    summary?: string;
    categories?: string[];
}>;

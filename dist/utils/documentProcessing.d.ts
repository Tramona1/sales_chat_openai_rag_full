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

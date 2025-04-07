import { VectorStoreItem } from './vectorStore';
declare namespace Express {
    namespace Multer {
        interface File {
            fieldname: string;
            originalname: string;
            encoding: string;
            mimetype: string;
            size: number;
            destination: string;
            filename: string;
            path: string;
            buffer: Buffer;
        }
    }
}
/**
 * Document analysis result interface
 */
export interface DocumentAnalysis {
    title: string;
    topics: string[];
    entities: {
        people: string[];
        products: string[];
        features: string[];
        projects: string[];
    };
    contentType: string;
    technicalLevel: number;
    containsConfidential: boolean;
}
/**
 * Document summaries at various detail levels
 */
export interface DocumentSummaries {
    oneLine: string;
    paragraph: string;
    detailed: string;
    keyPoints: string[];
}
/**
 * Smart document chunk with nested context
 */
export interface SmartChunk {
    text: string;
    metadata: {
        source: string;
        chunkType: string;
        topics: string[];
        contentType: string;
        technicalLevel: number;
        sectionTitle?: string;
    };
    embedding?: number[];
}
/**
 * Section of a document with title and content
 */
interface DocumentSection {
    title: string;
    text: string;
    summary?: string;
}
/**
 * Enhanced vector store item with rich metadata
 */
export interface EnhancedVectorItem extends VectorStoreItem {
    metadata: {
        source: string;
        section?: string;
        page?: number;
        topics: string[];
        contentType: string;
        technicalLevel: number;
        confidentiality: string;
        relatedProducts: string[];
        relatedProjects: string[];
        lastUpdated: string;
        version?: string;
        documentSummary: string;
        sectionSummary?: string;
        precedingContext?: string;
        followingContext?: string;
    };
}
/**
 * Interface for the processing result
 */
export interface ProcessingResult {
    title: string;
    topics: string[];
    contentType: string;
    summaries: DocumentSummaries;
    chunks: number;
    sections: string[];
}
/**
 * Use the LLM to analyze the document content
 */
export declare function analyzeDocument(text: string): Promise<DocumentAnalysis>;
/**
 * Generate multiple layers of document summaries
 */
export declare function generateSummaries(text: string, analysis: DocumentAnalysis): Promise<DocumentSummaries>;
/**
 * Identify logical sections within a document
 */
export declare function identifySections(text: string): Promise<DocumentSection[]>;
/**
 * Split section into smaller chunks for embedding
 */
export declare function splitSectionIntoChunks(sectionText: string, chunkSize?: number): string[];
/**
 * Create smart chunks that maintain document structure
 */
export declare function createSmartChunks(text: string, analysis: DocumentAnalysis, summaries: DocumentSummaries, sections: DocumentSection[]): Promise<SmartChunk[]>;
/**
 * Enhance chunks with rich metadata
 */
export declare function enhanceChunkMetadata(chunk: SmartChunk, analysis: DocumentAnalysis, source: string, page?: number): EnhancedVectorItem;
/**
 * Main function to process new document with advanced understanding
 */
export declare function processDocumentWithUnderstanding(filePath: string, mimetype: string, filename: string): Promise<{
    analysis: DocumentAnalysis;
    chunkCount: number;
}>;
/**
 * Advanced document processing utilities
 * Contains functions for query analysis and document processing
 */
/**
 * Query analysis result
 */
export interface QueryAnalysisResult {
    technicalLevel: number;
    expectedFormat: 'text' | 'list' | 'steps' | 'table';
    complexity: number;
    topics: string[];
    urgency: number;
}
/**
 * Analyze a query to determine its characteristics
 * This helps in optimizing retrieval and answer generation
 */
export declare function analyzeQuery(query: string): Promise<QueryAnalysisResult>;
/**
 * Calculate content-based relevance boost factors
 */
export declare function calculateContentBoost(queryAnalysis: any, chunk: EnhancedVectorItem): number;
/**
 * Process a file with full AI understanding
 */
export declare function processFileWithUnderstanding(file: Express.Multer.File, useDefaultTitle?: boolean): Promise<ProcessingResult>;
/**
 * Process text content with full AI understanding
 */
export declare function processTextWithUnderstanding(text: string, originalTitle?: string, useDefaultTitle?: boolean): Promise<ProcessingResult>;
/**
 * Extract text from a file
 */
export declare function extractText(file: Express.Multer.File): Promise<string>;
/**
 * Store smart chunks in the vector store
 */
export declare function storeSmartChunks(chunks: SmartChunk[]): Promise<number>;
/**
 * Helper function to split text into chunks
 */
export declare function splitTextIntoChunks(text: string, maxChunkSize?: number): string[];
/**
 * Create a smart chunk with metadata
 */
export declare function createSmartChunkWithMetadata(text: string, section: DocumentSection, analysis: DocumentAnalysis, partIndex: number, totalParts: number): SmartChunk;
export {};

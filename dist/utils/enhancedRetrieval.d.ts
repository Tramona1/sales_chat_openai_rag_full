/**
 * Enhanced Retrieval System
 *
 * This module integrates BM25 with vector-based similarity search
 * to create a hybrid retrieval approach that improves result quality.
 */
import { Document } from './bm25';
import { VectorStoreItem } from './vectorStore';
export type { Document, VectorStoreItem };
/**
 * Configuration for enhanced retrieval
 */
export interface EnhancedRetrievalConfig {
    bm25Weight: number;
    minBM25Score: number;
    minVectorScore: number;
    normalizeScores: boolean;
    maxResults: number;
    debug: boolean;
}
/**
 * Default configuration for enhanced retrieval
 */
export declare const DEFAULT_ENHANCED_RETRIEVAL_CONFIG: EnhancedRetrievalConfig;
/**
 * Result item for enhanced retrieval
 */
export interface EnhancedRetrievalResult {
    item: VectorStoreItem;
    bm25Score: number;
    vectorScore: number;
    combinedScore: number;
}
/**
 * Enhanced retrieval system that combines BM25 and vector-based search
 */
export declare class EnhancedRetrieval {
    private vectorStore;
    private corpusStats;
    private isInitialized;
    private config;
    /**
     * Create a new enhanced retrieval system
     */
    constructor(config?: Partial<EnhancedRetrievalConfig>);
    /**
     * Load vector store from disk
     */
    private loadVectorStore;
    /**
     * Initialize the retrieval system
     * Loads corpus statistics and vector store
     */
    initialize(): Promise<void>;
    /**
     * Find similar documents using vector search
     */
    private findSimilarItems;
    /**
     * Find documents using the enhanced retrieval approach
     */
    findSimilarDocuments(query: string, options?: Partial<EnhancedRetrievalConfig>): Promise<EnhancedRetrievalResult[]>;
    /**
     * Get document text from results for context generation
     */
    getContextFromResults(results: EnhancedRetrievalResult[]): Promise<string>;
}

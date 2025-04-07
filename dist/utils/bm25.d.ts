/**
 * BM25 Implementation for improved document retrieval
 *
 * This file contains the core BM25 implementation for improved document
 * retrieval beyond vector-based similarity search. BM25 is a widely used
 * ranking function that scores documents based on term frequency and
 * inverse document frequency.
 */
import { VectorStoreItem } from './vectorStore';
export interface Document {
    id: string;
    text: string;
}
export declare const BM25_K1 = 1.2;
export declare const BM25_B = 0.75;
export interface CorpusStatistics {
    totalDocuments: number;
    averageDocumentLength: number;
    documentFrequency: Record<string, number>;
    documentLengths: Record<string, number>;
    termFrequency?: Record<string, number>;
    mostCommonTerms?: Array<{
        term: string;
        count: number;
        percentage: number;
    }>;
}
/**
 * Load corpus statistics from disk
 * These statistics are calculated by the calculate-corpus-stats script
 */
export declare function loadCorpusStatistics(): Promise<CorpusStatistics>;
/**
 * Calculate corpus statistics from vector store
 * Used by the calculate-corpus-stats script
 */
export declare function calculateCorpusStatistics(documents: VectorStoreItem[]): Promise<CorpusStatistics>;
/**
 * Save corpus statistics to disk
 * Used by the calculate-corpus-stats script
 */
export declare function saveCorpusStatistics(stats: CorpusStatistics): Promise<void>;
/**
 * Calculate BM25 score for a document given a query
 */
export declare function calculateBM25Score(query: string, document: Document, corpusStats: CorpusStatistics): number;
/**
 * Hybrid search combining BM25 and vector similarity
 * @param bm25Score The BM25 score (0-1)
 * @param vectorScore The vector similarity score (0-1)
 * @param alpha Weight for BM25 (between 0 and 1)
 * @returns Combined score
 */
export declare function combineScores(bm25Score: number, vectorScore: number, alpha?: number): number;

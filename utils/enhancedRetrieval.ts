/**
 * Enhanced Retrieval System
 * 
 * This module integrates BM25 with vector-based similarity search
 * to create a hybrid retrieval approach that improves result quality.
 */

import { loadCorpusStatistics, calculateBM25Score, combineScores, Document } from './bm25';
import { cosineSimilarity, VectorStoreItem, getSimilarItems } from './vectorStore';
import { tokenize } from './tokenization';
import fs from 'fs/promises';
import path from 'path';
import { embedText } from './embeddingClient';

// Re-export for easier importing
export type { Document, VectorStoreItem };

/**
 * Configuration for enhanced retrieval
 */
export interface EnhancedRetrievalConfig {
  // Weight for BM25 score (0.0 to 1.0)
  // 0.0 = pure vector search, 1.0 = pure BM25 search
  bm25Weight: number;
  
  // Minimum BM25 score to consider a document relevant
  // Helps filter out low-quality matches
  minBM25Score: number;
  
  // Minimum vector similarity to consider a document relevant
  minVectorScore: number;
  
  // Whether to normalize scores before combining
  // Recommended to keep this true
  normalizeScores: boolean;
  
  // Maximum number of documents to return
  maxResults: number;
  
  // Whether to log detailed scoring information
  debug: boolean;
}

/**
 * Default configuration for enhanced retrieval
 */
export const DEFAULT_ENHANCED_RETRIEVAL_CONFIG: EnhancedRetrievalConfig = {
  bm25Weight: 0.3,
  minBM25Score: 0.01,
  minVectorScore: 0.6,
  normalizeScores: true,
  maxResults: 5,
  debug: false
};

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
 * Vector search result format
 */
interface VectorSearchResult {
  item: VectorStoreItem;
  score: number;
}

/**
 * Enhanced retrieval system that combines BM25 and vector-based search
 */
export class EnhancedRetrieval {
  private vectorStore: VectorStoreItem[] = [];
  private corpusStats: any = null;
  private isInitialized = false;
  private config: EnhancedRetrievalConfig;
  
  /**
   * Create a new enhanced retrieval system
   */
  constructor(config: Partial<EnhancedRetrievalConfig> = {}) {
    this.config = { ...DEFAULT_ENHANCED_RETRIEVAL_CONFIG, ...config };
  }
  
  /**
   * Load vector store from disk
   */
  private async loadVectorStore(): Promise<VectorStoreItem[]> {
    try {
      const filePath = path.join(process.cwd(), 'data', 'vectorStore.json');
      const fileData = await fs.readFile(filePath, 'utf8');
      const parsedData = JSON.parse(fileData);
      
      if (Array.isArray(parsedData)) {
        return parsedData;
      } else if (parsedData.items && Array.isArray(parsedData.items)) {
        return parsedData.items;
      }
      
      return [];
    } catch (error) {
      console.error('Error loading vector store:', error);
      return [];
    }
  }
  
  /**
   * Initialize the retrieval system
   * Loads corpus statistics and vector store
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      console.log('Initializing enhanced retrieval system...');
      
      // Load corpus statistics for BM25 scoring
      this.corpusStats = await loadCorpusStatistics();
      console.log(`Loaded corpus statistics with ${Object.keys(this.corpusStats.documentFrequency).length} unique terms`);
      
      // Load vector store
      this.vectorStore = await this.loadVectorStore();
      console.log(`Loaded vector store with ${this.vectorStore.length} items`);
      
      this.isInitialized = true;
      console.log('Enhanced retrieval system initialized');
    } catch (error) {
      console.error('Error initializing enhanced retrieval system:', error);
      throw new Error('Failed to initialize enhanced retrieval system');
    }
  }
  
  /**
   * Find similar documents using vector search
   */
  private async findSimilarItems(query: string, options: { minSimilarity: number, maxResults: number }): Promise<VectorSearchResult[]> {
    // Replace this with the actual embedding and vector search in production
    
    // Generate embedding first
    const queryEmbedding = await embedText(query); 
    
    const results = await getSimilarItems( // Added await
      queryEmbedding, 
      options.maxResults,
      { match_threshold: options.minSimilarity } // Pass options object
    );
    
    return results.map((result: VectorStoreItem & { score: number }) => ({ // Added type
      item: result,
      score: result.score
    }));
  }
  
  /**
   * Find documents using the enhanced retrieval approach
   */
  async findSimilarDocuments(query: string, options: Partial<EnhancedRetrievalConfig> = {}): Promise<EnhancedRetrievalResult[]> {
    // Ensure system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Apply options to config
    const config = { ...this.config, ...options };
    
    if (config.debug) {
      console.log(`Searching for: "${query}"`);
      console.log(`Tokenized query: [${tokenize(query).join(', ')}]`);
    }
    
    // Step 1: Get vector search results
    const vectorResults = await this.findSimilarItems(query, {
      minSimilarity: config.minVectorScore,
      maxResults: config.maxResults * 2 // Get more results initially for re-ranking
    });
    
    if (config.debug) {
      console.log(`Vector search returned ${vectorResults.length} results`);
    }
    
    // If no vector results or BM25 weight is 0, return vector results
    if (vectorResults.length === 0 || config.bm25Weight === 0) {
      return vectorResults.map(result => ({
        item: result.item,
        bm25Score: 0,
        vectorScore: result.score,
        combinedScore: result.score
      })).slice(0, config.maxResults);
    }
    
    // Step 2: Calculate BM25 scores for vector results
    const enhancedResults: EnhancedRetrievalResult[] = [];
    
    for (const result of vectorResults) {
      const document: Document = {
        id: result.item.metadata?.source || 'unknown',
        text: result.item.text ?? '' // Added nullish coalescing
      };
      
      const bm25Score = calculateBM25Score(query, document, this.corpusStats);
      
      // Skip if BM25 score is below threshold
      if (bm25Score < config.minBM25Score && config.bm25Weight > 0) {
        continue;
      }
      
      // Normalize scores if enabled
      let normalizedBM25 = bm25Score;
      let normalizedVector = result.score;
      
      // Calculate combined score
      const combinedScore = combineScores(
        normalizedBM25,
        normalizedVector,
        config.bm25Weight
      );
      
      enhancedResults.push({
        item: result.item,
        bm25Score,
        vectorScore: result.score,
        combinedScore
      });
    }
    
    // Sort by combined score
    enhancedResults.sort((a, b) => b.combinedScore - a.combinedScore);
    
    // Apply maximum results limit
    const finalResults = enhancedResults.slice(0, config.maxResults);
    
    if (config.debug) {
      console.log(`Enhanced retrieval returned ${finalResults.length} results`);
      finalResults.forEach((result, i) => {
        console.log(`Result ${i+1}: Combined score ${result.combinedScore.toFixed(4)} (Vector: ${result.vectorScore.toFixed(4)}, BM25: ${result.bm25Score.toFixed(4)})`);
      });
    }
    
    return finalResults;
  }
  
  /**
   * Get document text from results for context generation
   */
  async getContextFromResults(results: EnhancedRetrievalResult[]): Promise<string> {
    return results.map(result => {
      // Include metadata if available
      const source = result.item.metadata?.source 
        ? `Source: ${result.item.metadata.source}\n` 
        : '';
        
      // Return formatted context
      return `${source}${result.item.text}\n\n`;
    }).join('---\n\n');
  }
} 
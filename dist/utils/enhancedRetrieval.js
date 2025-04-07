"use strict";
/**
 * Enhanced Retrieval System
 *
 * This module integrates BM25 with vector-based similarity search
 * to create a hybrid retrieval approach that improves result quality.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedRetrieval = exports.DEFAULT_ENHANCED_RETRIEVAL_CONFIG = void 0;
const bm25_1 = require("./bm25");
const vectorStore_1 = require("./vectorStore");
const tokenization_1 = require("./tokenization");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
/**
 * Default configuration for enhanced retrieval
 */
exports.DEFAULT_ENHANCED_RETRIEVAL_CONFIG = {
    bm25Weight: 0.3,
    minBM25Score: 0.01,
    minVectorScore: 0.6,
    normalizeScores: true,
    maxResults: 5,
    debug: false
};
/**
 * Enhanced retrieval system that combines BM25 and vector-based search
 */
class EnhancedRetrieval {
    /**
     * Create a new enhanced retrieval system
     */
    constructor(config = {}) {
        this.vectorStore = [];
        this.corpusStats = null;
        this.isInitialized = false;
        this.config = { ...exports.DEFAULT_ENHANCED_RETRIEVAL_CONFIG, ...config };
    }
    /**
     * Load vector store from disk
     */
    async loadVectorStore() {
        try {
            const filePath = path_1.default.join(process.cwd(), 'data', 'vectorStore.json');
            const fileData = await promises_1.default.readFile(filePath, 'utf8');
            const parsedData = JSON.parse(fileData);
            if (Array.isArray(parsedData)) {
                return parsedData;
            }
            else if (parsedData.items && Array.isArray(parsedData.items)) {
                return parsedData.items;
            }
            return [];
        }
        catch (error) {
            console.error('Error loading vector store:', error);
            return [];
        }
    }
    /**
     * Initialize the retrieval system
     * Loads corpus statistics and vector store
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            console.log('Initializing enhanced retrieval system...');
            // Load corpus statistics for BM25 scoring
            this.corpusStats = await (0, bm25_1.loadCorpusStatistics)();
            console.log(`Loaded corpus statistics with ${Object.keys(this.corpusStats.documentFrequency).length} unique terms`);
            // Load vector store
            this.vectorStore = await this.loadVectorStore();
            console.log(`Loaded vector store with ${this.vectorStore.length} items`);
            this.isInitialized = true;
            console.log('Enhanced retrieval system initialized');
        }
        catch (error) {
            console.error('Error initializing enhanced retrieval system:', error);
            throw new Error('Failed to initialize enhanced retrieval system');
        }
    }
    /**
     * Find similar documents using vector search
     */
    async findSimilarItems(query, options) {
        // Implement a simplified version of vector search
        // In a real implementation, this would use embedding API
        // This is a mock implementation as we can't directly call the existing function
        // Replace this with the actual embedding and vector search in production
        const results = (0, vectorStore_1.getSimilarItems)(
        // Mock embedding - in production, get this from OpenAI API
        Array(1536).fill(0).map(() => Math.random() - 0.5), options.maxResults, query);
        return results.map(result => ({
            item: result,
            score: result.score
        }));
    }
    /**
     * Find documents using the enhanced retrieval approach
     */
    async findSimilarDocuments(query, options = {}) {
        var _a;
        // Ensure system is initialized
        if (!this.isInitialized) {
            await this.initialize();
        }
        // Apply options to config
        const config = { ...this.config, ...options };
        if (config.debug) {
            console.log(`Searching for: "${query}"`);
            console.log(`Tokenized query: [${(0, tokenization_1.tokenize)(query).join(', ')}]`);
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
        const enhancedResults = [];
        for (const result of vectorResults) {
            const document = {
                id: ((_a = result.item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'unknown',
                text: result.item.text
            };
            const bm25Score = (0, bm25_1.calculateBM25Score)(query, document, this.corpusStats);
            // Skip if BM25 score is below threshold
            if (bm25Score < config.minBM25Score && config.bm25Weight > 0) {
                continue;
            }
            // Normalize scores if enabled
            let normalizedBM25 = bm25Score;
            let normalizedVector = result.score;
            // Calculate combined score
            const combinedScore = (0, bm25_1.combineScores)(normalizedBM25, normalizedVector, config.bm25Weight);
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
                console.log(`Result ${i + 1}: Combined score ${result.combinedScore.toFixed(4)} (Vector: ${result.vectorScore.toFixed(4)}, BM25: ${result.bm25Score.toFixed(4)})`);
            });
        }
        return finalResults;
    }
    /**
     * Get document text from results for context generation
     */
    async getContextFromResults(results) {
        return results.map(result => {
            var _a;
            // Include metadata if available
            const source = ((_a = result.item.metadata) === null || _a === void 0 ? void 0 : _a.source)
                ? `Source: ${result.item.metadata.source}\n`
                : '';
            // Return formatted context
            return `${source}${result.item.text}\n\n`;
        }).join('---\n\n');
    }
}
exports.EnhancedRetrieval = EnhancedRetrieval;

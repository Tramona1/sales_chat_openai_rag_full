"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const featureFlags_1 = require("../../utils/featureFlags");
const performanceMonitoring_1 = require("../../utils/performanceMonitoring");
const modelConfig_1 = require("../../utils/modelConfig");
// Simple logger that works without external dependencies
const logger = {
    info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
    debug: (message, ...args) => console.log(`[DEBUG] ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args)
};
// Import at runtime to avoid TypeScript import resolution issues
async function importModules() {
    try {
        const { performVectorSearch } = await Promise.resolve().then(() => __importStar(require('../../utils/vectorSearch')));
        const { performBM25Search } = await Promise.resolve().then(() => __importStar(require('../../utils/bm25Search')));
        const { hybridSearch } = await Promise.resolve().then(() => __importStar(require('../../utils/hybridSearch')));
        const { rerank } = await Promise.resolve().then(() => __importStar(require('../../utils/reranking')));
        const { analyzeQuery } = await Promise.resolve().then(() => __importStar(require('../../utils/queryAnalysis')));
        const { generateAnswer } = await Promise.resolve().then(() => __importStar(require('../../utils/answerGeneration')));
        const { performMultiModalSearch } = await Promise.resolve().then(() => __importStar(require('../../utils/multiModalProcessing')));
        return {
            performVectorSearch,
            performBM25Search,
            hybridSearch,
            rerank,
            analyzeQuery,
            generateAnswer,
            performMultiModalSearch
        };
    }
    catch (error) {
        console.error('Error importing modules:', error);
        throw error;
    }
}
async function handler(req, res) {
    const startTime = Date.now();
    // Only allow POST method
    if (req.method !== 'POST') {
        (0, performanceMonitoring_1.recordMetric)('api', 'query', Date.now() - startTime, false, { error: 'Method not allowed' });
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        // Load modules dynamically
        const modules = await importModules();
        // Extract query parameters
        const { query, limit = 5, useContextualRetrieval = true, includeSourceDocuments = false, includeSourceCitations = true, conversationHistory = '', searchMode = 'hybrid', includeVisualContent = false, visualTypes = [] } = req.body;
        // Validate query
        if (!query || typeof query !== 'string') {
            (0, performanceMonitoring_1.recordMetric)('api', 'query', Date.now() - startTime, false, { error: 'Invalid query' });
            return res.status(400).json({ error: 'Query is required and must be a string' });
        }
        // Track query timing
        const retrievalStartTime = Date.now();
        // Analyze query and determine the best search strategy
        const queryAnalysis = await modules.analyzeQuery(query);
        // Check if contextual retrieval is enabled by feature flags
        const contextualRetrievalEnabled = (0, featureFlags_1.isFeatureEnabled)('contextualReranking') &&
            (0, featureFlags_1.isFeatureEnabled)('contextualEmbeddings') &&
            useContextualRetrieval;
        // Flag to check if we should use multi-modal search
        const useMultiModal = includeVisualContent && (0, featureFlags_1.isFeatureEnabled)('multiModalSearch');
        let searchResults;
        // Choose search strategy based on inputs and feature flags
        if (useMultiModal) {
            // Use multi-modal search if visual content is requested
            searchResults = await modules.performMultiModalSearch(query, {
                limit: Math.max(limit * 3, 15), // Retrieve more than needed for reranking
                includeVisualContent,
                visualTypes: visualTypes
            });
        }
        else if (searchMode === 'hybrid') {
            // Use hybrid search as default
            searchResults = await modules.hybridSearch(query, {
                limit: Math.max(limit * 3, 15) // Retrieve more than needed for reranking
            });
        }
        else if (searchMode === 'vector') {
            // Use vector search if specified
            searchResults = await modules.performVectorSearch(query, Math.max(limit * 3, 15));
        }
        else if (searchMode === 'bm25') {
            // Use BM25 search if specified
            searchResults = await modules.performBM25Search(query, Math.max(limit * 3, 15));
        }
        else {
            // Default to hybrid search
            searchResults = await modules.hybridSearch(query, {
                limit: Math.max(limit * 3, 15)
            });
        }
        const retrievalDuration = Date.now() - retrievalStartTime;
        // If no results, return early
        if (!searchResults || searchResults.length === 0) {
            (0, performanceMonitoring_1.recordMetric)('api', 'query', Date.now() - startTime, false, {
                error: 'No results found',
                retrievalDuration
            });
            return res.status(404).json({
                error: 'No results found for query',
                query,
                timings: { retrievalMs: retrievalDuration }
            });
        }
        // Rerank results if contextual retrieval is enabled
        const rerankStartTime = Date.now();
        let rerankedResults;
        if (contextualRetrievalEnabled) {
            // Use contextual information in reranking
            rerankedResults = await modules.rerank(query, searchResults, limit, {
                useContextualInfo: true,
                includeExplanations: false
            });
        }
        else {
            // Use standard reranking
            rerankedResults = await modules.rerank(query, searchResults, limit);
        }
        const rerankDuration = Date.now() - rerankStartTime;
        // Generate an answer from the results
        const answerStartTime = Date.now();
        // Process the search results for answer generation
        const searchContext = rerankedResults.map((result) => {
            var _a;
            const item = result.item || result;
            // Extract visual content if available and requested
            let visualContent = null;
            if (includeVisualContent && 'visualContent' in item && Array.isArray(item.visualContent)) {
                visualContent = item.visualContent.map((vc) => ({
                    type: vc.type,
                    description: vc.description,
                    text: vc.extractedText
                }));
            }
            // Format the chunk for the answer generation
            return {
                text: item.text,
                source: ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'Unknown',
                score: result.score,
                metadata: item.metadata || {},
                visualContent
            };
        });
        // Get system prompt for this query
        const systemPrompt = (0, modelConfig_1.getSystemPromptForQuery)(query);
        // Generate the answer
        const answer = await modules.generateAnswer(query, searchContext, {
            systemPrompt,
            includeSourceCitations,
            maxSourcesInAnswer: includeSourceDocuments ? limit : 3,
            conversationHistory: conversationHistory || '',
            useContextualInformation: contextualRetrievalEnabled
        });
        const answerDuration = Date.now() - answerStartTime;
        const totalDuration = Date.now() - startTime;
        // Prepare the response
        let response = {
            query,
            answer,
            timings: {
                retrievalMs: retrievalDuration,
                rerankMs: rerankDuration,
                answerMs: answerDuration,
                totalMs: totalDuration
            }
        };
        // Include source documents if requested
        if (includeSourceDocuments) {
            response.sourceDocuments = rerankedResults.map((result) => {
                const item = result.item || result;
                // Create a simplified representation without embeddings to reduce payload size
                const document = {
                    text: item.text,
                    metadata: item.metadata,
                    score: result.score
                };
                // Include visual content if requested and available
                if (includeVisualContent && 'visualContent' in item && Array.isArray(item.visualContent)) {
                    // Only include necessary visual fields, omitting raw image data to reduce payload size
                    document.visualContent = item.visualContent.map((vc) => ({
                        type: vc.type,
                        description: vc.description,
                        extractedText: vc.extractedText,
                        imageUrl: vc.imageUrl
                    }));
                }
                return document;
            });
        }
        // Include query analysis if available
        if (queryAnalysis) {
            response.queryAnalysis = {
                intent: queryAnalysis.intent,
                topics: queryAnalysis.topics,
                entities: queryAnalysis.entities,
                technicalLevel: queryAnalysis.technicalLevel
            };
        }
        // Record successful query metric
        (0, performanceMonitoring_1.recordMetric)('api', 'query', totalDuration, true, {
            retrievalDuration,
            rerankDuration,
            answerDuration,
            resultCount: rerankedResults.length,
            characters: answer.length,
            useContextual: contextualRetrievalEnabled,
            useMultiModal
        });
        // Return the response
        return res.status(200).json(response);
    }
    catch (error) {
        console.error('Error processing query:', error);
        // Record failed query metric
        (0, performanceMonitoring_1.recordMetric)('api', 'query', Date.now() - startTime, false, {
            error: error.message
        });
        return res.status(500).json({
            error: 'Error processing your query',
            message: error.message
        });
    }
}

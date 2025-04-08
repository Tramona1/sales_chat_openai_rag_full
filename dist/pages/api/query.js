"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const queryAnalysis_1 = require("@/utils/queryAnalysis");
const hybridSearch_1 = require("@/utils/hybridSearch");
const queryExpansion_1 = require("@/utils/queryExpansion");
const reranking_1 = require("@/utils/reranking");
const answerGenerator_1 = require("@/utils/answerGenerator");
const errorHandling_1 = require("@/utils/errorHandling");
// Simple logger that works without external dependencies
const logger = {
    info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
    debug: (message, ...args) => console.log(`[DEBUG] ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args)
};
async function handler(req, res) {
    var _a, _b;
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are allowed' });
    }
    logger.info('Query API: Request received');
    try {
        const { query, conversationId, messages, options = {}, context = '' } = req.body;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Query parameter is required and must be a string'
            });
        }
        logger.info(`Query API: Processing query: "${query}" for conversation: ${conversationId}`);
        // Get chat history for context (from messages or conversationId)
        const chatHistory = messages || [];
        logger.info(`Query API: Using chat history with ${chatHistory.length} messages`);
        // Step 1: Analyze the query to determine optimal retrieval strategy
        logger.info('Query API: Analyzing query...');
        const queryAnalysis = await (0, queryAnalysis_1.analyzeQuery)(query);
        logger.info(`Query API: Query analysis complete. Primary category: ${queryAnalysis.primaryCategory}, Query type: ${queryAnalysis.queryType}`);
        // Step 2: Get optimized retrieval parameters based on analysis
        const retrievalParams = (0, queryAnalysis_1.getRetrievalParameters)(queryAnalysis);
        // Step 3: Prepare the final search options by merging client options and
        // retrieval parameters (client options take precedence)
        const searchOptions = {
            ...retrievalParams,
            ...options,
            // Metadata filtering
            filter: {
                ...options.filter,
                // Apply category filter if not overridden by client
                ...(((_a = options.filter) === null || _a === void 0 ? void 0 : _a.categories) ? {} : {
                    categories: retrievalParams.categoryFilter.categories,
                    strictCategoryMatch: retrievalParams.categoryFilter.strict
                }),
                // Apply technical level range if not overridden by client
                ...(((_b = options.filter) === null || _b === void 0 ? void 0 : _b.technicalLevel) ? {} : {
                    technicalLevelMin: retrievalParams.technicalLevelRange.min,
                    technicalLevelMax: retrievalParams.technicalLevelRange.max
                })
            }
        };
        console.log('[Query Routing] Analysis:', {
            query,
            primaryCategory: queryAnalysis.primaryCategory,
            queryType: queryAnalysis.queryType,
            entities: queryAnalysis.entities.map(e => e.name),
            hybridRatio: searchOptions.hybridRatio
        });
        // Check for company-specific terms for debugging
        const companyTerms = ['workstream', 'company', 'pricing', 'product', 'feature', 'plan', 'customer'];
        const containsCompanyTerms = companyTerms.some(term => query.toLowerCase().includes(term));
        console.log(`DEBUG: Query contains company terms: ${containsCompanyTerms}`);
        // Step 4: Expand query if needed
        let processedQuery = query;
        if (searchOptions.expandQuery) {
            try {
                const expandedResult = await (0, queryExpansion_1.expandQuery)(query);
                processedQuery = expandedResult.expandedQuery;
                console.log(`DEBUG: Expanded query: "${processedQuery}"`);
            }
            catch (err) {
                console.error('Error expanding query, using original:', err);
            }
        }
        // Step 5: Perform hybrid search with optimal parameters
        console.log(`DEBUG: Performing hybrid search for "${processedQuery}" with hybridRatio ${searchOptions.hybridRatio}`);
        const searchResults = await (0, hybridSearch_1.performHybridSearch)(processedQuery, searchOptions.limit || 10, searchOptions.hybridRatio || 0.5, searchOptions.filter);
        console.log(`DEBUG: Hybrid search found ${searchResults.length} results`);
        if (searchResults.length > 0) {
            console.log(`DEBUG: Top result score: ${searchResults[0].score.toFixed(4)}`);
            if (searchResults[0].item && searchResults[0].item.metadata) {
                console.log(`DEBUG: Top result source: ${searchResults[0].item.metadata.source || 'Unknown'}`);
                console.log(`DEBUG: Top result excerpt: ${searchResults[0].item.text.substring(0, 150)}...`);
            }
        }
        else {
            console.log(`DEBUG: No results found. This may indicate an issue with the vector store or search parameters.`);
        }
        // Step 6: Apply re-ranking if enabled
        let finalResults = searchResults;
        if (searchOptions.rerank) {
            const rerankCount = searchOptions.rerankCount || 20;
            try {
                // Add required metadata field for reranking
                const enhancedResults = searchResults.map(result => ({
                    ...result,
                    metadata: {
                        matchesCategory: true,
                        categoryBoost: 0,
                        technicalLevelMatch: 1,
                        ...(result.item.metadata || {})
                    }
                }));
                finalResults = await (0, reranking_1.rerank)(query, enhancedResults, rerankCount);
                console.log(`DEBUG: Reranking applied, final results: ${finalResults.length}`);
            }
            catch (error) {
                console.error('Error during reranking, using original results:', error);
            }
        }
        // Step 7: Generate answer from search results
        logger.info(`Query API: Found ${finalResults.length} relevant results for answer generation`);
        logger.info('Query API: Generating answer...');
        const formattedResults = finalResults.map(result => {
            var _a;
            return ({
                text: result.item.text,
                source: ((_a = result.item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'Unknown',
                metadata: result.item.metadata,
                relevanceScore: result.score
            });
        });
        // Prepare answer options
        let answerOptions = {
            includeSourceCitations: true,
            maxSourcesInAnswer: 5,
            conversationHistory: context
        };
        // If company context is provided, add it to the system prompt
        if (options.companyContext) {
            // Construct a prompt that guides the model to use company information
            const companyContext = options.companyContext;
            // Create a focused company context
            const companyPrompt = `
Company: ${companyContext.companyName || 'Unknown'}
Industry: ${companyContext.industry || 'Unknown'}
Size: ${companyContext.size || 'Unknown'}
Location: ${companyContext.location || 'Unknown'}
Details: ${companyContext.companyInfo.substring(0, 1500)}
${companyContext.salesNotes ? `\nSales Rep Notes:\n${companyContext.salesNotes}` : ''}
`;
            // Add the company context to answer options
            answerOptions.systemPrompt = `You are a sales assistant for Workstream, a hiring and onboarding platform. 
Use the following information about the company the sales rep is talking to in order to provide relevant, 
personalized answers about how Workstream can help them:

${companyPrompt}

When responding, connect Workstream's features to the company's specific industry, size, and potential challenges.
Be conversational and helpful, suggesting specific Workstream features that would benefit this company based on 
what you know about them. If you don't know something specific about the company, don't make it up.

IMPORTANT: If sales rep notes are provided, consider them authoritative and incorporate that information into your responses.
These notes may contain key insights from previous conversations with the company that should guide your recommendations.`;
        }
        const answer = await (0, answerGenerator_1.generateAnswer)(query, formattedResults, answerOptions);
        logger.info('Query API: Answer generated successfully');
        // Prepare the response
        const response = {
            answer: answer,
            sources: finalResults.map(result => {
                var _a, _b, _c;
                return ({
                    title: ((_a = result.item.metadata) === null || _a === void 0 ? void 0 : _a.title) || ((_b = result.item.metadata) === null || _b === void 0 ? void 0 : _b.source) || 'Unknown',
                    source: ((_c = result.item.metadata) === null || _c === void 0 ? void 0 : _c.source) || 'Unknown',
                    relevance: result.score
                });
            }),
            metadata: {
                originalQuery: query,
                processedQuery: processedQuery !== query ? processedQuery : undefined,
                strategy: {
                    primaryCategory: queryAnalysis.primaryCategory,
                    queryType: queryAnalysis.queryType,
                    entityCount: queryAnalysis.entities.length,
                    hybridRatio: searchOptions.hybridRatio,
                    usedQueryExpansion: searchOptions.expandQuery,
                    usedReranking: searchOptions.rerank
                }
            }
        };
        return res.status(200).json(response);
    }
    catch (error) {
        logger.error('Query API: Error processing query', error);
        // Use standardized error response if available
        let errorResponse;
        try {
            errorResponse = (0, errorHandling_1.standardizeApiErrorResponse)(error);
        }
        catch (_) {
            errorResponse = {
                error: 'Error processing query',
                message: (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error'
            };
        }
        return res.status(500).json(errorResponse);
    }
}

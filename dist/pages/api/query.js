"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const openaiClient_1 = require("../../utils/openaiClient");
const advancedDocumentProcessing_1 = require("../../utils/advancedDocumentProcessing");
const errorHandling_1 = require("../../utils/errorHandling");
const modelConfig_1 = require("../../utils/modelConfig");
const enhancedRetrieval_1 = require("../../utils/enhancedRetrieval");
const reranking_1 = require("../../utils/reranking");
const caching_1 = require("../../utils/caching");
const queryExpansion_1 = require("../../utils/queryExpansion");
// Initialize the enhanced retrieval system
const enhancedRetrieval = new enhancedRetrieval_1.EnhancedRetrieval({
    bm25Weight: 0.3, // 30% weight for BM25 scores
    minBM25Score: 0.01, // Minimum score to consider relevant
    minVectorScore: 0.6, // Minimum vector similarity
    normalizeScores: true, // Normalize scores before combining
    maxResults: 10, // Initial results to retrieve
    debug: process.env.NODE_ENV !== 'production' // Enable debug in non-production
});
async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    try {
        const { query, urgent = false } = req.body;
        if (!query) {
            return res.status(400).json({ message: 'Query is required' });
        }
        // Check cache first for non-urgent queries
        if (!urgent) {
            const cachedResult = await (0, caching_1.getCachedResult)(query);
            if (cachedResult) {
                console.log(`Cache hit for query: "${query}"`);
                return res.status(200).json(cachedResult);
            }
        }
        // Step 1: Analyze the query for intent and information needs
        const queryAnalysis = await (0, advancedDocumentProcessing_1.analyzeQuery)(query);
        console.log('Query analysis:', JSON.stringify(queryAnalysis, null, 2));
        // Step 2: Apply query expansion for better retrieval
        // Skip for urgent queries to reduce latency
        let expandedQueryResult;
        let queryForRetrieval = query;
        if (!urgent) {
            console.log('Applying query expansion to improve recall...');
            // Use optimized query expansion parameters
            expandedQueryResult = await (0, queryExpansion_1.expandQuery)(query, {
                maxExpandedTerms: 3,
                useSemanticExpansion: queryAnalysis.complexity > 1, // Use semantic for complex queries
                useKeywordExpansion: true, // Always use keyword expansion (cheap)
                semanticWeight: 0.6, // Balanced weight between semantic and keyword expansion
                timeoutMs: 2500, // Slightly increased timeout for better results
                enableCaching: true, // Ensure caching is enabled
                debug: process.env.NODE_ENV !== 'production'
            });
            if (expandedQueryResult.expansionType !== 'none') {
                queryForRetrieval = expandedQueryResult.expandedQuery;
                console.log(`Expanded query: "${queryForRetrieval}"`);
                console.log(`Added terms: ${expandedQueryResult.addedTerms.join(', ')}`);
                console.log(`Expansion type: ${expandedQueryResult.expansionType}`);
            }
        }
        // Step 3: Generate embedding for the query
        const queryEmbedding = await (0, openaiClient_1.embedText)(queryForRetrieval);
        const queryLower = query.toLowerCase();
        // Detect if query is asking about pricing or plans
        const isPricingQuery = queryLower.match(/pricing|price|cost|subscription|tier|plan|package|fee|\$/);
        // Detect if query is asking about product features
        const isProductFeaturesQuery = queryLower.match(/feature|functionality|capability|how (does|do) .* work|what (does|do) .* do/);
        // Detect if query is looking for sales information
        const isSalesQuery = queryLower.match(/sell|pitch|present|proposal|demo|sales|competitor|comparison|vs\.?|versus/);
        // When retrieving similar items, add priority for the new categories
        let priorityInfoType = undefined;
        if (isPricingQuery) {
            priorityInfoType = 'pricing';
            console.log('Query appears to be about pricing information');
        }
        else if (isProductFeaturesQuery) {
            priorityInfoType = 'product_features';
            console.log('Query appears to be about product features');
        }
        else if (isSalesQuery) {
            priorityInfoType = 'sales_info';
            console.log('Query appears to be about sales information');
        }
        console.log(`Using enhanced retrieval with BM25 and vector search for query: "${queryForRetrieval}"`);
        // Step 4: Use enhanced retrieval system with hybrid search
        const retrievalOptions = {
            debug: process.env.NODE_ENV !== 'production',
            bm25Weight: priorityInfoType ? 0.4 : 0.3, // Increase BM25 weight for structured queries
            maxResults: urgent ? 5 : 10, // Retrieve more results for re-ranking in non-urgent mode
        };
        // Find similar documents using enhanced retrieval
        const retrievalResults = await enhancedRetrieval.findSimilarDocuments(queryForRetrieval, retrievalOptions);
        console.log(`Retrieved ${retrievalResults.length} results with hybrid search`);
        // Check if we should apply re-ranking
        // Skip for urgent queries or very simple queries to reduce latency
        const shouldRerank = !urgent && queryAnalysis.complexity > 1 && retrievalResults.length > 2;
        let finalResults;
        if (shouldRerank) {
            // Step 5a: Apply re-ranking for non-urgent, complex queries
            console.log('Applying re-ranking to improve result relevance...');
            const rerankedResults = await (0, reranking_1.rerankResults)(query, retrievalResults, {
                returnTopN: 5,
                model: 'gpt-3.5-turbo', // Use faster model for production
                timeoutMs: 8000, // Set timeout to ensure we don't wait too long
                parallelBatching: true,
                debug: process.env.NODE_ENV !== 'production',
            });
            finalResults = rerankedResults.map(result => result.originalResult);
            console.log(`Re-ranking complete. Using ${finalResults.length} re-ranked results.`);
        }
        else {
            // Step 5b: Apply content-based boosting for urgent queries
            console.log('Using content-based boosting for quick results (urgent mode or simple query)');
            const boostedResults = retrievalResults.map((result) => {
                const boostFactor = calculateBoostFactor(queryAnalysis, result.item);
                return {
                    ...result,
                    boost: boostFactor,
                    finalScore: result.combinedScore * boostFactor
                };
            });
            // Re-rank based on combined scores and boost factors
            finalResults = boostedResults
                .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
                .slice(0, 5); // Get top 5 after boosting
        }
        // Format context for OpenAI
        const context = finalResults
            .map(result => {
            var _a, _b;
            // Prepare source attribution
            let sourceInfo = `Source: ${((_a = result.item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'Unknown'}`;
            if ((_b = result.item.metadata) === null || _b === void 0 ? void 0 : _b.page) {
                sourceInfo += `, Page: ${result.item.metadata.page}`;
            }
            // Include additional score information in development
            if (process.env.NODE_ENV !== 'production') {
                sourceInfo += ` (BM25: ${result.bm25Score.toFixed(3)}, Vector: ${result.vectorScore.toFixed(3)}, Combined: ${result.combinedScore.toFixed(3)})`;
            }
            return `${result.item.text}\n\n${sourceInfo}`;
        })
            .join('\n\n---\n\n');
        // Create a dynamic system prompt based on query analysis
        let systemPrompt = `You are an AI assistant for a sales team. Answer the user's question based ONLY on the context provided below.
If the answer cannot be determined from the context, say "I don't have enough information to answer this question" - do NOT make up information.
Be concise but thorough. Include all relevant details from the context provided.
Format your response clearly with appropriate paragraphs, bullet points, or numbered lists as needed.`;
        // Adjust system prompt based on query analysis
        if (queryAnalysis.expectedFormat === 'list') {
            systemPrompt += "\nUse bullet points for your response when appropriate.";
        }
        else if (queryAnalysis.expectedFormat === 'steps') {
            systemPrompt += "\nProvide a clear step-by-step explanation.";
        }
        // Add technical level guidance
        if (queryAnalysis.technicalLevel >= 4) {
            systemPrompt += "\nUse technical language and detailed explanations.";
        }
        else if (queryAnalysis.technicalLevel <= 2) {
            systemPrompt += "\nUse simple language and explain concepts clearly.";
        }
        // Generate response with OpenAI, using our enhanced client
        const userMessage = `Context:\n${context}\n\nQuestion: ${query}`;
        const response = await (0, openaiClient_1.generateChatCompletion)(systemPrompt, userMessage, modelConfig_1.AI_SETTINGS.defaultModel);
        // Prepare result object
        const result = {
            answer: response,
            sources: finalResults.map(result => {
                var _a, _b;
                const resultWithScore = result;
                return {
                    source: ((_a = result.item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'Unknown',
                    page: (_b = result.item.metadata) === null || _b === void 0 ? void 0 : _b.page,
                    relevance: (resultWithScore.finalScore !== undefined ? resultWithScore.finalScore : result.combinedScore).toFixed(2),
                    // Include more detailed scoring info in development
                    scores: process.env.NODE_ENV !== 'production' ? {
                        bm25: result.bm25Score,
                        vector: result.vectorScore,
                        combined: result.combinedScore,
                        boost: result.boost,
                        final: resultWithScore.finalScore
                    } : undefined
                };
            }),
            metadata: {
                retrieval: {
                    method: shouldRerank ? 'hybrid_with_reranking' : 'hybrid_with_boosting',
                    totalResults: retrievalResults.length,
                    returnedResults: finalResults.length,
                    urgent: urgent,
                    queryComplexity: queryAnalysis.complexity,
                    queryExpansion: expandedQueryResult ? {
                        applied: expandedQueryResult.expansionType !== 'none',
                        type: expandedQueryResult.expansionType,
                        addedTerms: expandedQueryResult.addedTerms
                    } : undefined
                }
            }
        };
        // Cache result for non-urgent queries (1 hour TTL)
        if (!urgent) {
            await (0, caching_1.cacheResult)(query, result, 3600);
        }
        // Return the response and relevant sources
        return res.status(200).json(result);
    }
    catch (error) {
        console.error('Error in query processing:', error);
        // Use our standardized error response
        const errorResponse = (0, errorHandling_1.standardizeApiErrorResponse)(error);
        return res.status(500).json(errorResponse);
    }
}
/**
 * Simple boost factor calculation based on query analysis
 */
function calculateBoostFactor(queryAnalysis, item) {
    var _a;
    let boostFactor = 1.0;
    // Check for structured information and boost it
    if ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.isStructured) {
        boostFactor *= 1.5;
        // If the text has list format and query expects a list, boost it more
        if (queryAnalysis.expectedFormat === 'list' &&
            (item.text.includes('- ') || item.text.includes('• '))) {
            boostFactor *= 1.2;
        }
    }
    // Check for technical level match
    const contentTechLevel = estimateContentTechLevel(item.text);
    const techLevelDiff = Math.abs(contentTechLevel - queryAnalysis.technicalLevel);
    if (techLevelDiff <= 1) {
        boostFactor *= 1.1; // Boost if technical levels are a good match
    }
    // Boost on query topic presence in text 
    if (queryAnalysis.topics && queryAnalysis.topics.length > 0) {
        const lowerText = item.text.toLowerCase();
        const topicMatches = queryAnalysis.topics.filter((topic) => lowerText.includes(topic.toLowerCase())).length;
        if (topicMatches > 0) {
            boostFactor *= 1.0 + (topicMatches * 0.1);
        }
    }
    return boostFactor;
}
/**
 * Estimate technical level of content based on simple heuristics
 */
function estimateContentTechLevel(text) {
    const lowerText = text.toLowerCase();
    // Simple heuristics to estimate technical level
    const technicalTerms = [
        'algorithm', 'implementation', 'architecture', 'infrastructure',
        'configuration', 'deployment', 'integration', 'protocol'
    ];
    const basicTerms = [
        'simple', 'easy', 'straightforward', 'basic', 'just', 'simply'
    ];
    const techTermCount = technicalTerms.filter(term => lowerText.includes(term)).length;
    const basicTermCount = basicTerms.filter(term => lowerText.includes(term)).length;
    // Calculate a score from 1 to 5
    let techLevel = 3; // Default mid-level
    techLevel += techTermCount * 0.5;
    techLevel -= basicTermCount * 0.5;
    // Clamp between 1 and 5
    return Math.max(1, Math.min(5, techLevel));
}

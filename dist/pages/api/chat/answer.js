"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleQuery = handleQuery;
exports.default = handler;
const hybridSearch_1 = require("@/utils/hybridSearch");
const openaiClient_1 = require("@/utils/openaiClient");
/**
 * Handle user query and generate response
 */
async function handleQuery(query) {
    try {
        console.log(`Processing query: ${query}`);
        // First try standard search (excluding deprecated docs by default)
        let searchResponse = await (0, hybridSearch_1.hybridSearch)(query);
        let searchResults = Array.from(searchResponse); // Use iterator protocol for backward compatibility
        // If no results, try fallback search
        if (searchResults.length === 0) {
            console.log('No results from primary search, trying fallback search');
            const fallbackResponse = await (0, hybridSearch_1.fallbackSearch)(query);
            searchResults = Array.from(fallbackResponse);
        }
        // If still no results, return a no-results message
        if (searchResults.length === 0) {
            console.log('No results found even with fallback search');
            return {
                answer: "I'm sorry, but I couldn't find information related to your question in my knowledge base.",
                sources: [],
                statusCode: 404
            };
        }
        // Prepare context from search results
        const context = searchResults
            .map(item => {
            var _a, _b, _c;
            const source = ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'unknown';
            const lastUpdated = ((_b = item.metadata) === null || _b === void 0 ? void 0 : _b.lastUpdated)
                ? `(Last updated: ${new Date(item.metadata.lastUpdated).toLocaleDateString()})`
                : '';
            const authoritative = ((_c = item.metadata) === null || _c === void 0 ? void 0 : _c.isAuthoritative) === 'true'
                ? ' [AUTHORITATIVE SOURCE]'
                : '';
            return `SOURCE [${source}]${authoritative}${lastUpdated}:\n${item.text}\n`;
        })
            .join('\n\n');
        // Create prompt for LLM
        const systemPrompt = `You are a helpful AI assistant that accurately answers user questions 
based on the context provided. If the context doesn't contain the relevant information, 
acknowledge that you don't know instead of making up an answer.

When referencing information, include the source identifier (e.g., "According to [SOURCE-123]...").
Prioritize information from sources marked as "AUTHORITATIVE SOURCE" when there are conflicts in the provided context.
Use the most recently updated information when available.`;
        const userPrompt = `CONTEXT:\n${context}\n\nQUESTION: ${query}\n\nAnswer the question based only on the provided context. Include relevant SOURCE references.`;
        // Generate answer using LLM
        const answer = await (0, openaiClient_1.generateChatCompletion)(systemPrompt, userPrompt);
        // Extract sources from results
        const sources = searchResults
            .map(item => { var _a; return ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) || ''; })
            .filter(source => source !== '');
        // Return the answer and sources
        return {
            answer,
            sources,
            statusCode: 200
        };
    }
    catch (error) {
        console.error('Error generating answer:', error);
        return {
            answer: "I'm sorry, there was an error processing your question. Please try again later.",
            sources: [],
            statusCode: 500,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
/**
 * API handler for chat answers
 */
async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }
    // Extract query from request body
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: 'Missing or invalid query parameter' });
    }
    try {
        // Process the query
        const { answer, sources, statusCode, error } = await handleQuery(query);
        // Return the response
        return res.status(statusCode).json({
            answer,
            sources,
            error
        });
    }
    catch (error) {
        console.error('Error in API handler:', error);
        return res.status(500).json({
            message: 'An unexpected error occurred',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

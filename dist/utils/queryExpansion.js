"use strict";
/**
 * Query Expansion Module
 *
 * This module provides functionality to expand user queries with related terms
 * to improve retrieval performance, especially for complex or ambiguous queries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_EXPANSION_OPTIONS = void 0;
exports.semanticQueryExpansion = semanticQueryExpansion;
exports.keywordQueryExpansion = keywordQueryExpansion;
exports.analyzeQuery = analyzeQuery;
exports.expandQuery = expandQuery;
const openaiClient_1 = require("./openaiClient");
const tokenization_1 = require("./tokenization");
const errorHandling_1 = require("./errorHandling");
const caching_1 = require("./caching");
/**
 * Default options for query expansion
 */
exports.DEFAULT_EXPANSION_OPTIONS = {
    maxExpandedTerms: 4, // Reduced from 5 based on test results
    model: 'gpt-3.5-turbo',
    useSemanticExpansion: true,
    useKeywordExpansion: true,
    semanticWeight: 0.7, // Favor semantic expansion by default
    includeMetadata: true,
    timeoutMs: 2000, // Reduced timeout for better performance
    enableCaching: true,
    cacheTtlSeconds: 86400, // 24 hours
    debug: false
};
/**
 * Expand a query using semantic techniques (LLM-based)
 *
 * This approach uses language models to understand query intent
 * and generate related terms.
 */
async function semanticQueryExpansion(query, options = {}) {
    const config = { ...exports.DEFAULT_EXPANSION_OPTIONS, ...options };
    const startTime = Date.now();
    // Try to get cached result if caching is enabled
    if (config.enableCaching) {
        const cacheKey = `semantic_expansion:${query}`;
        const cachedResult = (0, caching_1.getFromCache)(cacheKey);
        if (cachedResult && Array.isArray(cachedResult)) {
            if (config.debug) {
                console.log('Using cached semantic expansion results for query:', query);
            }
            return cachedResult;
        }
    }
    try {
        // Create system prompt for semantic expansion
        // More targeted prompt based on query type to improve relevance
        const systemPrompt = `You are an expert in information retrieval helping to improve search quality.
Your task is to expand the user's query with related terms to improve search results.
Focus on adding precise, targeted phrases that might appear in relevant documents.
The phrases should be concise (2-5 words) and directly related to the original query.
Do NOT change the original meaning or intent of the query.
Return ONLY a JSON array of additional search terms (no explanations).
Limit your response to the most effective expansion terms.`;
        // Create user prompt - using better instruction for more focused expansion
        const userPrompt = `Original Query: ${query}
    
Please provide up to ${config.maxExpandedTerms} additional phrases that would be effective for retrieving relevant documents.
Consider:
- Alternative terminology experts might use
- Specific phrases likely to appear in authoritative sources
- Terms that clarify ambiguous aspects of the query
- Focus on precision over recall

Return as a JSON array of strings.`;
        // Set up timeout for semantic expansion
        const expansionPromise = (0, openaiClient_1.generateStructuredResponse)(systemPrompt, userPrompt, [], config.model);
        // Add timeout using AbortController instead of Promise.race for cleaner cancellation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
        try {
            // Try structured response first (most reliable)
            const result = await expansionPromise;
            clearTimeout(timeoutId);
            if (Array.isArray(result)) {
                const validTerms = result
                    .filter(term => typeof term === 'string' &&
                    term.length > 0 &&
                    term.length < 60 && // Reasonable length limit
                    !query.toLowerCase().includes(term.toLowerCase()))
                    .slice(0, config.maxExpandedTerms);
                // Cache the result if caching is enabled
                if (config.enableCaching && validTerms.length > 0) {
                    const cacheKey = `semantic_expansion:${query}`;
                    await (0, caching_1.cacheWithExpiry)(cacheKey, validTerms, config.cacheTtlSeconds);
                }
                return validTerms;
            }
        }
        catch (structuredError) {
            // If structured response fails, try fallback
            if (config.debug) {
                console.log(`Structured expansion failed for "${query}". Using fallback.`);
            }
        }
        // Fallback to simpler expansion if structured response fails
        try {
            const fallbackResponse = await (0, openaiClient_1.generateChatCompletion)("You are a search query expansion expert. Provide only related search terms, no explanations.", `Generate ${config.maxExpandedTerms} search terms related to: "${query}"\nReturn one term per line, no numbering or bullets.`, config.model, false);
            // Parse the response to extract terms (one per line)
            const terms = fallbackResponse
                .split('\n')
                .map(line => line.trim().replace(/^[•\-\d.\s]+/, '')) // Remove bullets, numbers
                .filter(line => line &&
                !line.startsWith('-') &&
                line.length > 2 &&
                line.length < 60 &&
                !query.toLowerCase().includes(line.toLowerCase()))
                .slice(0, config.maxExpandedTerms);
            // Cache the result if caching is enabled
            if (config.enableCaching && terms.length > 0) {
                const cacheKey = `semantic_expansion:${query}`;
                await (0, caching_1.cacheWithExpiry)(cacheKey, terms, config.cacheTtlSeconds);
            }
            return terms;
        }
        catch (fallbackError) {
            (0, errorHandling_1.logError)('semanticQueryExpansion:fallback', fallbackError);
            return []; // Return empty array if all methods fail
        }
    }
    catch (error) {
        (0, errorHandling_1.logError)('semanticQueryExpansion', error);
        return []; // Return empty array on error
    }
    finally {
        if (config.debug) {
            const duration = Date.now() - startTime;
            console.log(`Semantic expansion took ${duration}ms for query: "${query}"`);
        }
    }
}
/**
 * Expand a query using keyword-based techniques
 *
 * This simpler approach uses word forms, common synonyms, and
 * domain-specific transformations.
 */
function keywordQueryExpansion(query, options = {}) {
    const config = { ...exports.DEFAULT_EXPANSION_OPTIONS, ...options };
    const startTime = Date.now();
    // Try to get cached result if caching is enabled
    if (config.enableCaching) {
        const cacheKey = `keyword_expansion:${query}`;
        const cachedResult = (0, caching_1.getFromCache)(cacheKey);
        if (cachedResult && Array.isArray(cachedResult)) {
            if (config.debug) {
                console.log(`Cache hit for keyword expansion of query: "${query}"`);
            }
            return cachedResult;
        }
    }
    try {
        // Tokenize the query
        const tokens = (0, tokenization_1.tokenize)(query);
        const expandedTerms = [];
        const queryLower = query.toLowerCase();
        // Common business terms synonyms/related terms - expanded with more relevant terms
        const synonymMap = {
            'price': ['cost', 'pricing', 'fee', 'subscription', 'pricing plans'],
            'pricing': ['price', 'cost', 'fee', 'subscription', 'rate card'],
            'cost': ['price', 'pricing', 'expense', 'fee', 'budget'],
            'discount': ['offer', 'deal', 'promotion', 'reduced', 'savings', 'special offer'],
            'feature': ['capability', 'functionality', 'option', 'service', 'tool'],
            'security': ['protection', 'privacy', 'secure', 'encryption', 'data protection'],
            'support': ['help', 'assistance', 'service', 'customer service', 'technical support'],
            'compare': ['comparison', 'versus', 'vs', 'difference', 'competitive analysis'],
            'competitor': ['competition', 'alternative', 'rival', 'industry peer', 'market competitor'],
            'enterprise': ['business', 'corporate', 'company', 'organization', 'large company'],
            'plan': ['package', 'tier', 'subscription', 'offering', 'service level'],
            'basic': ['starter', 'standard', 'entry-level', 'fundamental', 'essential'],
            'professional': ['premium', 'advanced', 'expert', 'pro', 'business level'],
            'upgrade': ['enhance', 'improve', 'advance', 'move up', 'switch plans'],
            'team': ['group', 'staff', 'employees', 'workforce', 'personnel'],
            'user': ['account', 'seat', 'license', 'member', 'individual']
        };
        // Domain-specific transformations - more focused on query type
        // Pricing queries
        if (queryLower.includes('price') || queryLower.includes('cost') || queryLower.includes('pricing')) {
            expandedTerms.push('pricing plans');
            expandedTerms.push('subscription options');
            if (queryLower.includes('enterprise') || queryLower.includes('business') || queryLower.includes('corporate')) {
                expandedTerms.push('enterprise pricing');
                expandedTerms.push('business rates');
            }
            if (queryLower.includes('basic') || queryLower.includes('standard')) {
                expandedTerms.push('basic plan pricing');
                expandedTerms.push('standard tier cost');
            }
        }
        // Compare/competitor queries
        if (queryLower.includes('compare') || queryLower.includes('competitor') || queryLower.includes('vs')) {
            expandedTerms.push('versus competitors');
            expandedTerms.push('competitive advantage');
            expandedTerms.push('product comparison');
        }
        // Discount queries
        if (queryLower.includes('discount') || queryLower.includes('offer')) {
            expandedTerms.push('special pricing');
            expandedTerms.push('promotional discount');
            expandedTerms.push('volume discount');
            if (queryLower.includes('education') || queryLower.includes('student') || queryLower.includes('school')) {
                expandedTerms.push('educational discount');
                expandedTerms.push('academic pricing');
            }
        }
        // Feature queries
        if (queryLower.includes('feature') || queryLower.includes('include') || queryLower.includes('offer')) {
            expandedTerms.push('product features');
            expandedTerms.push('included capabilities');
            expandedTerms.push('service offerings');
        }
        // Add synonyms for each token
        for (const token of tokens) {
            const lowerToken = token.toLowerCase();
            if (synonymMap[lowerToken]) {
                // Add relevant synonyms
                expandedTerms.push(...synonymMap[lowerToken]);
            }
        }
        // Remove duplicates and limit to max terms
        const uniqueTerms = [...new Set(expandedTerms)]
            .filter(term => !queryLower.includes(term.toLowerCase()))
            .slice(0, config.maxExpandedTerms);
        // Cache the result if caching is enabled
        if (config.enableCaching && uniqueTerms.length > 0) {
            const cacheKey = `keyword_expansion:${query}`;
            (0, caching_1.cacheWithExpiry)(cacheKey, uniqueTerms, config.cacheTtlSeconds);
        }
        if (config.debug) {
            const duration = Date.now() - startTime;
            console.log(`Keyword expansion took ${duration}ms for query: "${query}"`);
        }
        return uniqueTerms;
    }
    catch (error) {
        (0, errorHandling_1.logError)('keywordQueryExpansion', error);
        return []; // Return empty array on error
    }
}
/**
 * Analyze query to determine domain context and technical level
 */
async function analyzeQuery(query) {
    try {
        // Try to get cached result
        const cacheKey = `query_analysis:${query}`;
        const cachedResult = (0, caching_1.getFromCache)(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }
        const systemPrompt = `You are an expert query analyzer. Analyze the given query and determine:
1. Technical level (1-5 scale where 1=basic, 5=highly technical)
2. Domain context (single word: pricing, technical, support, feature, comparison, general)
3. Complexity (1-5 scale where 1=simple, 5=complex)`;
        const userPrompt = `Query: ${query}
    
Please analyze this query and return a JSON object with technicalLevel (number 1-5), domainContext (string), and complexity (number 1-5).`;
        const result = await (0, openaiClient_1.generateStructuredResponse)(systemPrompt, userPrompt, {
            technicalLevel: 1,
            domainContext: "general",
            complexity: 1
        }, 'gpt-3.5-turbo');
        const analysis = {
            technicalLevel: (result === null || result === void 0 ? void 0 : result.technicalLevel) || 1,
            domainContext: (result === null || result === void 0 ? void 0 : result.domainContext) || 'general',
            complexity: (result === null || result === void 0 ? void 0 : result.complexity) || 1
        };
        // Cache the result
        await (0, caching_1.cacheWithExpiry)(cacheKey, analysis, 86400); // 24 hours TTL
        return analysis;
    }
    catch (error) {
        (0, errorHandling_1.logError)('analyzeQuery', error);
        return {
            technicalLevel: 1,
            domainContext: 'general',
            complexity: 1
        };
    }
}
/**
 * Main function to expand a query using multiple techniques
 */
async function expandQuery(query, options = {}) {
    const config = { ...exports.DEFAULT_EXPANSION_OPTIONS, ...options };
    let expansionType = 'none';
    let addedTerms = [];
    const startTime = Date.now();
    try {
        if (config.debug) {
            console.log(`Expanding query: "${query}"`);
        }
        // Try to get cached full expansion result
        if (config.enableCaching) {
            const cacheKey = `full_expansion:${query}:${config.useSemanticExpansion}:${config.useKeywordExpansion}:${config.maxExpandedTerms}`;
            const cachedResult = (0, caching_1.getFromCache)(cacheKey);
            if (cachedResult) {
                if (config.debug) {
                    console.log('Using cached query expansion results for query:', query);
                }
                return cachedResult;
            }
        }
        // Get query analysis to determine expansion strategy
        let analysis = { technicalLevel: 1, domainContext: 'general', complexity: 1 };
        if (config.includeMetadata || config.debug) {
            analysis = await analyzeQuery(query);
        }
        // Adjust semantic/keyword weights based on query characteristics
        let dynamicSemanticWeight = config.semanticWeight;
        // More complex or technical queries benefit from semantic expansion
        if (analysis.complexity > 3 || analysis.technicalLevel > 3) {
            dynamicSemanticWeight = Math.min(0.9, dynamicSemanticWeight + 0.2);
        }
        // Simple pricing or feature queries often do well with keyword expansion
        if (analysis.complexity < 2 &&
            (analysis.domainContext === 'pricing' || analysis.domainContext === 'feature')) {
            dynamicSemanticWeight = Math.max(0.3, dynamicSemanticWeight - 0.2);
        }
        if (config.debug) {
            console.log(`Query analysis: level=${analysis.technicalLevel}, domain=${analysis.domainContext}, complexity=${analysis.complexity}`);
            console.log(`Using semantic weight: ${dynamicSemanticWeight}`);
        }
        // Start with an empty set of added terms
        addedTerms = [];
        // Try semantic expansion if enabled
        const semanticTerms = [];
        if (config.useSemanticExpansion) {
            const semResults = await semanticQueryExpansion(query, {
                ...config,
                maxExpandedTerms: Math.ceil(config.maxExpandedTerms * dynamicSemanticWeight)
            });
            if (semResults.length > 0) {
                semanticTerms.push(...semResults);
                expansionType = 'semantic';
            }
        }
        // Add keyword-based expansion if enabled
        const keywordTerms = [];
        if (config.useKeywordExpansion) {
            const kwResults = keywordQueryExpansion(query, {
                ...config,
                maxExpandedTerms: Math.ceil(config.maxExpandedTerms * (1 - dynamicSemanticWeight))
            });
            if (kwResults.length > 0) {
                keywordTerms.push(...kwResults);
                expansionType = semanticTerms.length > 0 ? 'hybrid' : 'keyword';
            }
        }
        // Combine results based on weights
        if (semanticTerms.length > 0 && keywordTerms.length > 0) {
            // Calculate how many terms to take from each source
            const semanticCount = Math.min(semanticTerms.length, Math.max(1, Math.round(config.maxExpandedTerms * dynamicSemanticWeight)));
            const keywordCount = Math.min(keywordTerms.length, config.maxExpandedTerms - semanticCount);
            addedTerms = [
                ...semanticTerms.slice(0, semanticCount),
                ...keywordTerms.slice(0, keywordCount)
            ];
            expansionType = 'hybrid';
        }
        else {
            // Just add whatever we have
            addedTerms = [...semanticTerms, ...keywordTerms];
        }
        // Remove duplicates and filter out terms already in the query
        addedTerms = [...new Set(addedTerms)]
            .filter(term => !query.toLowerCase().includes(term.toLowerCase()))
            .slice(0, config.maxExpandedTerms);
        // Create expanded query by combining original with added terms
        const expandedQuery = addedTerms.length > 0
            ? `${query} ${addedTerms.join(' ')}`
            : query;
        if (config.debug) {
            console.log(`Original query: "${query}"`);
            console.log(`Expanded query: "${expandedQuery}"`);
            console.log(`Added terms: ${addedTerms.join(', ')}`);
            console.log(`Expansion type: ${expansionType}`);
        }
        const result = {
            originalQuery: query,
            expandedQuery,
            addedTerms,
            expansionType,
            technicalLevel: analysis.technicalLevel,
            domainContext: analysis.domainContext,
            processingTimeMs: Date.now() - startTime
        };
        // Cache the result
        if (config.enableCaching && addedTerms.length > 0) {
            const cacheKey = `full_expansion:${query}:${config.useSemanticExpansion}:${config.useKeywordExpansion}:${config.maxExpandedTerms}`;
            await (0, caching_1.cacheWithExpiry)(cacheKey, result, config.cacheTtlSeconds);
        }
        return result;
    }
    catch (error) {
        (0, errorHandling_1.logError)('expandQuery', error);
        const processingTime = Date.now() - startTime;
        // Return original query on error
        return {
            originalQuery: query,
            expandedQuery: query,
            addedTerms: [],
            expansionType: 'none',
            processingTimeMs: processingTime
        };
    }
}

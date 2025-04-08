"use strict";
/**
 * Query Analysis Module for Intelligent Query Routing
 *
 * This module analyzes incoming queries to determine:
 * 1. Which entities are being referenced
 * 2. What category the query falls into
 * 3. The query's information need type
 *
 * This information is used to optimize retrieval parameters and improve results.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeQuery = analyzeQuery;
exports.getRetrievalParameters = getRetrievalParameters;
const errorHandling_1 = require("./errorHandling");
const caching_1 = require("./caching");
const llmProviders_1 = require("./llmProviders");
// Cache timeout for query analysis (10 minutes)
const QUERY_ANALYSIS_CACHE_TIMEOUT = 10 * 60 * 1000;
/**
 * Analyzes a query to extract entities and determine query characteristics
 *
 * @param query The user query to analyze
 * @returns Analysis result with entities, categories, and query type
 */
async function analyzeQuery(query) {
    try {
        // Check cache first
        const cacheKey = `query_analysis_${query.trim().toLowerCase()}`;
        const cachedResult = (0, caching_1.getFromCache)(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }
        // Analyze with LLM if not cached
        const analysis = await analyzeLLM(query);
        // Attach the original query to the analysis object
        analysis.query = query;
        // Cache result
        (0, caching_1.cacheWithExpiry)(cacheKey, analysis, QUERY_ANALYSIS_CACHE_TIMEOUT);
        return analysis;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error analyzing query', { query, error });
        // Return a default analysis if LLM fails
        return {
            categories: ['GENERAL'],
            primaryCategory: 'GENERAL',
            entities: [],
            queryType: 'FACTUAL',
            technicalLevel: 5,
            estimatedResultCount: 10,
            isTimeDependent: false,
            query: query
        };
    }
}
/**
 * Uses LLM to analyze the query
 */
async function analyzeLLM(query) {
    var _a, _b;
    const prompt = `
    Analyze this query to help with retrieving the most relevant information:
    
    QUERY: "${query}"
    
    Respond with a JSON object that has these fields:
    - categories: Array of categories this query relates to (PRODUCT, TECHNICAL, FEATURES, PRICING, COMPARISON, CUSTOMER_CASE, GENERAL)
    - primaryCategory: The most relevant category
    - entities: Array of entities mentioned (with name, type, and confidence from 0-1)
    - queryType: One of FACTUAL, COMPARATIVE, PROCEDURAL, EXPLANATORY, DEFINITIONAL, EXPLORATORY
    - technicalLevel: Number from 1-10 indicating technical complexity
    - estimatedResultCount: Estimate of how many distinct pieces of information needed
    - isTimeDependent: Boolean indicating if the answer may change over time
  `;
    const response = await llmProviders_1.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
    });
    // Parse LLM response
    let result;
    try {
        const content = ((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "{}";
        result = JSON.parse(content);
    }
    catch (error) {
        throw new Error(`Failed to parse LLM response: ${error}`);
    }
    // Validate and normalize the output
    return {
        categories: normalizeCategories(result.categories),
        primaryCategory: normalizePrimaryCategory(result.primaryCategory),
        entities: result.entities || [],
        queryType: normalizeQueryType(result.queryType),
        technicalLevel: Math.min(Math.max(result.technicalLevel || 5, 1), 10),
        estimatedResultCount: Math.max(result.estimatedResultCount || 5, 1),
        isTimeDependent: Boolean(result.isTimeDependent),
        query: query // Add the original query
    };
}
/**
 * Utility function to ensure categories are valid
 */
function normalizeCategories(categories) {
    const validCategories = [];
    const allowedCategories = [
        'PRODUCT', 'TECHNICAL', 'FEATURES', 'PRICING',
        'COMPARISON', 'CUSTOMER_CASE', 'GENERAL'
    ];
    // Add valid categories
    categories === null || categories === void 0 ? void 0 : categories.forEach(category => {
        const normalized = category.toUpperCase();
        if (allowedCategories.includes(normalized)) {
            validCategories.push(normalized);
        }
    });
    // Always include at least GENERAL if nothing valid
    if (validCategories.length === 0) {
        validCategories.push('GENERAL');
    }
    return validCategories;
}
/**
 * Utility function to ensure primary category is valid
 */
function normalizePrimaryCategory(category) {
    const normalized = category === null || category === void 0 ? void 0 : category.toUpperCase();
    const allowedCategories = [
        'PRODUCT', 'TECHNICAL', 'FEATURES', 'PRICING',
        'COMPARISON', 'CUSTOMER_CASE', 'GENERAL'
    ];
    return allowedCategories.includes(normalized)
        ? normalized
        : 'GENERAL';
}
/**
 * Utility function to ensure query type is valid
 */
function normalizeQueryType(type) {
    const normalized = type === null || type === void 0 ? void 0 : type.toUpperCase();
    const allowedTypes = [
        'FACTUAL', 'COMPARATIVE', 'PROCEDURAL',
        'EXPLANATORY', 'DEFINITIONAL', 'EXPLORATORY'
    ];
    return allowedTypes.includes(normalized)
        ? normalized
        : 'FACTUAL';
}
/**
 * Determines the optimal retrieval parameters based on query analysis
 *
 * @param analysis The query analysis result
 * @returns Optimization parameters for retrieval
 */
function getRetrievalParameters(analysis) {
    // ---- Improved query analysis section ----
    // We need to determine the nature of the query more accurately
    const query = analysis.query || '';
    // 1. Pattern-based detection for different query types
    // Company identification terms
    const companyIdentifiers = /\b(our|we|us|workstream|company)\b/i;
    // Question and information-seeking patterns
    const questionPatterns = /\b(what|who|how|when|where|why|which|tell me about|explain|describe)\b/i;
    // Product/service terminology pattern
    const productTerms = /\b(product|service|feature|plan|pricing|tier|offering|platform|tool|solution)\b/i;
    // People & organization pattern
    const peopleTerms = /\b(team|employee|staff|founder|investor|partner|client|customer)\b/i;
    // 2. Classify the query
    const isCompanyQuery = companyIdentifiers.test(query);
    const isQuestionQuery = questionPatterns.test(query);
    const hasProductTerms = productTerms.test(query);
    const hasPeopleTerms = peopleTerms.test(query);
    // Calculate a "company-specificity" score from 0-1
    // This is more nuanced than a binary yes/no
    let companySpecificityScore = 0;
    if (isCompanyQuery)
        companySpecificityScore += 0.5;
    if (hasProductTerms)
        companySpecificityScore += 0.3;
    if (hasPeopleTerms)
        companySpecificityScore += 0.2;
    // Clamp between 0-1
    companySpecificityScore = Math.min(1, companySpecificityScore);
    console.log(`Query analysis: company=${isCompanyQuery}, question=${isQuestionQuery}, product=${hasProductTerms}, people=${hasPeopleTerms}`);
    console.log(`Company specificity score: ${companySpecificityScore.toFixed(2)}`);
    // 3. Adjust hybrid ratio based on company specificity
    // The more company-specific, the more we rely on keyword search (lower ratio)
    let hybridRatio = 0.5 - (companySpecificityScore * 0.3);
    // Further adjustment based on query type
    if (analysis.queryType === 'FACTUAL' || analysis.queryType === 'DEFINITIONAL') {
        // Factual queries benefit from more keyword matching
        hybridRatio -= 0.1;
    }
    else if (analysis.queryType === 'COMPARATIVE' || analysis.queryType === 'EXPLORATORY') {
        // Exploratory queries benefit from more vector similarity
        hybridRatio += 0.1;
    }
    // Ensure the ratio stays within valid bounds
    hybridRatio = Math.max(0.2, Math.min(0.8, hybridRatio));
    // Log decisions for debugging
    console.log(`Selected hybrid ratio: ${hybridRatio.toFixed(2)} (lower means more keyword influence)`);
    // 4. Determine category filtering strategy based on query
    // For company-specific queries, make sure to include GENERAL category 
    // as it often contains company information
    let categoryFilter = determineCategoryFilter(analysis);
    // If this is likely a company query and GENERAL isn't already included, add it
    if (companySpecificityScore > 0.3 &&
        !categoryFilter.categories.includes('GENERAL')) {
        categoryFilter.categories.push('GENERAL');
        console.log('Added GENERAL category to search because query appears company-specific');
    }
    // 5. Determine result limit - increase for company queries to ensure we get relevant results
    let resultLimit = estimateResultLimit(analysis);
    if (companySpecificityScore > 0.5) {
        // For strongly company-specific queries, ensure we get enough results
        resultLimit = Math.max(resultLimit, 10);
    }
    return {
        // Number of results to fetch
        limit: resultLimit,
        // Hybrid search parameters
        hybridRatio: hybridRatio,
        // Re-ranking parameters
        rerank: true,
        rerankCount: Math.min(50, analysis.estimatedResultCount * 5),
        // Category boosting - use our enhanced logic
        categoryFilter: categoryFilter,
        // Technical level matching
        technicalLevelRange: determineTechnicalLevelRange(analysis),
        // Whether to use query expansion
        // Enable for company queries to get related terms
        expandQuery: companySpecificityScore > 0.5 || shouldExpandQuery(analysis),
    };
}
/**
 * Estimates how many results to retrieve based on query characteristics
 */
function estimateResultLimit(analysis) {
    // Start with the estimated result count
    let baseLimit = analysis.estimatedResultCount;
    // Adjust based on query type
    switch (analysis.queryType) {
        case 'COMPARATIVE':
        case 'EXPLORATORY':
            baseLimit *= 2; // Need more diverse results
            break;
        case 'FACTUAL':
        case 'DEFINITIONAL':
            baseLimit = Math.max(baseLimit, 3); // Need fewer, more precise results
            break;
        default:
        // Keep the default for other types
    }
    // Ensure reasonable bounds
    return Math.min(Math.max(baseLimit, 3), 25);
}
/**
 * Determines whether to filter or boost by category
 */
function determineCategoryFilter(analysis) {
    // If we have a clear primary category, use it
    if (analysis.primaryCategory !== 'GENERAL') {
        return {
            categories: [analysis.primaryCategory],
            strict: false // Allow some flexibility
        };
    }
    // Otherwise include all identified categories
    return {
        categories: analysis.categories,
        strict: false
    };
}
/**
 * Determines the technical level range to match
 */
function determineTechnicalLevelRange(analysis) {
    // Default to match within +/- 3 of the query's technical level
    let min = Math.max(1, analysis.technicalLevel - 3);
    let max = Math.min(10, analysis.technicalLevel + 3);
    // Widen the range for exploratory queries
    if (analysis.queryType === 'EXPLORATORY') {
        min = 1;
        max = 10;
    }
    // Narrow the range for technical queries
    if (analysis.primaryCategory === 'TECHNICAL') {
        min = Math.max(min, analysis.technicalLevel - 1);
    }
    return { min, max };
}
/**
 * Determines whether to use query expansion
 */
function shouldExpandQuery(analysis) {
    // Don't expand if we have specific entities and the query is factual
    if (analysis.entities.length > 0 && analysis.queryType === 'FACTUAL') {
        return false;
    }
    // Expand for exploratory, comparative, or general queries
    return analysis.queryType === 'EXPLORATORY' ||
        analysis.queryType === 'COMPARATIVE' ||
        analysis.primaryCategory === 'GENERAL';
}

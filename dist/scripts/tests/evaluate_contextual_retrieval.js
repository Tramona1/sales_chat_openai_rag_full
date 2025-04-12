"use strict";
/**
 * Contextual Retrieval Evaluation Script
 *
 * This script evaluates the performance of contextual retrieval vs. traditional retrieval
 * by comparing metrics like:
 * - Retrieval precision and recall
 * - Answer quality and relevance
 * - Processing time and resource usage
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEvaluation = runEvaluation;
exports.runTest = runTest;
exports.generateSummaryStats = generateSummaryStats;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const path_2 = require("path");
const dotenv_1 = __importDefault(require("dotenv"));
// Utility for measuring elapsed time
const timer = () => {
    const start = process.hrtime.bigint();
    return () => {
        const end = process.hrtime.bigint();
        return Number(end - start) / 1e6; // Convert to milliseconds
    };
};
// Setup dirname equivalent for ESM
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = (0, path_2.dirname)(__filename);
// Load environment variables
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), '.env.local') });
// Import our test utilities - using relative paths for better compatibility
// Note: These paths assume the script is run from the project root
const hybridSearch_ts_1 = require("../../utils/hybridSearch.ts");
const answerGenerator_ts_1 = require("../../utils/answerGenerator.ts");
const queryAnalysis_ts_1 = require("../../utils/queryAnalysis.ts");
const embeddingClient_ts_1 = require("../../utils/embeddingClient.ts");
const modelConfig_ts_1 = require("../../utils/modelConfig.ts");
// ANSI color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};
// Test cases for evaluation
const testCases = [
    {
        id: 'simple_factual',
        query: 'What are the pricing tiers available?',
        expectedTopics: ['pricing', 'tiers', 'subscription'],
        description: 'Simple factual pricing query',
    },
    {
        id: 'complex_technical',
        query: 'How does the integration with Zapier work for automating onboarding tasks?',
        expectedTopics: ['integration', 'zapier', 'automation', 'onboarding'],
        description: 'Complex technical integration query',
    },
    {
        id: 'comparative_analysis',
        query: 'Compare your features with competing products for restaurant hiring',
        expectedTopics: ['comparison', 'competitors', 'restaurants', 'hiring', 'features'],
        description: 'Comparative analysis with industry focus',
    },
    {
        id: 'multi_part',
        query: 'What security features do you offer and how do they comply with GDPR?',
        expectedTopics: ['security', 'compliance', 'gdpr', 'data protection'],
        description: 'Multi-part question with compliance focus',
    },
    {
        id: 'implicit_context',
        query: 'How can I reduce the time it takes to process applications?',
        expectedTopics: ['application process', 'efficiency', 'optimization', 'workflow'],
        description: 'Question with implicit context requiring understanding',
    },
    {
        id: 'technical_depth',
        query: 'Explain the technical architecture of your API authentication system',
        expectedTopics: ['api', 'authentication', 'security', 'architecture', 'technical'],
        description: 'Query requiring technical depth and understanding',
    },
    {
        id: 'ambiguous_terms',
        query: 'How does your platform handle keys?',
        expectedTopics: ['keys', 'security', 'api', 'access management'],
        description: 'Query with ambiguous terms that could have multiple meanings',
    }
];
// Metrics to track
const metrics = {
    retrievalTime: {
        traditional: [],
        contextual: []
    },
    retrievalResultCount: {
        traditional: [],
        contextual: []
    },
    relevanceScores: {
        traditional: [],
        contextual: []
    },
    topicCoverage: {
        traditional: [],
        contextual: []
    },
    answerGenerationTime: {
        traditional: [],
        contextual: []
    },
    answerLength: {
        traditional: [],
        contextual: []
    },
    contextualMetricsAvailable: {
        traditional: [],
        contextual: []
    },
    precisionAt5: {
        traditional: [],
        contextual: []
    },
    sourceUniqueness: {
        traditional: [],
        contextual: []
    }
};
// Results storage
let testResults = [];
const resultOutputDir = path_1.default.join(process.cwd(), 'data', 'evaluation_results');
/**
 * Run a single test query with both traditional and contextual retrieval
 */
async function runTest(testCase) {
    console.log(`\n${colors.bright}${colors.blue}Running test: ${testCase.id}${colors.reset}`);
    console.log(`${colors.dim}Query: "${testCase.query}"${colors.reset}`);
    console.log(`${colors.dim}Expected topics: ${testCase.expectedTopics.join(', ')}${colors.reset}`);
    // Analyze the query first
    const analysisTimer = timer();
    const queryAnalysis = await (0, queryAnalysis_ts_1.analyzeQuery)(testCase.query);
    const analysisTime = analysisTimer();
    console.log(`\n${colors.cyan}Query analysis took ${analysisTime.toFixed(2)}ms${colors.reset}`);
    console.log(`Primary category: ${queryAnalysis.primaryCategory}`);
    console.log(`Query type: ${queryAnalysis.queryType}`);
    console.log(`Detected entities: ${queryAnalysis.entities.map(e => e.name).join(', ')}`);
    // 1. Run with traditional retrieval
    console.log(`\n${colors.yellow}Traditional Retrieval:${colors.reset}`);
    const traditionalResults = await runRetrieval(testCase.query, false);
    // 2. Run with contextual retrieval
    console.log(`\n${colors.green}Contextual Retrieval:${colors.reset}`);
    const contextualResults = await runRetrieval(testCase.query, true);
    // 3. Compare results
    console.log(`\n${colors.magenta}Comparison:${colors.reset}`);
    compareResults(traditionalResults, contextualResults, testCase);
    return {
        testCase,
        traditional: traditionalResults,
        contextual: contextualResults,
        queryAnalysis,
        analysisTime
    };
}
/**
 * Run retrieval for a query with specified mode
 */
async function runRetrieval(query, useContextual) {
    var _a, _b;
    // Time the retrieval process
    const retrievalTimer = timer();
    // Set up search options based on mode
    const searchOptions = {
        limit: 10,
        hybridRatio: 0.7,
        filter: {}
    };
    if (useContextual) {
        // For contextual search, prefer documents with context metadata
        // but still include others if needed
        searchOptions.limit = 20; // Get more initial results for reranking
        searchOptions.contextualReranking = true;
        searchOptions.enhancedFiltering = true;
    }
    // Perform search
    const searchResults = await (0, hybridSearch_ts_1.performHybridSearch)(query, useContextual ? searchOptions.limit : 10, // Retrieve more results for contextual to allow better reranking
    searchOptions.hybridRatio, searchOptions.filter, { useContextualReranking: useContextual });
    const retrievalTime = retrievalTimer();
    // Log retrieval metrics
    console.log(`Retrieved ${searchResults.length} results in ${retrievalTime.toFixed(2)}ms`);
    if (searchResults.length > 0) {
        console.log(`Top result score: ${searchResults[0].score.toFixed(4)}`);
        console.log(`Top result source: ${((_a = searchResults[0].item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'Unknown'}`);
        console.log(`Top result has contextual data: ${!!((_b = searchResults[0].item.metadata) === null || _b === void 0 ? void 0 : _b.context)}`);
    }
    // Store metrics
    const mode = useContextual ? 'contextual' : 'traditional';
    metrics.retrievalTime[mode].push(retrievalTime);
    metrics.retrievalResultCount[mode].push(searchResults.length);
    if (searchResults.length > 0) {
        // Average score of top 5 results
        const avgTopScore = searchResults.slice(0, 5).reduce((sum, result) => sum + result.score, 0) /
            Math.min(5, searchResults.length);
        metrics.relevanceScores[mode].push(avgTopScore);
        // Calculate topic coverage
        const topicCoverage = calculateTopicCoverage(searchResults, query);
        metrics.topicCoverage[mode].push(topicCoverage);
        // Count percentage of results with contextual metadata
        const contextualCount = searchResults.filter(r => { var _a; return !!((_a = r.item.metadata) === null || _a === void 0 ? void 0 : _a.context); }).length;
        metrics.contextualMetricsAvailable[mode].push(contextualCount / searchResults.length);
        // Calculate precision based on expected topics
        metrics.precisionAt5[mode].push(calculatePrecisionAtK(searchResults, 5));
        // Calculate source uniqueness (how many unique sources in top 10)
        const uniqueSources = new Set(searchResults.slice(0, 10)
            .map(r => { var _a; return ((_a = r.item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'unknown'; }));
        metrics.sourceUniqueness[mode].push(uniqueSources.size);
    }
    // Now generate an answer
    const formattedResults = searchResults.map(result => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        return ({
            text: result.item.text,
            source: ((_a = result.item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'Unknown',
            metadata: result.item.metadata,
            relevanceScore: result.score,
            // Include contextual information if available
            context: useContextual ? {
                description: ((_c = (_b = result.item.metadata) === null || _b === void 0 ? void 0 : _b.context) === null || _c === void 0 ? void 0 : _c.description) || '',
                keyPoints: ((_e = (_d = result.item.metadata) === null || _d === void 0 ? void 0 : _d.context) === null || _e === void 0 ? void 0 : _e.keyPoints) || [],
                isDefinition: ((_g = (_f = result.item.metadata) === null || _f === void 0 ? void 0 : _f.context) === null || _g === void 0 ? void 0 : _g.isDefinition) || false,
                containsExample: ((_j = (_h = result.item.metadata) === null || _h === void 0 ? void 0 : _h.context) === null || _j === void 0 ? void 0 : _j.containsExample) || false,
                documentContext: {
                    summary: ((_k = result.item.metadata) === null || _k === void 0 ? void 0 : _k.documentSummary) || '',
                    topics: ((_l = result.item.metadata) === null || _l === void 0 ? void 0 : _l.primaryTopics) || '',
                    documentType: ((_m = result.item.metadata) === null || _m === void 0 ? void 0 : _m.documentType) || '',
                    technicalLevel: (_o = result.item.metadata) === null || _o === void 0 ? void 0 : _o.technicalLevel
                }
            } : undefined
        });
    });
    // Generate answer
    const answerTimer = timer();
    const answer = await (0, answerGenerator_ts_1.generateAnswer)(query, formattedResults, {
        includeSourceCitations: true,
        maxSourcesInAnswer: 3,
        conversationHistory: '',
        useContextualInformation: useContextual
    });
    const answerTime = answerTimer();
    console.log(`Answer generated in ${answerTime.toFixed(2)}ms`);
    console.log(`Answer length: ${answer.length} characters`);
    console.log(`${colors.dim}Answer preview: ${answer.substring(0, 150)}...${colors.reset}`);
    // Store answer metrics
    metrics.answerGenerationTime[mode].push(answerTime);
    metrics.answerLength[mode].push(answer.length);
    return {
        query,
        results: searchResults,
        answer,
        metrics: {
            retrievalTime,
            resultCount: searchResults.length,
            answerTime,
            answerLength: answer.length,
            contextualMetadata: useContextual ? contextualCount / searchResults.length : 0,
            precisionAtK: calculatePrecisionAtK(searchResults, 5),
            uniqueSources: uniqueSources ? uniqueSources.size : 0
        }
    };
}
/**
 * Calculate precision at K for search results
 * Estimates how many of the top K results are relevant
 */
function calculatePrecisionAtK(results, k) {
    if (!results || results.length === 0)
        return 0;
    // For now, we're using the relevance score as a proxy for relevance
    // In a production environment, this would be manual judgments or click data
    const relevantResults = results.slice(0, k).filter(r => r.score > 0.7);
    return relevantResults.length / Math.min(k, results.length);
}
/**
 * Calculate topic coverage for search results
 */
function calculateTopicCoverage(results, query) {
    // Extract keywords from query
    const queryWords = query.toLowerCase()
        .replace(/[.,?!;:()"']/g, '')
        .split(' ')
        .filter(word => word.length > 3) // Only keep words longer than 3 chars
        .filter(word => !['what', 'when', 'where', 'which', 'that', 'with', 'your', 'does'].includes(word));
    if (queryWords.length === 0)
        return 0;
    // Check how many query words appear in the top results
    const topResults = results.slice(0, 5);
    let matchCount = 0;
    for (const word of queryWords) {
        const matchesInResults = topResults.filter(result => {
            var _a, _b;
            return result.item.text.toLowerCase().includes(word) ||
                (((_b = (_a = result.item.metadata) === null || _a === void 0 ? void 0 : _a.context) === null || _b === void 0 ? void 0 : _b.description) &&
                    result.item.metadata.context.description.toLowerCase().includes(word));
        }).length;
        if (matchesInResults > 0) {
            matchCount++;
        }
    }
    return matchCount / queryWords.length;
}
/**
 * Compare traditional and contextual results
 */
function compareResults(traditional, contextual, testCase) {
    // Calculate improvement percentages
    const retrievalTimeImprovement = ((traditional.metrics.retrievalTime - contextual.metrics.retrievalTime) /
        traditional.metrics.retrievalTime) * 100;
    const answerTimeImprovement = ((traditional.metrics.answerTime - contextual.metrics.answerTime) /
        traditional.metrics.answerTime) * 100;
    // Comparison table
    console.log('Metric                | Traditional    | Contextual      | Difference');
    console.log('---------------------|----------------|-----------------|------------');
    console.log(`Retrieval Time       | ${traditional.metrics.retrievalTime.toFixed(2)}ms        | ${contextual.metrics.retrievalTime.toFixed(2)}ms        | ${retrievalTimeImprovement.toFixed(1)}%`);
    console.log(`Result Count         | ${traditional.metrics.resultCount}            | ${contextual.metrics.resultCount}            | ${contextual.metrics.resultCount - traditional.metrics.resultCount}`);
    console.log(`Answer Time          | ${traditional.metrics.answerTime.toFixed(2)}ms        | ${contextual.metrics.answerTime.toFixed(2)}ms        | ${answerTimeImprovement.toFixed(1)}%`);
    console.log(`Answer Length        | ${traditional.metrics.answerLength}           | ${contextual.metrics.answerLength}           | ${((contextual.metrics.answerLength / traditional.metrics.answerLength) * 100 - 100).toFixed(1)}%`);
    console.log(`Contextual Metadata  | ${(traditional.metrics.contextualMetadata * 100).toFixed(1)}%         | ${(contextual.metrics.contextualMetadata * 100).toFixed(1)}%         | ${((contextual.metrics.contextualMetadata - traditional.metrics.contextualMetadata) * 100).toFixed(1)}%`);
    console.log(`Precision@5          | ${(traditional.metrics.precisionAtK * 100).toFixed(1)}%         | ${(contextual.metrics.precisionAtK * 100).toFixed(1)}%         | ${((contextual.metrics.precisionAtK - traditional.metrics.precisionAtK) * 100).toFixed(1)}%`);
    console.log(`Unique Sources       | ${traditional.metrics.uniqueSources || 'N/A'}            | ${contextual.metrics.uniqueSources || 'N/A'}            | ${(contextual.metrics.uniqueSources - traditional.metrics.uniqueSources) || 'N/A'}`);
}
/**
 * Generate summary statistics from collected metrics
 */
function generateSummaryStats() {
    // Helper to calculate averages
    const average = arr => arr.reduce((sum, val) => sum + val, 0) / arr.length;
    // 1. Calculate averages for each metric
    const summary = {
        retrievalTime: {
            traditional: average(metrics.retrievalTime.traditional),
            contextual: average(metrics.retrievalTime.contextual),
            improvement: ((average(metrics.retrievalTime.traditional) - average(metrics.retrievalTime.contextual)) /
                average(metrics.retrievalTime.traditional)) * 100
        },
        retrievalResultCount: {
            traditional: average(metrics.retrievalResultCount.traditional),
            contextual: average(metrics.retrievalResultCount.contextual),
            difference: average(metrics.retrievalResultCount.contextual) - average(metrics.retrievalResultCount.traditional)
        },
        relevanceScores: {
            traditional: average(metrics.relevanceScores.traditional),
            contextual: average(metrics.relevanceScores.contextual),
            improvement: ((average(metrics.relevanceScores.contextual) - average(metrics.relevanceScores.traditional)) /
                average(metrics.relevanceScores.traditional)) * 100
        },
        topicCoverage: {
            traditional: average(metrics.topicCoverage.traditional),
            contextual: average(metrics.topicCoverage.contextual),
            improvement: ((average(metrics.topicCoverage.contextual) - average(metrics.topicCoverage.traditional)) /
                average(metrics.topicCoverage.traditional)) * 100
        },
        answerGenerationTime: {
            traditional: average(metrics.answerGenerationTime.traditional),
            contextual: average(metrics.answerGenerationTime.contextual),
            improvement: ((average(metrics.answerGenerationTime.traditional) - average(metrics.answerGenerationTime.contextual)) /
                average(metrics.answerGenerationTime.traditional)) * 100
        },
        answerLength: {
            traditional: average(metrics.answerLength.traditional),
            contextual: average(metrics.answerLength.contextual),
            difference: ((average(metrics.answerLength.contextual) / average(metrics.answerLength.traditional)) * 100) - 100
        },
        contextualMetricsAvailable: {
            traditional: average(metrics.contextualMetricsAvailable.traditional) * 100,
            contextual: average(metrics.contextualMetricsAvailable.contextual) * 100,
            difference: (average(metrics.contextualMetricsAvailable.contextual) -
                average(metrics.contextualMetricsAvailable.traditional)) * 100
        },
        precisionAt5: {
            traditional: average(metrics.precisionAt5.traditional) * 100,
            contextual: average(metrics.precisionAt5.contextual) * 100,
            improvement: ((average(metrics.precisionAt5.contextual) - average(metrics.precisionAt5.traditional)) /
                Math.max(0.01, average(metrics.precisionAt5.traditional))) * 100
        },
        sourceUniqueness: {
            traditional: average(metrics.sourceUniqueness.traditional),
            contextual: average(metrics.sourceUniqueness.contextual),
            difference: average(metrics.sourceUniqueness.contextual) - average(metrics.sourceUniqueness.traditional)
        }
    };
    // 2. Log the summary in a table format
    console.log(`\n${colors.bright}${colors.blue}EVALUATION SUMMARY${colors.reset}\n`);
    console.log('Metric                   | Traditional     | Contextual      | Difference');
    console.log('-------------------------|----------------|-----------------|------------');
    console.log(`Retrieval Time           | ${summary.retrievalTime.traditional.toFixed(2)}ms        | ${summary.retrievalTime.contextual.toFixed(2)}ms        | ${summary.retrievalTime.improvement.toFixed(1)}%`);
    console.log(`Result Count             | ${summary.retrievalResultCount.traditional.toFixed(1)}            | ${summary.retrievalResultCount.contextual.toFixed(1)}            | ${summary.retrievalResultCount.difference.toFixed(1)}`);
    console.log(`Relevance Score          | ${summary.relevanceScores.traditional.toFixed(4)}        | ${summary.relevanceScores.contextual.toFixed(4)}        | ${summary.relevanceScores.improvement.toFixed(1)}%`);
    console.log(`Topic Coverage           | ${(summary.topicCoverage.traditional * 100).toFixed(1)}%         | ${(summary.topicCoverage.contextual * 100).toFixed(1)}%         | ${summary.topicCoverage.improvement.toFixed(1)}%`);
    console.log(`Answer Generation Time   | ${summary.answerGenerationTime.traditional.toFixed(2)}ms        | ${summary.answerGenerationTime.contextual.toFixed(2)}ms        | ${summary.answerGenerationTime.improvement.toFixed(1)}%`);
    console.log(`Answer Length            | ${summary.answerLength.traditional.toFixed(0)} chars     | ${summary.answerLength.contextual.toFixed(0)} chars     | ${summary.answerLength.difference.toFixed(1)}%`);
    console.log(`Contextual Metadata      | ${summary.contextualMetricsAvailable.traditional.toFixed(1)}%         | ${summary.contextualMetricsAvailable.contextual.toFixed(1)}%         | ${summary.contextualMetricsAvailable.difference.toFixed(1)}%`);
    console.log(`Precision@5              | ${summary.precisionAt5.traditional.toFixed(1)}%         | ${summary.precisionAt5.contextual.toFixed(1)}%         | ${summary.precisionAt5.improvement.toFixed(1)}%`);
    console.log(`Source Uniqueness        | ${summary.sourceUniqueness.traditional.toFixed(1)}            | ${summary.sourceUniqueness.contextual.toFixed(1)}            | ${summary.sourceUniqueness.difference.toFixed(1)}`);
    return summary;
}
/**
 * Save evaluation results to file
 */
function saveResults(summary, allResults) {
    // Create the output directory if it doesn't exist
    if (!fs_1.default.existsSync(resultOutputDir)) {
        fs_1.default.mkdirSync(resultOutputDir, { recursive: true });
    }
    // Generate timestamp for filenames
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    // Save the summary
    const summaryFile = path_1.default.join(resultOutputDir, `summary_${timestamp}.json`);
    fs_1.default.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    // Save detailed results (limited to avoid excessive file size)
    const detailedResultsFile = path_1.default.join(resultOutputDir, `details_${timestamp}.json`);
    // Simplify the results to reduce file size
    const simplifiedResults = allResults.map(result => ({
        id: result.testCase.id,
        query: result.testCase.query,
        traditional: {
            retrievalTime: result.traditional.metrics.retrievalTime,
            resultCount: result.traditional.metrics.resultCount,
            topResults: result.traditional.results.slice(0, 3).map(r => {
                var _a, _b;
                return ({
                    text: r.item.text.substring(0, 200),
                    score: r.score,
                    source: (_a = r.item.metadata) === null || _a === void 0 ? void 0 : _a.source,
                    hasContext: !!((_b = r.item.metadata) === null || _b === void 0 ? void 0 : _b.context)
                });
            }),
            answerPreview: result.traditional.answer.substring(0, 300)
        },
        contextual: {
            retrievalTime: result.contextual.metrics.retrievalTime,
            resultCount: result.contextual.metrics.resultCount,
            topResults: result.contextual.results.slice(0, 3).map(r => {
                var _a, _b;
                return ({
                    text: r.item.text.substring(0, 200),
                    score: r.score,
                    source: (_a = r.item.metadata) === null || _a === void 0 ? void 0 : _a.source,
                    hasContext: !!((_b = r.item.metadata) === null || _b === void 0 ? void 0 : _b.context)
                });
            }),
            answerPreview: result.contextual.answer.substring(0, 300)
        }
    }));
    fs_1.default.writeFileSync(detailedResultsFile, JSON.stringify(simplifiedResults, null, 2));
    console.log(`\n${colors.bright}Results saved to:${colors.reset}`);
    console.log(`- Summary: ${summaryFile}`);
    console.log(`- Details: ${detailedResultsFile}`);
}
/**
 * Run the full evaluation
 */
async function runEvaluation() {
    console.log(`${colors.bright}${colors.green}CONTEXTUAL RETRIEVAL EVALUATION${colors.reset}\n`);
    // Check environment and configurations
    console.log(`${colors.cyan}Checking configuration...${colors.reset}`);
    // Check embedding client
    const embeddingClient = (0, embeddingClient_ts_1.getEmbeddingClient)();
    console.log(`Using embedding client: ${embeddingClient.getProvider()}`);
    console.log(`Embedding dimensions: ${embeddingClient.getDimensions()}`);
    // Check model configuration
    const contextModel = (0, modelConfig_ts_1.getModelForTask)(undefined, 'context');
    console.log(`Using context generation model: ${contextModel.provider}/${contextModel.model}`);
    // Log basic information
    console.log(`\n${colors.cyan}Starting evaluation with ${testCases.length} test cases${colors.reset}`);
    // Run all test cases
    testResults = [];
    for (const testCase of testCases) {
        const result = await runTest(testCase);
        testResults.push(result);
    }
    // Generate and display summary statistics
    const summary = generateSummaryStats();
    // Save results
    saveResults(summary, testResults);
    console.log(`\n${colors.bright}${colors.green}Evaluation completed successfully!${colors.reset}`);
}
// Run the evaluation when executed directly
if (process.argv[1] === (0, url_1.fileURLToPath)(import.meta.url)) {
    runEvaluation().catch(error => {
        console.error(`${colors.red}Error running evaluation:${colors.reset}`, error);
        process.exit(1);
    });
}

"use strict";
/**
 * Script to run baseline evaluations on the current RAG system
 * This establishes initial performance metrics to track improvements against
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const test_queries_1 = require("../utils/test_queries");
const evaluation_1 = require("../utils/evaluation");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const vectorStore_1 = require("../utils/vectorStore");
const openaiClient_1 = require("../utils/openaiClient");
/**
 * Actual system retrieval function that connects to the vector store
 */
async function retrievalFunction(query) {
    try {
        console.log(`Retrieving context for query: ${query}`);
        // Generate embedding for the query
        const startTime = performance.now();
        const queryEmbedding = await (0, openaiClient_1.embedText)(query);
        // Determine if this is a specific type of query
        const queryLower = query.toLowerCase();
        let priorityInfoType;
        if (queryLower.includes('price') || queryLower.includes('cost') || queryLower.includes('plan')) {
            priorityInfoType = 'pricing';
        }
        else if (queryLower.includes('feature') || queryLower.includes('capability')) {
            priorityInfoType = 'product_features';
        }
        else if (queryLower.includes('competitor') || queryLower.includes('compare')) {
            priorityInfoType = 'sales_info';
        }
        // Get similar items from vector store
        const retrievedItems = (0, vectorStore_1.getSimilarItems)(queryEmbedding, 10, // Retrieve 10 items
        query, // Pass query text for hybrid search if implemented
        priorityInfoType);
        const endTime = performance.now();
        console.log(`Retrieved ${retrievedItems.length} items in ${(endTime - startTime).toFixed(2)}ms`);
        return retrievedItems;
    }
    catch (error) {
        console.error('Error in retrieval function:', error);
        return [];
    }
}
/**
 * Actual system answer generation function that uses retrieved context
 */
async function answerGenerationFunction(query, retrievedContext) {
    try {
        console.log(`Generating answer for query: ${query}`);
        // Format the context for the LLM
        const contextText = retrievedContext
            .map((item, index) => `[${index + 1}] ${item.text.trim()}`)
            .join('\n\n');
        // Create appropriate system and user prompts
        const systemPrompt = `You are an AI assistant helping the sales team with accurate information about the company's products and services.
Answer the user's question based ONLY on the context provided below. If the answer is not in the context, say "I don't have enough information to answer that question."
Do not make up or infer any information that is not explicitly stated in the context.
Be concise and precise in your responses.`;
        const userPrompt = `Question: ${query}

Context:
${contextText}

Answer:`;
        // Generate the answer using the LLM
        const answer = await (0, openaiClient_1.generateChatCompletion)(systemPrompt, userPrompt, 'gpt-4');
        return answer;
    }
    catch (error) {
        console.error('Error generating answer:', error);
        return 'Error: Unable to generate an answer due to a technical issue.';
    }
}
/**
 * Main function to run the baseline evaluation
 */
async function runBaselineEvaluation() {
    console.log('Starting baseline evaluation with actual system implementation...');
    // Run evaluation for all queries
    console.log(`Evaluating ${test_queries_1.TEST_QUERIES.length} test queries...`);
    const fullResults = await (0, evaluation_1.runFullEvaluation)(test_queries_1.TEST_QUERIES, retrievalFunction, answerGenerationFunction);
    // Create results directory if it doesn't exist
    const resultsDir = path_1.default.join(process.cwd(), 'evaluation_results');
    if (!fs_1.default.existsSync(resultsDir)) {
        fs_1.default.mkdirSync(resultsDir, { recursive: true });
    }
    // Save results to file
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const resultsFile = path_1.default.join(resultsDir, `baseline_evaluation_${timestamp}.json`);
    fs_1.default.writeFileSync(resultsFile, JSON.stringify(fullResults, null, 2));
    console.log('Baseline evaluation complete!');
    console.log(`Results saved to: ${resultsFile}`);
    console.log('\nSummary:');
    console.log(`- Average Precision: ${fullResults.retrievalMetrics.averagePrecision.toFixed(2)}`);
    console.log(`- Average Recall: ${fullResults.retrievalMetrics.averageRecall.toFixed(2)}`);
    console.log(`- Average Latency: ${fullResults.retrievalMetrics.averageLatency.toFixed(2)}ms`);
    console.log(`- Answer Relevance: ${fullResults.answerQualityMetrics.averageRelevance.toFixed(2)}/10`);
    console.log(`- Answer Completeness: ${fullResults.answerQualityMetrics.averageCompleteness.toFixed(2)}/10`);
    console.log(`- Answer Accuracy: ${fullResults.answerQualityMetrics.averageAccuracy.toFixed(2)}/10`);
    console.log(`- Overall Answer Quality: ${fullResults.answerQualityMetrics.averageOverall.toFixed(2)}/10`);
    console.log(`- Model Agreement: ${fullResults.answerQualityMetrics.modelAgreement.toFixed(2)}/10`);
}
// Run the evaluation
runBaselineEvaluation().catch(error => {
    console.error('Error running baseline evaluation:', error);
    process.exit(1);
});

/**
 * Contextual Retrieval Evaluation Script
 *
 * This script evaluates the performance of contextual retrieval vs. traditional retrieval
 * by comparing metrics like:
 * - Retrieval precision and recall
 * - Answer quality and relevance
 * - Processing time and resource usage
 */
/**
 * Run a single test query with both traditional and contextual retrieval
 */
declare function runTest(testCase: any): Promise<{
    testCase: any;
    traditional: {
        query: any;
        results: import("../../utils/hybridSearch.ts").SearchResult[];
        answer: string;
        metrics: {
            retrievalTime: number;
            resultCount: number;
            answerTime: number;
            answerLength: number;
            contextualMetadata: number;
            precisionAtK: number;
            uniqueSources: any;
        };
    };
    contextual: {
        query: any;
        results: import("../../utils/hybridSearch.ts").SearchResult[];
        answer: string;
        metrics: {
            retrievalTime: number;
            resultCount: number;
            answerTime: number;
            answerLength: number;
            contextualMetadata: number;
            precisionAtK: number;
            uniqueSources: any;
        };
    };
    queryAnalysis: import("../../utils/queryAnalysis.ts").LocalQueryAnalysis;
    analysisTime: number;
}>;
/**
 * Generate summary statistics from collected metrics
 */
declare function generateSummaryStats(): {
    retrievalTime: {
        traditional: number;
        contextual: number;
        improvement: number;
    };
    retrievalResultCount: {
        traditional: number;
        contextual: number;
        difference: number;
    };
    relevanceScores: {
        traditional: number;
        contextual: number;
        improvement: number;
    };
    topicCoverage: {
        traditional: number;
        contextual: number;
        improvement: number;
    };
    answerGenerationTime: {
        traditional: number;
        contextual: number;
        improvement: number;
    };
    answerLength: {
        traditional: number;
        contextual: number;
        difference: number;
    };
    contextualMetricsAvailable: {
        traditional: number;
        contextual: number;
        difference: number;
    };
    precisionAt5: {
        traditional: number;
        contextual: number;
        improvement: number;
    };
    sourceUniqueness: {
        traditional: number;
        contextual: number;
        difference: number;
    };
};
/**
 * Run the full evaluation
 */
declare function runEvaluation(): Promise<void>;
export { runEvaluation, runTest, generateSummaryStats };

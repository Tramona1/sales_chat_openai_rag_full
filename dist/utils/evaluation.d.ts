/**
 * Evaluation framework for the RAG system
 * Implements metrics to measure improvement of enhancements
 */
export interface TestCase {
    query: string;
    expectedKeywords: string[];
    expectedChunkIds?: string[];
    expectedSourceDocs?: string[];
    category: 'pricing' | 'features' | 'competitors' | 'technical' | 'general';
    complexity: 1 | 2 | 3;
    expectedAnswer?: string;
}
/**
 * Evaluates retrieval performance by comparing retrieved chunks with expected content
 */
export declare function evaluateRetrieval(testCases: TestCase[], retrievalFunction: (query: string) => Promise<any[]>): Promise<{
    averagePrecision: number;
    averageRecall: number;
    averageLatency: number;
    resultsByCategory: Record<string, any>;
}>;
/**
 * LLM-based evaluation of answer quality using both GPT-4 and Gemini Flash
 */
export declare function evaluateAnswerQuality(testCase: TestCase, generatedAnswer: string): Promise<{
    gpt4Scores: {
        relevanceScore: number;
        completenessScore: number;
        accuracyScore: number;
        overallScore: number;
    };
    geminiFlashScores: {
        relevanceScore: number;
        completenessScore: number;
        accuracyScore: number;
        overallScore: number;
    };
    agreementScore: number;
}>;
/**
 * Run a full evaluation of the RAG system
 */
export declare function runFullEvaluation(testCases: TestCase[], retrievalFunction: (query: string) => Promise<any[]>, answerGenerationFunction: (query: string, retrievedContext: any[]) => Promise<string>): Promise<{
    retrievalMetrics: {
        averagePrecision: number;
        averageRecall: number;
        averageLatency: number;
        resultsByCategory: Record<string, any>;
    };
    answerQualityMetrics: {
        averageRelevance: number;
        averageCompleteness: number;
        averageAccuracy: number;
        averageOverall: number;
        modelAgreement: number;
    };
}>;
/**
 * Visualize evaluation results
 */
export declare function visualizeResults(results: any): string;

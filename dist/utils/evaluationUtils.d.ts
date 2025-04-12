/**
 * Evaluation Utilities for RAG System
 *
 * This module provides utilities for evaluating and comparing
 * different retrieval approaches.
 */
export interface EvaluationQuery {
    id: string;
    query: string;
    expectedTopics?: string[];
    category?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    tags?: string[];
}
export interface RetrievalResult {
    chunks: Array<{
        text: string;
        source: string;
        score: number;
        metadata: any;
    }>;
    elapsedTimeMs: number;
}
export interface ComparisonResult {
    id: string;
    query: EvaluationQuery;
    timestamp: string;
    traditional: {
        retrievalResults: RetrievalResult;
        answer: string;
        metrics: {
            precisionAt3: number;
            precisionAt5: number;
            recallAt5: number;
            mrr: number;
            answerScore: number;
        };
    };
    contextual: {
        retrievalResults: RetrievalResult;
        answer: string;
        metrics: {
            precisionAt3: number;
            precisionAt5: number;
            recallAt5: number;
            mrr: number;
            answerScore: number;
        };
    };
    winner: 'traditional' | 'contextual' | 'tie';
    evaluationNotes: string;
}
/**
 * Create and save a set of evaluation queries
 */
export declare function saveEvaluationQueries(queries: EvaluationQuery[]): void;
/**
 * Load evaluation queries from file
 */
export declare function loadEvaluationQueries(): EvaluationQuery[];
/**
 * Add a single evaluation query
 */
export declare function addEvaluationQuery(query: EvaluationQuery): void;
/**
 * Create a standard set of evaluation queries
 */
export declare function createStandardEvaluationSet(): EvaluationQuery[];
/**
 * Compare traditional and contextual retrieval approaches
 */
export declare function compareRetrievalApproaches(queryOrId: string | EvaluationQuery, saveResults?: boolean): Promise<ComparisonResult>;
/**
 * Run evaluation on all standard queries
 */
export declare function runStandardEvaluation(): Promise<ComparisonResult[]>;

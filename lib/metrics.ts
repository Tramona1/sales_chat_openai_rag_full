/**
 * Metrics collection and tracking utilities for the Sales Chat RAG system
 * 
 * This module provides functions for recording and analyzing system performance metrics,
 * including timing information, success rates, and other relevant data points.
 */

// Define metric names for consistency across the application
export const metrics = {
  // Query processing metrics
  QUERY_ANALYSIS: 'query.analysis',
  QUERY_REWRITE: 'query.rewrite',
  HYBRID_SEARCH: 'search.hybrid',
  VECTOR_SEARCH: 'search.vector',
  KEYWORD_SEARCH: 'search.keyword',
  MULTIMODAL_SEARCH: 'search.multimodal',
  RERANKING: 'search.reranking',
  CONTEXT_CREATION: 'context.creation',
  ANSWER_GENERATION: 'answer.generation',
  
  // API endpoints
  API_QUERY: 'api.query',
  API_CHAT: 'api.chat',
  API_DOCUMENT_UPLOAD: 'api.document.upload',
  
  // Database operations
  DB_DOCUMENT_INSERT: 'db.document.insert',
  DB_DOCUMENT_UPDATE: 'db.document.update',
  DB_CHUNK_INSERT: 'db.chunk.insert',
  DB_VECTOR_SEARCH: 'db.vector.search',
  
  // External services
  OPENAI_EMBEDDING: 'openai.embedding',
  OPENAI_COMPLETION: 'openai.completion',
  GEMINI_EMBEDDING: 'gemini.embedding',
  GEMINI_COMPLETION: 'gemini.completion',
  PERPLEXITY_QUERY: 'perplexity.query'
};

/**
 * Record a performance metric
 * 
 * @param category The metric category (e.g., 'search', 'api', 'db')
 * @param name The specific metric name 
 * @param duration The duration in milliseconds
 * @param success Whether the operation was successful
 * @param metadata Additional metadata about the operation
 */
export function recordMetric(
  category: string, 
  name: string, 
  duration: number, 
  success: boolean, 
  metadata: any = {}
): void {
  // Simple console.log only implementation - no filesystem access
  // This avoids any filesystem-related errors in serverless environments
  console.log(`[METRIC] ${category}.${name}: ${duration}ms, success: ${success}`, metadata);
  
  // In a production environment, we would send metrics to an external service
  // For now, we just log to the console and do nothing else
}

/**
 * Create a timer that can be used to measure the duration of an operation
 * 
 * @returns A function that, when called, returns the elapsed time in milliseconds
 */
export function createTimer(): () => number {
  const startTime = process.hrtime();
  return () => {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    return seconds * 1000 + nanoseconds / 1000000;
  };
}

/**
 * Get current system metrics (mock implementation)
 * 
 * @returns Summary statistics of recent system performance
 */
export function getSystemMetrics() {
  return {
    averageQueryTime: 450, // ms
    apiSuccessRate: 0.98,  // 98%
    searchLatency: 380,    // ms
    totalQueriesProcessed: 15243,
    errorsLastHour: 12
  };
} 
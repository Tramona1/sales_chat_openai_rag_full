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
  // Always log the metric for development purposes
  console.log(`[METRIC] ${category}.${name}: ${duration}ms, success: ${success}`, metadata);
  
  // Skip all filesystem operations in any production/Vercel/cloud environment
  // This is a safety check to prevent errors in serverless environments
  if (
    process.env.VERCEL || 
    process.env.VERCEL_URL || 
    process.env.NODE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME // AWS Lambda detection
  ) {
    return; // Exit early without attempting any filesystem operations
  }
  
  // The rest of this function only runs in local development
  // Record the metric in local filesystem for development analysis
  try {
    // Check if we're in a browser environment (metrics should only be recorded server-side)
    if (typeof window !== 'undefined') {
      return;
    }
    
    // Safe dynamic imports to prevent bundling issues
    const importFs = () => {
      try {
        return require('fs');
      } catch (e) {
        console.error('[METRICS] Unable to import fs module', e);
        return null;
      }
    };
    
    const importPath = () => {
      try {
        return require('path');
      } catch (e) {
        console.error('[METRICS] Unable to import path module', e);
        return null;
      }
    };
    
    const fs = importFs();
    const path = importPath();
    
    if (!fs || !path) {
      return; // Exit if we couldn't import required modules
    }
    
    // Just log to console in development
    // This is where we would persist metrics to a database in production
  } catch (error) {
    console.error('[ERROR] Failed to process metric:', error);
  }
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
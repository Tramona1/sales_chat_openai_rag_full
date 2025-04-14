/**
 * Feature flag configuration for the Sales Chat RAG system
 * 
 * This module provides centralized feature flag management for controlling
 * feature availability throughout the application.
 */

/**
 * Feature flags for the application
 * These can be modified to enable/disable specific features
 */
export const FEATURE_FLAGS = {
  // Search and retrieval features
  contextualReranking: true,    // Use contextual information for reranking results
  contextualEmbeddings: true,   // Use contextual embeddings for search
  multiModalSearch: true,       // Enable multi-modal search (text + images)
  
  // Query analysis features
  queryRewriting: true,         // Enable query rewriting for better context
  entityRecognition: true,      // Extract entities from queries
  
  // Answer generation features
  sourceCitations: true,        // Include source citations in responses
  followUpQuestions: false,     // Generate follow-up question suggestions
  
  // System features
  metricCollection: true,       // Collect system performance metrics
  debugLogging: false,          // Enable detailed debug logging
  
  // Experimental features
  experimentalRanking: false,   // Use experimental ranking algorithm
  aiGeneratedSummaries: false,  // Use AI to generate document summaries
} 
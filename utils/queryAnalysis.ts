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

import { logError } from './errorHandling';
import { cacheWithExpiry, getFromCache } from './caching';
import { openai } from './llmProviders';
import { DocumentCategory } from '../types/metadata';

// Cache timeout for query analysis (10 minutes)
const QUERY_ANALYSIS_CACHE_TIMEOUT = 10 * 60 * 1000;

// Types of information needs
export type QueryType = 
  | 'FACTUAL' 
  | 'COMPARATIVE'
  | 'PROCEDURAL'
  | 'EXPLANATORY'
  | 'DEFINITIONAL'
  | 'EXPLORATORY';

// Entity references in queries
export interface QueryEntity {
  name: string;
  type: string;
  confidence: number;
}

// Complete query analysis result
export interface QueryAnalysis {
  categories: DocumentCategory[];
  primaryCategory: DocumentCategory;
  entities: QueryEntity[];
  queryType: QueryType;
  technicalLevel: number; // 1-10 scale
  estimatedResultCount: number;
  isTimeDependent: boolean;
}

// Result from the LLM for query analysis
interface LLMQueryAnalysisResult {
  categories: string[];
  primaryCategory: string;
  entities: {
    name: string;
    type: string;
    confidence: number;
  }[];
  queryType: string;
  technicalLevel: number;
  estimatedResultCount: number;
  isTimeDependent: boolean;
}

/**
 * Analyzes a query to extract entities and determine query characteristics
 * 
 * @param query The user query to analyze
 * @returns Analysis result with entities, categories, and query type
 */
export async function analyzeQuery(query: string): Promise<QueryAnalysis> {
  try {
    // Check cache first
    const cacheKey = `query_analysis_${query.trim().toLowerCase()}`;
    const cachedResult = getFromCache<QueryAnalysis>(cacheKey);
    
    if (cachedResult) {
      return cachedResult;
    }
    
    // Analyze with LLM if not cached
    const analysis = await analyzeLLM(query);
    
    // Cache result
    cacheWithExpiry(cacheKey, analysis, QUERY_ANALYSIS_CACHE_TIMEOUT);
    
    return analysis;
  } catch (error) {
    logError('Error analyzing query', { query, error });
    
    // Return a default analysis if LLM fails
    return {
      categories: ['GENERAL'],
      primaryCategory: 'GENERAL',
      entities: [],
      queryType: 'FACTUAL',
      technicalLevel: 5,
      estimatedResultCount: 10,
      isTimeDependent: false
    };
  }
}

/**
 * Uses LLM to analyze the query
 */
async function analyzeLLM(query: string): Promise<QueryAnalysis> {
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
  
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });
  
  // Parse LLM response
  let result: LLMQueryAnalysisResult;
  try {
    const content = response.choices[0]?.message?.content || "{}";
    result = JSON.parse(content);
  } catch (error) {
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
    isTimeDependent: Boolean(result.isTimeDependent)
  };
}

/**
 * Utility function to ensure categories are valid
 */
function normalizeCategories(categories: string[]): DocumentCategory[] {
  const validCategories: DocumentCategory[] = [];
  const allowedCategories = [
    'PRODUCT', 'TECHNICAL', 'FEATURES', 'PRICING', 
    'COMPARISON', 'CUSTOMER_CASE', 'GENERAL'
  ];
  
  // Add valid categories
  categories?.forEach(category => {
    const normalized = category.toUpperCase();
    if (allowedCategories.includes(normalized)) {
      validCategories.push(normalized as DocumentCategory);
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
function normalizePrimaryCategory(category: string): DocumentCategory {
  const normalized = category?.toUpperCase();
  const allowedCategories = [
    'PRODUCT', 'TECHNICAL', 'FEATURES', 'PRICING', 
    'COMPARISON', 'CUSTOMER_CASE', 'GENERAL'
  ];
  
  return allowedCategories.includes(normalized) 
    ? normalized as DocumentCategory 
    : 'GENERAL';
}

/**
 * Utility function to ensure query type is valid
 */
function normalizeQueryType(type: string): QueryType {
  const normalized = type?.toUpperCase();
  const allowedTypes = [
    'FACTUAL', 'COMPARATIVE', 'PROCEDURAL', 
    'EXPLANATORY', 'DEFINITIONAL', 'EXPLORATORY'
  ];
  
  return allowedTypes.includes(normalized) 
    ? normalized as QueryType 
    : 'FACTUAL';
}

/**
 * Determines the optimal retrieval parameters based on query analysis
 * 
 * @param analysis The query analysis result
 * @returns Optimization parameters for retrieval
 */
export function getRetrievalParameters(analysis: QueryAnalysis) {
  return {
    // Number of results to fetch
    limit: estimateResultLimit(analysis),
    
    // Hybrid search parameters
    hybridRatio: determineHybridRatio(analysis),
    
    // Re-ranking parameters
    rerank: true,
    rerankCount: Math.min(50, analysis.estimatedResultCount * 5),
    
    // Category boosting
    categoryFilter: determineCategoryFilter(analysis),
    
    // Technical level matching
    technicalLevelRange: determineTechnicalLevelRange(analysis),
    
    // Whether to use query expansion
    expandQuery: shouldExpandQuery(analysis),
  };
}

/**
 * Estimates how many results to retrieve based on query characteristics
 */
function estimateResultLimit(analysis: QueryAnalysis): number {
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
 * Determines the hybrid search ratio (vector vs BM25) based on query type
 */
function determineHybridRatio(analysis: QueryAnalysis): number {
  // Default is balanced (0.5)
  let ratio = 0.5;
  
  // Adjust based on query type and entities
  if (analysis.queryType === 'FACTUAL' && analysis.entities.length > 0) {
    // More keyword-based for factual queries with specific entities
    ratio = 0.3;
  } else if (analysis.queryType === 'EXPLORATORY') {
    // More semantic for exploratory queries
    ratio = 0.7;
  } else if (analysis.queryType === 'COMPARATIVE') {
    // More balanced for comparative queries
    ratio = 0.5;
  } else if (analysis.technicalLevel >= 8) {
    // More keyword-based for highly technical queries
    ratio = 0.4;
  }
  
  return ratio;
}

/**
 * Determines whether to filter or boost by category
 */
function determineCategoryFilter(analysis: QueryAnalysis): {
  categories: DocumentCategory[],
  strict: boolean
} {
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
function determineTechnicalLevelRange(analysis: QueryAnalysis): {
  min: number,
  max: number
} {
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
function shouldExpandQuery(analysis: QueryAnalysis): boolean {
  // Don't expand if we have specific entities and the query is factual
  if (analysis.entities.length > 0 && analysis.queryType === 'FACTUAL') {
    return false;
  }
  
  // Expand for exploratory, comparative, or general queries
  return analysis.queryType === 'EXPLORATORY' ||
         analysis.queryType === 'COMPARATIVE' ||
         analysis.primaryCategory === 'GENERAL';
} 
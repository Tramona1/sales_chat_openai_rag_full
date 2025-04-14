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

import { logError, logInfo, logWarning, logDebug } from './logger';
import { cacheWithExpiry, getFromCache } from './caching';
import { openai } from './llmProviders';
import { recordMetric } from './performanceMonitoring';
// TEMPORARY FIX: Hardcode feature flags instead of importing
// import { isFeatureEnabled, FeatureFlag } from './featureFlags';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { QueryAnalysis, QueryIntent, RetrievalParameters, Entity } from '../types/queryAnalysis';
import { DocumentCategoryType } from './documentCategories';

// TEMPORARY FIX: Hardcode feature flags
const ENHANCED_QUERY_ANALYSIS_ENABLED = true;

// Cache timeout for query analysis (10 minutes)
const QUERY_ANALYSIS_CACHE_TIMEOUT = 10 * 60 * 1000;
const QUERY_ANALYSIS_CACHE_KEY_PREFIX = 'queryAnalysis:';

// Entity references in queries
export interface QueryEntity {
  name: string;
  type: string;
  confidence: number;
}

// Complete query analysis result
export interface LocalQueryAnalysis {
  originalQuery: string;
  intent: QueryIntent;
  topics: string[];
  entities: Entity[];
  technicalLevel: number;
  primaryCategory: string;
  secondaryCategories?: string[];
  keywords?: string[];
  queryType?: string;
  expandedQuery?: string;
  isAmbiguous?: boolean;
  
  // Legacy properties
  categories?: DocumentCategoryType[];
  estimatedResultCount?: number;
  isTimeDependent?: boolean;
  query?: string;
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
 * Result of query context analysis for retrieval optimization
 */
export interface QueryContextAnalysis {
  /** Key search terms extracted from the query */
  searchTerms: string[];
  
  /** Likely topic categories for the query */
  topicCategories: string[];
  
  /** Technical complexity level (0-3) */
  technicalLevel: number;
  
  /** Type of answer expected for this query */
  expectedAnswerType: 'factual' | 'conceptual' | 'procedural' | 'comparative';
  
  /** Specific entities the query is focused on */
  entityFocus: string[];
  
  /** Whether the query is about visual content */
  visualFocus: boolean;
  
  /** Types of visual content the query might be asking about */
  visualTypes?: string[];
}

/**
 * Robustly extract a JSON object from text that may contain markdown, code blocks, or other formatting
 */
function extractJsonFromText(text: string): any {
  // Try direct parsing first
  try {
    return JSON.parse(text);
  } catch (e) {
    // Check for JSON in code blocks (```json {...} ```)
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (innerError) {
        // Continue to other approaches
      }
    }
    
    // Try to extract any JSON object with balanced braces
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        // If still failing, try cleaning the text
        try {
          const cleanedText = jsonMatch[0]
            .replace(/(\w+):/g, '"$1":') // Convert unquoted keys to quoted keys
            .replace(/'/g, '"');         // Replace single quotes with double quotes
          return JSON.parse(cleanedText);
        } catch (finalError) {
          // All approaches failed
        }
      }
    }
    
    throw new Error('Failed to extract valid JSON from text: ' + text.substring(0, 100) + '...');
  }
}

/**
 * Map a category string to a valid DocumentCategoryType enum value
 * 
 * This function takes a category string (which might come from LLM analysis)
 * and attempts to map it to a valid DocumentCategoryType enum value.
 * It uses multiple strategies:
 * 1. Direct mapping via a predefined dictionary of common categories
 * 2. Exact matching against DocumentCategoryType values
 * 3. Partial string matching in both directions
 * 
 * If no valid mapping is found, it returns null, and the caller should use
 * a default category like GENERAL.
 * 
 * @param category The category string to map
 * @returns A valid DocumentCategoryType or null if no mapping found
 */
function mapToDocumentCategory(category?: string): DocumentCategoryType | null {
  if (!category) return null;
  
  // Standardize formatting: lowercase and replace spaces with underscores
  const formattedCategory = category.toLowerCase().replace(/\s+/g, '_');
  
  // Map common non-standard categories to valid DocumentCategoryType values
  const categoryMap: Record<string, DocumentCategoryType> = {
    // Common LLM-generated categories -> Standard categories
    'business_&_finance': DocumentCategoryType.GENERAL,
    'finance': DocumentCategoryType.PAYROLL,
    'investment': DocumentCategoryType.GENERAL,
    'investors': DocumentCategoryType.GENERAL,
    'funding': DocumentCategoryType.GENERAL,
    'business': DocumentCategoryType.GENERAL,
    'company_information': DocumentCategoryType.GENERAL,
    'recruitment': DocumentCategoryType.HIRING,
    'employment': DocumentCategoryType.HR_MANAGEMENT,
    'human_resources': DocumentCategoryType.HR_MANAGEMENT,
    'customer_service': DocumentCategoryType.CUSTOMER_SUPPORT_INTEGRATION,
    'technical_support': DocumentCategoryType.GENERAL,
    'technology': DocumentCategoryType.AI_TOOLS,
    'software': DocumentCategoryType.GENERAL,
    'product': DocumentCategoryType.GENERAL,
    'training': DocumentCategoryType.TRAINING_MODULES
  };
  
  // First check for direct mapping in our custom map
  if (categoryMap[formattedCategory]) {
    logInfo(`Mapped LLM category "${category}" to standard category "${categoryMap[formattedCategory]}"`);
    return categoryMap[formattedCategory];
  }
  
  // Next, check if it's already a valid DocumentCategoryType (exact match)
  if (Object.values(DocumentCategoryType).includes(formattedCategory as DocumentCategoryType)) {
    return formattedCategory as DocumentCategoryType;
  }
  
  // Try to find a partial match with DocumentCategoryType values
  const allCategories = Object.values(DocumentCategoryType);
  for (const validCategory of allCategories) {
    // Check if the submitted category contains a valid category name
    if (formattedCategory.includes(validCategory.toLowerCase())) {
      logInfo(`Found partial match from LLM category "${category}" to standard category "${validCategory}"`);
      return validCategory;
    }
    
    // Check if a valid category contains the submitted category
    if (validCategory.toLowerCase().includes(formattedCategory)) {
      logInfo(`Found reverse partial match from LLM category "${category}" to standard category "${validCategory}"`);
      return validCategory;
    }
  }
  
  logWarning(`LLM suggested category "${category}" (formatted as "${formattedCategory}") does not match any standard DocumentCategoryType.`);
  return null; // Return null if no match
}

/**
 * Analyzes a query to extract entities and determine query characteristics
 * 
 * @param query The user query to analyze
 * @returns Analysis result with entities, categories, and query type
 */
export async function analyzeQuery(query: string): Promise<LocalQueryAnalysis> {
  const cacheKey = `${QUERY_ANALYSIS_CACHE_KEY_PREFIX}${query}`;
  
  // Try fetching from cache first
  const cachedResult = getFromCache<LocalQueryAnalysis>(cacheKey);
  if (cachedResult) {
    logDebug('Query analysis cache hit', { query });
    recordMetric('queryAnalysis', 'cache', 0, true);
    return cachedResult;
  }
  
  logDebug('Query analysis cache miss', { query });
  const startTime = Date.now();
  
  try {
    // Use simple analysis if feature is disabled
    // TEMPORARY FIX: Use hardcoded flag instead of isFeatureEnabled
    if (!ENHANCED_QUERY_ANALYSIS_ENABLED) {
      return performBasicAnalysis(query);
    }
    
    // Get Gemini model
    const model = getQueryAnalysisModel();
    
    // Create the query analysis prompt
    const prompt = `
    Analyze the following query thoroughly to aid in optimizing information retrieval.
    
    QUERY: "${query}"
    
    Respond with a JSON object containing the following attributes:
    
    1. intent: The primary intent of the query (one of: INFORMATIONAL, TECHNICAL, FEATURE_INQUIRY, COMPARISON, TROUBLESHOOTING, HOW_TO, DEFINITION, PRICING, COMPATIBILITY, OTHER)
    2. topics: Array of main topics addressed in the query
    3. entities: Array of entities mentioned, each with:
       - name: Entity name
       - type: Type of entity (PERSON, ORGANIZATION, PRODUCT, FEATURE, LOCATION, CONCEPT, TECHNICAL_TERM, OTHER)
       - score: Confidence score between 0 and 1
    4. technicalLevel: Rating from 1 (non-technical) to 5 (highly technical)
    5. primaryCategory: Most relevant category for the query. MUST be one of the following valid categories:
       ${Object.values(DocumentCategoryType).join(', ')}
    6. keywords: Array of key terms for search expansion
    7. isAmbiguous: Boolean indicating if the query is ambiguous and needs clarification
    
    Format as valid JSON without explanations or additional text.
    `;
    
    // Generate the analysis using Gemini
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse the response as JSON
    let analysis: Partial<LocalQueryAnalysis>;
    try {
      analysis = extractJsonFromText(responseText);
    } catch (error) {
      console.error('Error parsing Gemini response as JSON:', error);
      console.log('Raw response:', responseText);
      throw new Error('Invalid response format from Gemini');
    }
    
    // Ensure valid intent or use default
    const validIntents: QueryIntent[] = [
      'INFORMATIONAL', 'TECHNICAL', 'FEATURE_INQUIRY', 'COMPARISON',
      'TROUBLESHOOTING', 'HOW_TO', 'DEFINITION', 'PRICING', 'COMPATIBILITY', 'OTHER'
    ];
    
    if (!analysis.intent || !validIntents.includes(analysis.intent as QueryIntent)) {
      analysis.intent = 'INFORMATIONAL';
    }
    
    // Ensure valid entities array
    if (!analysis.entities || !Array.isArray(analysis.entities)) {
      analysis.entities = [];
    }
    
    // Ensure valid topics array
    if (!analysis.topics || !Array.isArray(analysis.topics)) {
      analysis.topics = [];
    }
    
    // Ensure technical level is a number between 1-5 (Updated Scale)
    if (typeof analysis.technicalLevel !== 'number' ||
        analysis.technicalLevel < 1 ||
        analysis.technicalLevel > 5) {
      analysis.technicalLevel = 3; // Default to mid-point
    }
    
    // *** ADDED VALIDATION FOR PRIMARY CATEGORY ***
    const rawPrimaryCategory = analysis.primaryCategory;
    logInfo(`[analyzeQuery] Raw category from LLM: "${rawPrimaryCategory}"`);
    
    const mappedCategory = mapToDocumentCategory(rawPrimaryCategory);

    if (mappedCategory) {
        logInfo(`[analyzeQuery] Successfully mapped category '${rawPrimaryCategory}' to '${mappedCategory}'`);
        analysis.primaryCategory = mappedCategory; // Use the valid, mapped category
    } else {
        logWarning(`[analyzeQuery] LLM suggested primaryCategory '${rawPrimaryCategory}' is invalid or unmappable. Defaulting to GENERAL.`);
        analysis.primaryCategory = DocumentCategoryType.GENERAL; // Default to GENERAL
    }
    // *** END ADDED VALIDATION ***
    
    // --- Map and Validate Categories --- 
    const mappedSecondaryCategories = Array.isArray(analysis.secondaryCategories) 
      ? analysis.secondaryCategories.map(mapToDocumentCategory).filter((c): c is DocumentCategoryType => c !== null)
      : [];
    // --- End Category Mapping --- 

    // Construct the complete analysis result
    const fullAnalysis: LocalQueryAnalysis = {
      originalQuery: query,
      intent: analysis.intent as QueryIntent,
      topics: analysis.topics as string[],
      entities: analysis.entities as Entity[],
      technicalLevel: analysis.technicalLevel as number,
      primaryCategory: analysis.primaryCategory,
      secondaryCategories: mappedSecondaryCategories,
      keywords: analysis.keywords as string[],
      queryType: analysis.queryType as string,
      expandedQuery: analysis.expandedQuery as string,
      isAmbiguous: analysis.isAmbiguous as boolean
    };
    
    // Record metrics for successful analysis
    recordMetric('queryAnalysis', 'gemini', Date.now() - startTime, true, {
      queryLength: query.length,
      intent: fullAnalysis.intent
    });
    
    // Cache the result
    cacheWithExpiry(cacheKey, fullAnalysis, QUERY_ANALYSIS_CACHE_TIMEOUT);

    // For debugging - log the entire analysis
    logInfo(`[analyzeQuery] Complete analysis for query "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}":`, 
        JSON.stringify({
            intent: fullAnalysis.intent,
            technicalLevel: fullAnalysis.technicalLevel,
            primaryCategory: fullAnalysis.primaryCategory,
            secondaryCategories: fullAnalysis.secondaryCategories,
            topics: fullAnalysis.topics,
            entities: fullAnalysis.entities?.map(e => `${e.name} (${e.type})`),
            isAmbiguous: fullAnalysis.isAmbiguous
        }, null, 2)
    );

    return fullAnalysis;
  } catch (error) {
    // Log and record error
    logError('Error performing query analysis', error);
    recordMetric('queryAnalysis', 'gemini', Date.now() - startTime, false, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Fall back to basic analysis
    const fallbackResult = performBasicAnalysis(query);
    // Cache the fallback result as well, but maybe for shorter duration?
    // For now, cache with standard timeout
    cacheWithExpiry(cacheKey, fallbackResult, QUERY_ANALYSIS_CACHE_TIMEOUT);
    return fallbackResult;
  }
}

/**
 * Simple fallback analysis when Gemini is unavailable
 * 
 * @param query The user query
 * @returns Basic analysis
 */
function performBasicAnalysis(query: string): LocalQueryAnalysis {
  // Simple keyword-based categorization
  const lowerQuery = query.toLowerCase();
  
  // Detect intent based on keywords
  let intent: QueryIntent = 'INFORMATIONAL';
  
  if (lowerQuery.includes('how to') || lowerQuery.includes('how do i')) {
    intent = 'HOW_TO';
  } else if (lowerQuery.includes('vs') || lowerQuery.includes('compare') || lowerQuery.includes('difference')) {
    intent = 'COMPARISON';
  } else if (lowerQuery.includes('error') || lowerQuery.includes('issue') || lowerQuery.includes('problem')) {
    intent = 'TROUBLESHOOTING';
  } else if (lowerQuery.includes('what is') || lowerQuery.includes('definition') || lowerQuery.includes('define')) {
    intent = 'DEFINITION';
  } else if (lowerQuery.includes('cost') || lowerQuery.includes('price') || lowerQuery.includes('pricing')) {
    intent = 'PRICING';
  } else if (lowerQuery.includes('feature') || lowerQuery.includes('capability') || lowerQuery.includes('function')) {
    intent = 'FEATURE_INQUIRY';
  } else if (lowerQuery.includes('compatible') || lowerQuery.includes('work with') || lowerQuery.includes('integration')) {
    intent = 'COMPATIBILITY';
  } else if (lowerQuery.includes('code') || lowerQuery.includes('api') || lowerQuery.includes('implement')) {
    intent = 'TECHNICAL';
  }
  
  // Extract basic entities (simple word-based approach)
  const stopWords = ["a", "an", "the", "in", "on", "at", "for", "with", "by", "to", "of"];
  const words = query.split(/\s+/).filter(word => 
    word.length > 2 && !stopWords.includes(word.toLowerCase())
  );
  
  // Extract potential entities (very simple)
  const entities: Entity[] = words
    .filter(word => word.length > 3 || word[0] === word[0].toUpperCase())
    .map(word => ({
      name: word,
      type: word[0] === word[0].toUpperCase() ? 'CONCEPT' : 'OTHER',
      score: 0.7
    }));
  
  // Estimate technical level
  const technicalTerms = ['api', 'code', 'implementation', 'function', 'class', 'object', 'library', 'module', 'interface'];
  const technicalScore = technicalTerms.filter(term => lowerQuery.includes(term)).length;
  const technicalLevel = Math.min(3, Math.floor(technicalScore / 2));
  
  return {
    originalQuery: query,
    intent,
    topics: words.slice(0, 3), // Just use top few words as topics
    entities,
    technicalLevel,
    primaryCategory: intent,
    keywords: words,
    isAmbiguous: query.length < 10 // Simple heuristic for ambiguity
  };
}

/**
 * Get optimized retrieval parameters based on query analysis
 * 
 * @param analysis The query analysis
 * @returns Parameters for optimizing retrieval
 */
export function getRetrievalParameters(analysis: LocalQueryAnalysis): RetrievalParameters {
  // Base configuration
  const params: RetrievalParameters = {
    hybridRatio: 0.5, // Default hybrid ratio (0.5 = balanced)
    limit: 10,        // Default number of results
    rerank: true,     // Always rerank by default
    rerankCount: 10,  // Number of results to rerank
    expandQuery: false, // Default to not expanding queries
    
    // Category filtering - start with empty filter
    categoryFilter: {
      categories: [],
      strict: false
    },
    
    // Default to wide technical level range (1-5) - UPDATED SCALE
    technicalLevelRange: {
      min: 1,
      max: 5
    }
  };
  
  // Adjust hybrid ratio based on query type
  if (analysis.intent === 'DEFINITION' || analysis.intent === 'INFORMATIONAL') {
    // For definitions, slightly favor BM25 for exact term matching
    params.hybridRatio = 0.4;
  } else if (analysis.intent === 'TECHNICAL' || analysis.intent === 'HOW_TO') {
    // For technical queries, favor vector search for semantic understanding
    params.hybridRatio = 0.7;
  } else if (analysis.intent === 'COMPARISON') {
    // For comparisons, strongly favor vector search
    params.hybridRatio = 0.8;
  }
  
  // Adjust result limits based on query complexity
  if (analysis.technicalLevel >= 2) {
    // For highly technical queries, we want more results to work with
    params.limit = 15;
    params.rerankCount = 15;
  }
  
  // Enable query expansion for potentially ambiguous queries
  if (analysis.isAmbiguous || analysis.originalQuery.length < 15) {
    params.expandQuery = true;
  }
  
  // Adjust technical level range based on the query's technical level (1-5 scale)
  params.technicalLevelRange.min = Math.max(1, analysis.technicalLevel - 1);
  params.technicalLevelRange.max = Math.min(5, analysis.technicalLevel + 1);
  
  // If we have a primary category, use it for filtering
  if (analysis.primaryCategory) {
    params.categoryFilter.categories = [analysis.primaryCategory];
    
    // Add secondary categories if available
    if (analysis.secondaryCategories && analysis.secondaryCategories.length > 0) {
      params.categoryFilter.categories = [
        ...params.categoryFilter.categories, 
        ...analysis.secondaryCategories
      ];
    }
  }
  
  return params;
}

/**
 * Get the Gemini API key
 */
function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }
  return apiKey;
}

/**
 * Get the Gemini model for query analysis
 */
function getQueryAnalysisModel() {
  const apiKey = getGeminiApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ],
  });
}

/**
 * Analyzes a query to determine visual focus, search terms, and other contextual information
 * 
 * @param query The user query to analyze
 * @returns Analysis of query context with visual focus detection
 */
export async function analyzeQueryForContext(
  query: string
): Promise<QueryContextAnalysis> {
  try {
    const startTime = Date.now();
    
    // Get enhanced visual analysis using our improved detection
    const visualAnalysis = analyzeVisualQuery(query);
    
    // Use the Gemini API for more detailed analysis
    const prompt = `
      Analyze the following query to understand the user's information needs:
      
      "${query}"
      
      Provide your analysis in JSON format with the following fields:
      - searchTerms: An array of 2-5 key search terms extracted from the query
      - topicCategories: An array of 1-3 likely topic categories this query belongs to
      - technicalLevel: A number from 0-3 indicating technical complexity (0=non-technical, 3=highly technical)
      - expectedAnswerType: One of ["factual", "conceptual", "procedural", "comparative"]
      - entityFocus: An array of specific entities (products, companies, etc.) the user is asking about
    `;
    
    // Import the Gemini client helper
    const { generateStructuredGeminiResponse } = await import('./geminiClient');
    
    // Define the expected response schema
    const responseSchema = {
      searchTerms: [{ type: "string" }],
      topicCategories: [{ type: "string" }],
      technicalLevel: { type: "number" },
      expectedAnswerType: { type: "string", enum: ["factual", "conceptual", "procedural", "comparative"] },
      entityFocus: [{ type: "string" }]
    };
    
    // Generate the structured response
    const analysis = await generateStructuredGeminiResponse(
      "You are an expert in query analysis for a knowledge base system with visual content capabilities.",
      prompt,
      responseSchema
    );
    
    // Record performance metrics
    recordMetric('queryContextAnalysis', 'gemini', Date.now() - startTime, true, {
      visualFocus: visualAnalysis.isVisualQuery,
      confidence: visualAnalysis.confidence,
      visualTypes: visualAnalysis.visualTypes,
      technicalLevel: analysis.technicalLevel,
      answerType: analysis.expectedAnswerType
    });
    
    // Return the analysis with the enhanced visual focus determination
    return {
      searchTerms: analysis.searchTerms || query.split(/\s+/).filter(t => t.length > 3),
      topicCategories: analysis.topicCategories || [],
      technicalLevel: analysis.technicalLevel !== undefined ? analysis.technicalLevel : 1,
      expectedAnswerType: analysis.expectedAnswerType || 'factual',
      entityFocus: analysis.entityFocus || [],
      visualFocus: visualAnalysis.isVisualQuery,
      visualTypes: visualAnalysis.visualTypes.length > 0 ? visualAnalysis.visualTypes : undefined
    };
  } catch (error) {
    console.error("Error analyzing query context:", error);
    
    // Fallback to basic extraction with our enhanced visual detection
    const visualAnalysis = analyzeVisualQuery(query);
    
    return {
      searchTerms: query.split(/\s+/).filter(t => t.length > 3),
      topicCategories: [],
      technicalLevel: 1,
      expectedAnswerType: 'factual',
      entityFocus: [],
      visualFocus: visualAnalysis.isVisualQuery,
      visualTypes: visualAnalysis.visualTypes.length > 0 ? visualAnalysis.visualTypes : undefined
    };
  }
}

/**
 * Determines if a query is likely about visual content
 * 
 * @param query - The search query to analyze
 * @returns True if the query is likely about visual content
 */
export function isQueryAboutVisuals(query: string): boolean {
  const visualTerms = [
    // Basic visual terms
    'chart', 'graph', 'table', 'diagram', 'image', 'picture', 'figure',
    'plot', 'visualization', 'infographic', 'slide', 'presentation',
    'show', 'display', 'visual', 'illustration',
    
    // Enhanced visual terms
    'dashboard', 'screenshot', 'photo', 'thumbnail', 'gallery',
    'icon', 'logo', 'banner', 'mockup', 'wireframe', 'flowchart',
    'histogram', 'heatmap', 'treemap', 'scatter plot', 'pie chart',
    'bar chart', 'line chart', 'area chart', 'bubble chart', 'pictogram',
    
    // Document or content format terms indicating visuals
    'slide deck', 'deck', 'report', 'whitepaper', 'brochure', 'poster',
    'handout', 'leaflet', 'flyer',
    
    // AI-specific visual terms
    'generated image', 'ai image', 'visual representation',
    'data visualization', 'visual analysis', 'render',
    'rendered output', 'visual model', 'image generation',
    
    // File formats that imply visual content
    'png', 'jpg', 'jpeg', 'svg', 'gif', 'pdf', 'ppt', 'slides',
    'tiff', 'bmp', 'webp', 'image file', 'graphics file'
  ];
  
  const lowerQuery = query.toLowerCase();
  
  // Check for direct references to visual elements
  for (const term of visualTerms) {
    // Match both whole words and partial word matches
    if (
      lowerQuery.includes(' ' + term + ' ') || 
      lowerQuery.includes(' ' + term + ',') ||
      lowerQuery.includes(' ' + term + '.') ||
      lowerQuery.includes(' ' + term + '?') ||
      lowerQuery.includes(' ' + term + ':') ||
      lowerQuery.startsWith(term + ' ') ||
      lowerQuery.endsWith(' ' + term) ||
      lowerQuery === term
    ) {
      return true;
    }
  }
  
  // Check for queries asking to see something
  const seeingPatterns = [
    'show me', 'display', 'visualize', 'graph of', 'chart of',
    'what does it look like', 'how does it appear', 'can i see',
    'view the', 'visual of', 'picture of', 'image of', 'rendered',
    'illustrated', 'visually explain', 'draw', 'plot', 'screenshot',
    'what is shown', 'visually represent', 'demonstrate visually',
    'can you show', 'please show', 'let me see', 'display a',
    'what are the visuals', 'do you have images', 'are there pictures',
    'how is it visualized', 'visual example'
  ];
  
  for (const pattern of seeingPatterns) {
    if (lowerQuery.includes(pattern)) {
      return true;
    }
  }
  
  // Analyze for implicit visual intent
  const implicitVisualPatterns = [
    'color', 'shape', 'layout', 'design', 'appearance', 'looks like',
    'visual pattern', 'trend line', 'data point', 'dashboard',
    'compare visually', 'side by side', 'thumbnail', 'format',
    'graphic', 'depiction', 'illustration', 'icon', 'logo',
    'UI', 'interface', 'aesthetic', 'visually', 'sketch',
    'outlook', 'resemble', 'visual representation', 'artistically'
  ];
  
  // Count how many implicit patterns match
  let implicitMatchCount = 0;
  for (const pattern of implicitVisualPatterns) {
    if (lowerQuery.includes(pattern)) {
      implicitMatchCount++;
    }
  }
  
  // If multiple implicit patterns match, it's likely a visual query
  if (implicitMatchCount >= 2) {
    return true;
  }
  
  // Use more advanced regex patterns
  const regexPatterns = [
    /\b(show|display|see)\b.{1,30}\b(image|picture|chart|graph|diagram)\b/i,
    /\b(what|how).{1,20}\b(look|appear|display|visualize)\b/i,
    /\bvisual.{1,15}\b(example|representation|aid|format)\b/i
  ];
  
  for (const pattern of regexPatterns) {
    if (pattern.test(lowerQuery)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Interface for results from visual query analysis
 */
export interface VisualQueryAnalysis {
  /** Whether the query is about visual content */
  isVisualQuery: boolean;
  
  /** Specific types of visuals being requested */
  visualTypes: string[];
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Whether the query is explicitly visual or implicitly visual */
  explicitVisualRequest: boolean;
}

/**
 * Analyze a query to determine if it's requesting visual content
 * and what specific type of visual content is being requested
 * 
 * @param query - The search query to analyze
 * @returns Analysis of the visual aspects of the query
 */
export function analyzeVisualQuery(query: string): VisualQueryAnalysis {
  const lowerQuery = query.toLowerCase();
  const isVisual = isQueryAboutVisuals(query);
  
  // Visual type detection
  const visualTypePatterns: Record<string, RegExp[]> = {
    'chart': [
      /\b(chart|graph|plot)\b/i,
      /\b(bar|line|pie|area|scatter|bubble|column)\s*(chart|graph|plot)\b/i,
      /\b(histogram|heatmap|treemap)\b/i,
      /\bdata\s*(visualization|viz)\b/i
    ],
    'table': [
      /\b(table|matrix|grid)\b/i,
      /\b(row|column)\s*(data|value|header)\b/i,
      /\btabular\s*(data|format|representation)\b/i
    ],
    'diagram': [
      /\b(diagram|flowchart|schematic|blueprint)\b/i,
      /\b(process|workflow|architecture|system|network)\s*(diagram|map|chart)\b/i,
      /\b(flow|relationship|concept|mind)\s*(map|diagram)\b/i
    ],
    'image': [
      /\b(image|picture|photo|photograph|screenshot)\b/i,
      /\bwhat\s*(does|do)\s*it\s*look\s*like\b/i,
      /\b(png|jpg|jpeg|gif)\b/i
    ],
    'infographic': [
      /\b(infographic|pictogram)\b/i,
      /\bvisual\s*(summary|overview|explanation)\b/i,
      /\bcombination\s*of\s*(text|data)\s*and\s*(images|graphics)\b/i
    ],
    'presentation': [
      /\b(slide|deck|presentation|powerpoint|ppt)\b/i,
      /\bslide\s*(deck|show|presentation)\b/i
    ]
  };
  
  // Detect matching visual types
  const matchedTypes: string[] = [];
  let highestConfidence = 0;
  
  for (const [type, patterns] of Object.entries(visualTypePatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerQuery)) {
        if (!matchedTypes.includes(type)) {
          matchedTypes.push(type);
          
          // Calculate confidence based on pattern specificity
          const match = lowerQuery.match(pattern);
          if (match) {
            const confidence = match[0].length / lowerQuery.length;
            highestConfidence = Math.max(highestConfidence, confidence);
          }
        }
      }
    }
  }
  
  // Detect explicit vs. implicit
  const explicitVisualTerms = [
    'show', 'display', 'visualize', 'image', 'picture', 'photo',
    'chart', 'graph', 'diagram', 'table', 'visual'
  ];
  
  let isExplicit = false;
  for (const term of explicitVisualTerms) {
    if (
      lowerQuery.includes(' ' + term + ' ') || 
      lowerQuery.startsWith(term + ' ') ||
      lowerQuery.endsWith(' ' + term) ||
      lowerQuery === term
    ) {
      isExplicit = true;
      break;
    }
  }
  
  // If we detected it's a visual query but couldn't identify specific types,
  // add a generic "image" type
  if (isVisual && matchedTypes.length === 0) {
    matchedTypes.push('image');
  }
  
  // Set confidence based on various factors
  let confidence = isVisual ? 0.6 : 0;
  if (highestConfidence > 0) {
    confidence = Math.max(confidence, 0.5 + (highestConfidence * 0.5));
  }
  if (isExplicit) {
    confidence = Math.max(confidence, 0.8);
  }
  
  return {
    isVisualQuery: isVisual,
    visualTypes: matchedTypes,
    confidence: confidence,
    explicitVisualRequest: isExplicit
  };
} 
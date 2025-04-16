import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabase } from '../../utils/supabaseClient';
import { logInfo, logWarning, logError, logDebug } from '../../lib/logging';
import { testSupabaseConnection } from '../../lib/supabase';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import { createTimer } from '../../lib/metrics';
import { generateAnswer } from '../../utils/answerGenerator';
import { analyzeQueryWithGemini } from '../../utils/geminiProcessor';
import { hybridSearch, fallbackSearch, HybridSearchResponse } from '../../utils/hybridSearch';
import { expandQuery } from '../../utils/queryExpansion';
import { rerankWithGemini } from '../../utils/reranking';
import { QueryAnalysisResult } from '../../utils/geminiProcessor';
import { DocumentCategoryType } from '../../utils/documentCategories';
import { MultiModalRerankOptions } from '../../utils/reranking';

// Import types - properly define to match the response from analyzeQueryWithGemini
interface QueryEntity {
  name?: string;
  type?: string;
  importance?: number;
}

// Define missing types
type HybridSearchFilter = {
  primaryCategory?: DocumentCategoryType;
  secondaryCategories?: DocumentCategoryType[];
  technicalLevelMin?: number;
  technicalLevelMax?: number;
  requiredEntities?: string[];
  keywords?: string[];
  customFilters?: Record<string, any>;
};

// Update the SearchResultItem to match what rerankWithGemini expects
interface SearchResultItem {
  id?: string;
  document_id?: string;
  text: string;
  metadata?: Record<string, any>;
  score: number;
  vectorScore?: number;
  keywordScore?: number;
  source?: string;
  // Add the 'item' field that MultiModalSearchResult requires
  item: {
    id: string;
    text: string;
    // Define metadata strictly as expected by MultiModalSearchResult/rerankWithGemini
    metadata: { 
      category?: string; 
      technicalLevel?: number; 
      [key: string]: any; // Allow other arbitrary fields
    };
    // visualContent?: VisualContent | VisualContent[]; // Keep commented out unless strictly needed
  };
}

// Correctly define these types based on what rerankWithGemini expects
interface RankedSearchResultItem extends SearchResultItem {
  text: string; // Ensure text is definitely required
}

type RankedSearchResult = RankedSearchResultItem;
type MultiModalSearchResult = SearchResultItem; // Now compatible because SearchResultItem includes item
// Remove local definition
/*
type MultiModalRerankOptions = {
  includeVisualContext?: boolean;
  prioritizeVisualTypes?: string[];
};
*/

// Mock model config
const modelConfig = {
  getSystemPromptForQuery: (query: string) => {
    return "You are a helpful assistant answering questions based on retrieved information.";
  }
};

// Other utility functions
function getRetrievalParameters(analysis: QueryAnalysisResult) {
  // Simple implementation
  return {
    technicalLevelRange: {
      min: analysis.technicalLevel || 1,
      max: analysis.technicalLevel ? analysis.technicalLevel + 2 : 3
    }
  };
}

function analyzeVisualQuery(query: string) {
  // Simple implementation
  return {
    isVisualQuery: query.toLowerCase().includes('image') || query.toLowerCase().includes('picture'),
    visualTypes: []
  };
}

/**
 * Determines whether a user query needs to be rewritten to add Workstream context.
 * 
 * This function analyzes the query and its entity analysis to decide if the query
 * is implicitly about Workstream but doesn't mention it explicitly. For example,
 * queries like "Who is the CEO?" or "Tell me about pricing" without specifying
 * which company are assumed to be about Workstream.
 * 
 * The function uses the following criteria:
 * 1. If another organization (not Workstream) is explicitly mentioned, no rewriting occurs.
 * 2. If the query contains ambiguous terms like "our", "we", "us", "my", "the company",
 *    it's considered ambiguous and rewritten to include Workstream.
 * 3. If the query is a simple standalone noun like "ceo", "products", "pricing" without
 *    organizational context, it's rewritten to include Workstream.
 * 
 * @param {string} originalQuery - The user's original search query
 * @param {QueryAnalysisResult} analysis - The result of query analysis containing entities
 * @returns {{ rewrite: boolean; rewrittenQuery?: string }} - Object indicating whether
 *          rewriting is needed and the rewritten query if applicable
 */
function shouldRewriteQuery(originalQuery: string, analysis: QueryAnalysisResult): { rewrite: boolean; rewrittenQuery?: string } {
  const queryLower = originalQuery.toLowerCase();
  let isExplicitlyNotWorkstream = false;
  let mentionsWorkstream = queryLower.includes('workstream');
  let containsAmbiguousTerms = false;

  // 1. Check if another organization is mentioned
  if (analysis.entities && analysis.entities.length > 0) {
    for (const entity of analysis.entities) {
      // Normalize entity name for comparison
      const entityNameLower = entity.name?.toLowerCase();
      if (entity.type === 'ORGANIZATION' && entityNameLower && entityNameLower !== 'workstream') {
        isExplicitlyNotWorkstream = true;
        break; // Found another org, no need to rewrite
      }
      if (entity.type === 'ORGANIZATION' && entityNameLower === 'workstream') {
          mentionsWorkstream = true; // Confirm Workstream was detected
      }
    }
  }

  // If explicitly about another company, don't rewrite
  if (isExplicitlyNotWorkstream) {
    return { rewrite: false };
  }

  // 2. Check for ambiguous terms if Workstream isn't explicitly mentioned
  const ambiguousPronouns = /\b(our|we|us|my|the company)\b/i;
  if (!mentionsWorkstream && ambiguousPronouns.test(queryLower)) {
    containsAmbiguousTerms = true;
  }

  // 3. Check for simple standalone queries like "ceo" or "pricing"
  const simpleStandaloneTerms = [
    "ceo", "chief executive officer", 
    "products", "product", "offering", "offerings", 
    "pricing", "price", "cost", "subscription",
    "features", "capabilities", "demo", "demonstration",
    "contact", "headquarters", "location", "founded", "history"
  ];
  
  const isSimpleQuery = simpleStandaloneTerms.some(term => {
    // Check if the query is just the term or contains the term with simple context
    // For example: "who is the ceo" or "tell me about pricing"
    const termRegex = new RegExp(`\\b${term}\\b`, 'i');
    return termRegex.test(queryLower) && queryLower.length < term.length + 20;
  });

  if (!mentionsWorkstream && (containsAmbiguousTerms || isSimpleQuery)) {
    const trimmedQuery = originalQuery.trim();
    // Insert Workstream in an appropriate place
    let rewrittenQuery = '';
    
    // Handle queries starting with "what is" or "who is"
    if (/^(what|who)\s+is/i.test(trimmedQuery)) {
      rewrittenQuery = trimmedQuery.replace(/^(what|who)\s+is/i, '$1 is the Workstream');
    } 
    // Handle queries like "tell me about X"
    else if (/^tell\s+(me|us)\s+about/i.test(trimmedQuery)) {
      rewrittenQuery = trimmedQuery.replace(/^tell\s+(me|us)\s+about/i, 'tell $1 about Workstream');
    }
    // Handle simple "our X" or "we X" queries 
    else if (/^(our|we|us|my)\b/i.test(trimmedQuery)) {
      rewrittenQuery = trimmedQuery.replace(/^(our|we|us|my)\b/i, 'Workstream');
    }
    // Default: just append Workstream to the query
    else {
      rewrittenQuery = `Workstream ${trimmedQuery}`;
    }
    
    return { rewrite: true, rewrittenQuery };
  }

  return { rewrite: false };
}

// ---> Recommendation A: Centralized Prompt Constants <---
const BASE_ANSWER_SYSTEM_PROMPT = `
You are a helpful AI assistant providing information based on the context provided.
Follow these important guidelines:

1. Base your answers strictly on the provided context.
2. If the context doesn't contain the information needed, acknowledge this limitation explicitly (e.g., "Based on the provided documents, I don't have specific information on..."). Do not make assumptions or use external knowledge.
3. Maintain a professional, friendly tone.
4. Be concise but thorough.
5. If you reference specific documents, include their source numbers like [1], [2], etc.
6. If the user's question is vague or general, and the provided context is too broad or lacks specificity, acknowledge this politely. Offer guidance on how they can ask a more specific question, or provide a broad summary using the most relevant parts of the context.
`;

const FOLLOW_UP_APPEND_PROMPT = `

SPECIAL INSTRUCTION FOR FOLLOW-UP QUESTION:
- Look at the conversation history carefully to understand the context
- Pay special attention to previously referenced documents that have been included in the context (marked with isPreviouslyReferenced)
- Maintain continuity with previous responses by referencing the same sources when appropriate
- If answering requires information not in the provided context, acknowledge this limitation
- When referencing information from previous exchanges, explicitly mention this to maintain conversational flow
`;

const FALLBACK_FOLLOW_UP_SYSTEM_PROMPT = "You are a helpful assistant for Workstream. The user has asked a follow-up question, but we couldn't retrieve specific information from our knowledge base. Please provide a general answer based on the conversation history, or politely acknowledge that you don't have enough context to answer specifically.";

// API handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Add CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Generate a request ID for tracking this request through logs
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[${requestId}] API REQUEST START: /api/query`);

  // Define a local safe version of the recordMetric function to avoid filesystem issues
  const recordMetricSafely = (category: string, name: string, duration: number, success: boolean, metadata: any = {}) => {
    console.log(`[${requestId}] [METRIC] ${category}.${name}: ${duration}ms, success: ${success}`, JSON.stringify(metadata));
  };

  // Make sure any logging/metrics functions don't try to access the filesystem
  const metricsTimer = createTimer();
  
  // Start timing and define success flag at the handler level
  const startTime = Date.now();
  let success = false;  // Track whether we successfully processed the query
  
  try {
    const {
      query: originalQuery, 
      limit = 20, 
      searchMode = 'hybrid', 
      sessionId, // Capture sessionId from request
      includeCitations = false,
      includeMetadata = true,
      useContextualRetrieval = true,
      conversationHistory = [] 
    } = req.body;

    console.log(`[${requestId}] Query parameters received:`, {
      queryLength: originalQuery?.length || 0,
      sessionId: sessionId || 'none',
      historyLength: Array.isArray(conversationHistory) ? conversationHistory.length : 0
    });

    if (!originalQuery) {
      console.log(`[${requestId}] Error: Missing query parameter`);
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Special handling for basic greetings to avoid complex processing
    const basicGreetings = ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'];
    if (basicGreetings.includes(originalQuery.toLowerCase().trim())) {
      console.log(`[${requestId}] Detected basic greeting "${originalQuery}", using fast path response`);
      logInfo(`Detected basic greeting "${originalQuery}", using fast path response`);
      const greetingResponse = {
        query: originalQuery,
        answer: "Hello! I'm the Workstream Knowledge Assistant. I can help you with information about our HR, Payroll, and Hiring platform for hourly workers. What would you like to know?",
        resultCount: 0,
        metadata: {
          processingTimeMs: 50, // Nominal processing time
          isGreeting: true,
          usedFastPath: true
        }
      };
      
      console.log(`[${requestId}] API REQUEST COMPLETE: Fast path greeting response`);
      return res.status(200).json(greetingResponse);
    }

    logInfo(`Processing query: "${originalQuery.substring(0, 100)}${originalQuery.length > 100 ? '...' : ''}"`);
    
    // Add logging about conversation history
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      logInfo(`Query has conversation history with ${conversationHistory.length} messages`);
      if (conversationHistory.length > 0) {
        const lastMessage = conversationHistory[conversationHistory.length - 1];
        logInfo(`Last message in history: ${lastMessage?.role || 'unknown'}: "${lastMessage?.content?.substring(0, 50) || ''}..."`);
      }
    } else {
      logInfo('Query has no conversation history');
    }

    // Check if this is likely a follow-up question
    const isNotFirstMessage = Array.isArray(conversationHistory) && conversationHistory.length > 0;
    
    // Check for common follow-up question patterns
    const followUpKeywords = ['who', 'where', 'when', 'why', 'how', 'which', 'they', 'them', 'those', 'that', 'it', 'this', 'he', 'she', 'his', 'her', 'its', 'their', 'what'];
    const hasFollowUpKeywords = followUpKeywords.some(keyword => 
      originalQuery.toLowerCase().startsWith(keyword) || 
      originalQuery.toLowerCase().split(' ').slice(0, 3).includes(keyword)
    );
    
    // Combine signals to determine if this is a follow-up
    const isLikelyFollowUp = isNotFirstMessage && (
      hasFollowUpKeywords || 
      originalQuery.length < 20 // Short queries in a conversation are often follow-ups
    );

    if (isLikelyFollowUp) {
      logInfo(`Detected follow-up question (position: ${isNotFirstMessage}, keywords: ${hasFollowUpKeywords}): "${originalQuery}"`);
    }

    // Extract any document references from previous conversation history
    const previousDocumentReferences = extractPreviousDocumentReferences(conversationHistory);
    if (previousDocumentReferences.length > 0) {
      logInfo(`Found ${previousDocumentReferences.length} document references in conversation history`);
    }

    // Enhance the query with conversation context for follow-up questions
    let enhancedQuery = originalQuery;
    let queryWasExpanded = false;
    
    if (isLikelyFollowUp && conversationHistory && conversationHistory.length > 0) {
      try {
        // Get more complete conversation context
        const maxContextMessages = 6; // Use up to 3 exchanges (6 messages) for context
        const relevantHistory = conversationHistory.slice(-Math.min(maxContextMessages, conversationHistory.length));
        let contextualInfo = '';
        
        // Extract topic information from the conversation
        for (let i = 0; i < relevantHistory.length; i++) {
          const msg = relevantHistory[i];
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          contextualInfo += `${role}: "${msg.content.substring(0, 300)}${msg.content.length > 300 ? '...' : ''}"\n\n`;
        }
        
        // Expand the query with conversation context
        enhancedQuery = `Given this conversation context:\n${contextualInfo}\nAnswer this follow-up question: ${originalQuery}`;
        queryWasExpanded = true;
        logInfo(`Enhanced follow-up question with ${relevantHistory.length} messages of conversation context. New query length: ${enhancedQuery.length} characters`);
      } catch (expansionError) {
        logError('Error expanding follow-up question with context:', expansionError);
        // Continue with original query if expansion fails
      }
    }
    
    // Analyze the query to understand intent, entities, etc.
    const analysisStartTime = Date.now();
    const queryAnalysis = await analyzeQueryWithGemini(queryWasExpanded ? enhancedQuery : originalQuery);
    recordMetricSafely('query', 'analysis', Date.now() - analysisStartTime, true, {});
    
    // Check if we should rewrite the query to include "Workstream" context
    let queryToUse = queryWasExpanded ? enhancedQuery : originalQuery;
    let queryWasRewritten = false;
    
    // Only attempt query rewriting if the feature flag is enabled
    if (FEATURE_FLAGS.queryRewriting && !queryWasExpanded) {
      const rewriteStartTime = Date.now();
      const { rewrite, rewrittenQuery } = shouldRewriteQuery(originalQuery, queryAnalysis);
      
      if (rewrite && rewrittenQuery) {
        // Don't rewrite product queries with "Workstream" if they already mention products
        const isProductQuery = /\b(product|products|feature|features|capabilities|offerings)\b/i.test(originalQuery);
        if (!isProductQuery) {
          queryToUse = rewrittenQuery;
          queryWasRewritten = true;
          logInfo(`Rewrote query: "${originalQuery}" -> "${rewrittenQuery}"`);
        } else {
          logInfo(`Skipped rewriting product query: "${originalQuery}"`);
        }
      }
      
      recordMetricSafely('query', 'rewrite', Date.now() - rewriteStartTime, true, {});
    }
    
    // Check for visual query (image-focused)
    const visualAnalysis = analyzeVisualQuery(queryToUse);
    
    // Get retrieval parameters based on query analysis
    const retrievalParams = getRetrievalParameters(queryAnalysis);

    // Check if this query is about products
    const isProductQuery = /\b(product|products|feature|features|capabilities|offerings|integrations|integration)\b/i.test(queryToUse);
    
    // Search for relevant content
    const searchStartTime = Date.now();
    let searchResults: any[] = []; // Use any[] to avoid typing issues temporarily
    
    // Define search options from the query analysis
    // Note: We explicitly cast primaryCategory and secondaryCategories to DocumentCategoryType
    // to ensure type compatibility with the HybridSearchOptions interface
    const searchOptions = {
      limit: limit,
      vectorWeight: isProductQuery ? 0.3 : 0.7, // Emphasize keywords for product searches
      keywordWeight: isProductQuery ? 0.7 : 0.3, // Emphasize keywords for product searches
      matchThreshold: 0.2,
      filter: {
        primaryCategory: queryAnalysis.primaryCategory as DocumentCategoryType | undefined,
        secondaryCategories: queryAnalysis.secondaryCategories as DocumentCategoryType[] | undefined,
        technicalLevelMin: retrievalParams.technicalLevelRange.min,
        technicalLevelMax: retrievalParams.technicalLevelRange.max,
        requiredEntities: [] as string[],
        keywords: [] as string[]
      }
    };
    
    // Enhanced tag and category mapping based on query content
    if (queryAnalysis.primaryCategory || queryAnalysis.secondaryCategories) {
      logInfo(`Using query analysis categories - Primary: ${queryAnalysis.primaryCategory || 'none'}, Secondary: ${(queryAnalysis.secondaryCategories || []).join(', ') || 'none'}`);
    } else {
      // Extract categories and tags from the query if not provided by analysis
      const { primaryCategory, secondaryCategories, keywords } = extractCategoriesFromQuery(queryToUse);
      
      if (primaryCategory) {
        searchOptions.filter.primaryCategory = primaryCategory;
        logInfo(`Extracted primary category: ${primaryCategory}`);
      }
      
      if (secondaryCategories.length > 0) {
        searchOptions.filter.secondaryCategories = secondaryCategories;
        logInfo(`Extracted secondary categories: ${secondaryCategories.join(', ')}`);
      }
      
      if (keywords.length > 0) {
        searchOptions.filter.keywords = keywords;
        logInfo(`Extracted keywords: ${keywords.join(', ')}`);
      }
    }
    
    // For product-related queries, ensure we're using appropriate product tags
    if (isProductQuery) {
      const productKeywords = extractProductKeywords(queryToUse);
      
      // Apply product-specific filtering
      if (productKeywords.length > 0) {
        // Use extracted keywords as required entities
        searchOptions.filter.requiredEntities = productKeywords;
        logInfo(`Using product keywords for search: ${productKeywords.join(', ')}`);
        
        // ALWAYS set primary category for product queries to ensure relevant results
        // If no primary category set or it's not product-related, use product as default
        if (!searchOptions.filter.primaryCategory || 
            ![DocumentCategoryType.PRODUCT_OVERVIEW, 
              DocumentCategoryType.PRODUCT_COMPARISON, 
              DocumentCategoryType.PRICING_INFORMATION, 
              DocumentCategoryType.INTEGRATIONS].includes(searchOptions.filter.primaryCategory)) {
          searchOptions.filter.primaryCategory = DocumentCategoryType.PRODUCT_OVERVIEW;
          logInfo(`Setting primary category to PRODUCT_OVERVIEW based on product query`);
        }
        
        // Add specific product types to secondary categories if appropriate
        const productTypes = mapProductKeywordsToCategories(productKeywords);
        if (!searchOptions.filter.secondaryCategories) {
          searchOptions.filter.secondaryCategories = [];
        }
        
        // Add PRODUCT_OVERVIEW as a fallback secondary category if not already present
        // and it's not already the primary category
        if (searchOptions.filter.primaryCategory !== DocumentCategoryType.PRODUCT_OVERVIEW &&
            !searchOptions.filter.secondaryCategories.includes(DocumentCategoryType.PRODUCT_OVERVIEW)) {
          searchOptions.filter.secondaryCategories.push(DocumentCategoryType.PRODUCT_OVERVIEW);
          logInfo(`Added PRODUCT_OVERVIEW to secondary categories as fallback`);
        }
        
        // Add product types to secondary categories if not already included
        if (productTypes.length > 0) {
          productTypes.forEach(type => {
            if (!searchOptions.filter.secondaryCategories!.includes(type)) {
              searchOptions.filter.secondaryCategories!.push(type);
            }
          });
          logInfo(`Added product types to secondary categories: ${productTypes.join(', ')}`);
        }
        
        // If no specific product types were found but we know it's a product query,
        // add relevant backup categories to increase chances of finding matches
        if (productTypes.length === 0) {
          const backupCategories = [
            DocumentCategoryType.HIRING,
            DocumentCategoryType.ONBOARDING,
            DocumentCategoryType.PAYROLL
          ];
          
          backupCategories.forEach(category => {
            if (!searchOptions.filter.secondaryCategories!.includes(category)) {
              searchOptions.filter.secondaryCategories!.push(category);
            }
          });
          logInfo(`Added backup product categories for general product query`);
        }
      }
    }
    
    // ---> **FIX 2 REVISED: General Override for ALL Follow-ups** <---
    if (isLikelyFollowUp && originalQuery) {
        logInfo('[Follow-up Filter Override] Follow-up detected. Overriding filters using original query only.');

        // Re-extract categories and keywords based *only* on the original query
        const { 
            primaryCategory: originalPrimary, 
            secondaryCategories: originalSecondary, 
            keywords: originalKeywords 
        } = extractCategoriesFromQuery(originalQuery);

        // Override the filter settings derived from potentially skewed analysis
        if (originalPrimary) {
            searchOptions.filter.primaryCategory = originalPrimary;
            logInfo(`[Follow-up Filter Override] Overriding primary category from original query: ${originalPrimary}`);
        } else {
            searchOptions.filter.primaryCategory = DocumentCategoryType.GENERAL;
            logInfo(`[Follow-up Filter Override] No primary category from original query, defaulting to GENERAL.`);
        }

        if (originalSecondary.length > 0) {
            searchOptions.filter.secondaryCategories = originalSecondary;
            logInfo(`[Follow-up Filter Override] Overriding secondary categories from original query: ${originalSecondary.join(', ')}`);
        } else {
            searchOptions.filter.secondaryCategories = []; // Clear secondary if none extracted
        }

        // ---> Suggestion 2: Sanitize Required Entities <---
        const STOPWORDS = new Set(['check', 'again', 'tell', 'about', 'list', 'show', 'get', 'me', 'us', 'our', 'is', 'the', 'a', 'an']);
        const cleanedRequiredEntities = originalKeywords.filter(
            kw => !STOPWORDS.has(kw.toLowerCase()) && kw.length > 2
        );

        if (cleanedRequiredEntities.length > 0) {
            searchOptions.filter.requiredEntities = cleanedRequiredEntities;
            searchOptions.filter.keywords = []; // Clear any keywords from broader analysis
            logInfo(`[Follow-up Filter Override] Overriding required entities from original query (cleaned): ${cleanedRequiredEntities.join(', ')}`);
        } else {
            searchOptions.filter.requiredEntities = [];
            searchOptions.filter.keywords = [];
            logInfo(`[Follow-up Filter Override] No suitable required entities extracted from original query.`);
        }
        
        // ---> Suggestion 3: Log entities from queryAnalysis for comparison <---
        const analysisEntities = (queryAnalysis.entities || [])
            .map(e => e.name?.toLowerCase())
            .filter(Boolean) as string[];
        logInfo(`[Follow-up Filter Override] Entities from LLM analysis (for comparison): ${analysisEntities.join(', ')}`);
        // --- End Suggestion 3 Logging ---

        logInfo(`[Follow-up Filter Override] Overridden Filters Applied - Primary: ${searchOptions.filter.primaryCategory}, Secondary: ${searchOptions.filter.secondaryCategories?.join(',')}, Required Entities: ${searchOptions.filter.requiredEntities?.join(',')}`);
    }
    // ---> ** END FIX 2 REVISED ** <---
    
    // Perform search based on selected mode, using the real implementations
    if (searchMode === 'hybrid' || searchMode === 'default') {
      try {
        // Use the real hybrid search implementation
        const queryForSearch = queryWasRewritten ? queryToUse : originalQuery;
        const hybridResults = await hybridSearch(queryForSearch, searchOptions);
        searchResults = hybridResults.results || [];
      } catch (searchError) {
        logError('Error in hybrid search:', searchError);
        // Fall back to text search if hybrid search fails
        try {
          // For now, just do another hybrid search with different parameters
          const queryForSearch = queryWasRewritten ? queryToUse : originalQuery;
          const keywordResults = await hybridSearch(queryForSearch, {
            ...searchOptions,
            vectorWeight: 0.1,  // Almost all keyword weight
            keywordWeight: 0.9
          });
          searchResults = keywordResults.results || [];
        } catch (ftsError) {
          logError('Error in fallback text search:', ftsError);
          searchResults = [];
        }
      }
    } else if (searchMode === 'keyword') {
      // Use hybrid search with keyword emphasis
      try {
        const queryForSearch = queryWasRewritten ? queryToUse : originalQuery;
        const keywordResults = await hybridSearch(queryForSearch, {
          ...searchOptions,
          vectorWeight: 0.1,  // Almost all keyword weight
          keywordWeight: 0.9
        });
        searchResults = keywordResults.results || [];
      } catch (ftsError) {
        logError('Error in keyword search:', ftsError);
        searchResults = [];
      }
    } else if (searchMode === 'multimodal' && FEATURE_FLAGS.multiModalSearch && visualAnalysis.isVisualQuery) {
      // For now, just use the hybrid search and we'll enhance this later for multimodal
      try {
        const queryForSearch = queryWasRewritten ? queryToUse : originalQuery;
        const hybridResults = await hybridSearch(queryForSearch, {
          ...searchOptions,
          // Add visual search parameters when implementing multimodal search
        });
        searchResults = hybridResults.results || [];
      } catch (multimodalError) {
        logError('Error in multimodal search:', multimodalError);
        searchResults = [];
      }
    }
    
    // ---> Suggestion 1: Fallback Filter Recovery (on 0 results for follow-up) <---
    if (isLikelyFollowUp && searchResults.length === 0) {
        logWarning('[Follow-up Recovery] Initial search yielded 0 results. Retrying with relaxed filters.');
        try {
            const relaxedSearchStartTime = Date.now();
            const queryForRelaxedSearch = queryWasRewritten ? queryToUse : originalQuery;
            const relaxedResults = await hybridSearch(queryForRelaxedSearch, {
                ...searchOptions, // Keep limit, weights etc.
                filter: { // Only relax the filter part
                    // primaryCategory: DocumentCategoryType.GENERAL, // Default to general
                    // secondaryCategories: [],
                    technicalLevelMin: 1, // Broaden technical level too
                    technicalLevelMax: 5,
                    requiredEntities: [], // Remove entity requirement
                    keywords: [] // Remove keyword requirement
                }
            });
            searchResults = relaxedResults.results || [];
            recordMetricSafely('search', 'followup_relaxed_fallback', Date.now() - relaxedSearchStartTime, searchResults.length > 0, {});
            logInfo(`[Follow-up Recovery] Relaxed search completed. Found ${searchResults.length} results.`);
        } catch (relaxedSearchError) {
            logError('[Follow-up Recovery] Error during relaxed search:', relaxedSearchError);
            // Keep searchResults as empty array if relaxed search also fails
        }
    }
    // ---> End Suggestion 1 <---
    
    // Fallback search if no results - try query expansion
    if (searchResults.length === 0) {
      logWarning(`No results found for "${queryToUse}". Attempting expanded search.`);
      
      try {
        // Use the directly imported query expansion function
        const queryForExpansion = queryWasRewritten ? queryToUse : originalQuery;
        const expandedQueryResult = await expandQuery(queryForExpansion);
        if (expandedQueryResult && expandedQueryResult.expandedQuery !== queryForExpansion) {
          logInfo(`Expanded query: "${queryForExpansion}" -> "${expandedQueryResult.expandedQuery}"`);
          const expandedResults = await hybridSearch(expandedQueryResult.expandedQuery, {
            ...searchOptions,
            vectorWeight: 0.4,
            keywordWeight: 0.6 // Emphasize keywords even more for expanded queries
          });
          searchResults = expandedResults.results || [];
          logDebug('[QueryAPI] Search results after expansion:', { type: typeof searchResults, length: Array.isArray(searchResults) ? searchResults.length : 'N/A' });
        }
        
        // If still no results, try fallback search
        if (searchResults.length === 0) {
          logWarning(`No results from expanded search. Attempting fallback search.`);
          const queryForFallback = queryWasRewritten ? queryToUse : originalQuery;
          const fallbackResults = await fallbackSearch(queryForFallback);
          searchResults = fallbackResults.map(item => ({
            ...item,
            score: item.score || 0.5 // Ensure score exists
          }));
          
          logDebug('[QueryAPI] Search results after fallback search:', { type: typeof searchResults, length: Array.isArray(searchResults) ? searchResults.length : 'N/A' });
          // If even fallback failed, try with original query in case rewriting caused issues
          if (searchResults.length === 0 && queryWasRewritten) {
            logWarning(`No results from fallback search. Trying original query: "${originalQuery}"`);
            const originalQueryResults = await fallbackSearch(originalQuery);
            searchResults = originalQueryResults.map(item => ({
              ...item,
              score: item.score || 0.5 // Ensure score exists
            }));
            logDebug('[QueryAPI] Search results after original query fallback:', { type: typeof searchResults, length: Array.isArray(searchResults) ? searchResults.length : 'N/A' });
          }
        }
      } catch (fallbackError) {
        logError('Error in fallback search:', fallbackError); // Uncommented for debugging
        console.error('[QueryAPI] Fallback search encountered an error:', String(fallbackError)); 
      }
    }
    
    recordMetricSafely('search', 'hybrid_search', Date.now() - searchStartTime, searchResults.length > 0, {});
    
    // Convert search results to the SearchResultItem format
    const processedResults: SearchResultItem[] = searchResults.map((result, index) => {
      return {
        id: result.id,
        document_id: result.document_id,
        text: result.text || '',
        metadata: result.metadata || {}, // Keep general metadata here
        score: result.score || result.similarity || 0.5,
        vectorScore: result.vectorScore,
        keywordScore: result.keywordScore,
        source: result.source,
        // Ensure the 'item' structure matches MultiModalSearchResult
        item: {
          id: result.id || '', // Keep fallback, but needs verification
          text: result.text || '',
          // Populate metadata strictly
          metadata: {
            category: result.metadata?.category,
            technicalLevel: result.metadata?.technicalLevel,
            // Spread remaining metadata to satisfy [key: string]: any
            ...(result.metadata || {})
          }
        }
      };
    });

    // Use processedResults instead of searchResults for further operations
    if (FEATURE_FLAGS.contextualReranking && useContextualRetrieval && processedResults.length > 0) {
      const rerankStartTime = Date.now();
      
      // Setting up reranking options using the imported type's properties
      const rerankOptions: MultiModalRerankOptions = {
        useVisualContext: visualAnalysis.isVisualQuery, // Use correct property name
        visualFocus: visualAnalysis.isVisualQuery,    // Use correct property name (assuming intent matches)
        visualTypes: visualAnalysis.visualTypes       // Property name is the same
      };
      
      // Rerank results using Gemini
      try {
        // Use the direct rerankWithGemini function
        const rerankedResults = await rerankWithGemini(
          originalQuery, // Use original query for reranking
          processedResults, // processedResults structure should now be compatible
        rerankOptions
      );

        // Update processedResults with reranked results
        // Type assertion to ensure compatibility
        processedResults.splice(0, processedResults.length, ...rerankedResults as unknown as SearchResultItem[]);
        
        recordMetricSafely('search', 'reranking', Date.now() - rerankStartTime, true, {});
      } catch (rerankError) {
        logError('Error during reranking:', rerankError);
        console.warn(`Fallback reranker applied due to: ${rerankError instanceof Error ? rerankError.message : String(rerankError)}. Reverted to original ranking.`); 
        recordMetricSafely('search', 'reranking', Date.now() - rerankStartTime, false, {});
        // Continue with un-reranked results
      }
    }
    
    // ---> Suggestion 4: Instrument Source Match Failures <---
    try {
        const finalRequiredEntities = searchOptions.filter.requiredEntities || [];
        if (processedResults.length > 0 && finalRequiredEntities.length > 0) {
            const hitsWithEntities = processedResults.filter(result =>
                finalRequiredEntities.some(ent => {
                    const entityLower = ent?.toLowerCase();
                    // Check both text and potentially metadata source for entity presence
                    return entityLower && (
                        result.text?.toLowerCase().includes(entityLower) || 
                        result.metadata?.source?.toLowerCase().includes(entityLower)
                    );
                })
            );
            logInfo(`[Retrieval Quality] ${hitsWithEntities.length}/${processedResults.length} results match required entities (${finalRequiredEntities.join(', ')})`);
        } else if (processedResults.length > 0) {
            logInfo(`[Retrieval Quality] No required entities were specified for this search.`);
        }
    } catch (loggingError) {
        logWarning('[Retrieval Quality] Error during entity match logging:', loggingError);
    }
    // ---> End Suggestion 4 <---
    
    // Extract unique document IDs from search results for reference tracking
    const currentDocumentIds = processedResults.map(result => 
      result.id || result.document_id || result.item?.id
    ).filter(Boolean);
    
    // Prepare context for answer generation
    let contextForAnswer: SearchResultItem[] = processedResults.map(result => ({
      text: typeof result.text === 'string' ? result.text : JSON.stringify(result),
      source: result.metadata?.source || result.item?.metadata?.source || 'Unknown Source',
      metadata: result.metadata || result.item?.metadata || {},
      score: result.score || 0, // Ensure score exists
      // We might need to explicitly pass the `item` if generateAnswer expects it
      item: result.item || { id: result.id || '', text: result.text || '', metadata: result.metadata || {} }
    }));

    // ---> ADD COMPANY CONTEXT TO ANSWER GENERATION <---
    const companyContextData = req.body.options?.companyContext;
    if (companyContextData && companyContextData.companyInfo) {
        logInfo('[Query API] Adding Company Context to Answer Generation');
        const companyContextText = `Specific Information about ${companyContextData.companyName || 'the company'}:
${companyContextData.companyInfo}`;
        
        // Create a context item for the company info
        const companyContextItem: SearchResultItem = {
            text: companyContextText,
            source: 'Provided Company Context',
            metadata: { isCompanyContext: true },
            score: 1.0, // Give it high relevance
            item: { id: 'company-context', text: companyContextText, metadata: { isCompanyContext: true } }
        };
        
        // Prepend company context to the main context array
        contextForAnswer.unshift(companyContextItem);
    }
    // ---> END COMPANY CONTEXT ADDITION <---
    
    // If we have previous document references, prioritize them in the context
    // But DON'T include them in the hybrid search (which was causing structure issues)
    if (previousDocumentReferences.length > 0) {
      // Ensure we're not duplicating documents already in the current results
      const uniquePreviousRefs = previousDocumentReferences.filter(ref => 
        !currentDocumentIds.includes(ref.id)
      );
      
      if (uniquePreviousRefs.length > 0) {
        logInfo(`Adding ${uniquePreviousRefs.length} previously referenced documents to context`);
        
        // Add these documents at the beginning of the context for priority in answer generation only
        contextForAnswer = [
          ...uniquePreviousRefs.map(ref => ({
            text: ref.text,
            source: ref.source,
            metadata: { ...ref.metadata, isPreviouslyReferenced: true },
            score: 1.0, // Add required score property
            item: { // Add required item property
              id: ref.id || 'prev-ref',
              text: ref.text,
              metadata: {
                ...ref.metadata,
                isPreviouslyReferenced: true
              }
            }
          })),
          // Use the contextForAnswer which might include company info now
          ...contextForAnswer 
        ];
      }
    }
    
    // Generate answer
    const answerStartTime = Date.now();
    
    // ---> Recommendation C: Metadata Prompting (Tailoring) <---
    let systemPromptForGeneration = BASE_ANSWER_SYSTEM_PROMPT; // Start with base prompt

    // Add follow-up instructions if needed
    if (isLikelyFollowUp && conversationHistory && conversationHistory.length > 0) {
      systemPromptForGeneration += FOLLOW_UP_APPEND_PROMPT;
      logInfo(`Adding follow-up question handling instruction to system prompt`);
    }

    // Add product-specific instructions if needed
    if (isProductQuery) {
        systemPromptForGeneration += "\n\nPRODUCT QUERY FOCUS: Focus on product features, capabilities, integrations, use cases, and pricing if available in the context.";
        logInfo(`Adding product query focus instruction to system prompt`);
    }
    
    // Add other potential tailoring based on queryAnalysis results
    if (queryAnalysis.intent === 'comparison') {
        systemPromptForGeneration += "\n\nCOMPARISON QUERY FOCUS: Ensure you address all items being compared based on the context.";
        logInfo(`Adding comparison query focus instruction to system prompt`);
    } else if (queryAnalysis.intent === 'technical' && queryAnalysis.technicalLevel && queryAnalysis.technicalLevel >= 3) {
        systemPromptForGeneration += "\n\nTECHNICAL QUERY FOCUS: Provide detailed technical explanations and include specifics if available in the context.";
        logInfo(`Adding technical query focus instruction to system prompt`);
    }
    // ---> End Recommendation C <---

    const answer = await generateAnswer(originalQuery, contextForAnswer, {
      systemPrompt: systemPromptForGeneration, // Pass the tailored prompt
      includeSourceCitations: includeCitations,
      maxSourcesInAnswer: 5,
      conversationHistory: conversationHistory, // Pass conversation history to answer generator
    });
    recordMetricSafely('query', 'answer_generation', Date.now() - answerStartTime, true, {});
    
    // Track successful queries if session ID is provided
    if (sessionId) {
      try {
        // Optional: Track successfully answered queries by session for analytics
        // This could be implemented separately
      } catch (logError) {
        // Non-blocking error handling for logging
        console.error("Failed to log query analytics:", logError);
      }
    }
    
    // At the end of the try block, before the final response:
    console.log(`[${requestId}] Answer generation complete. Answer length: ${answer?.length || 0}`);
    
    // Prepare and return the response
    success = true;
    const responseData = {
      query: originalQuery,
      answer,
      resultCount: processedResults.length,
      metadata: {
        queryAnalysis,
        queryWasRewritten,
        rewrittenQuery: queryWasRewritten ? queryToUse : undefined,
        isProductQuery,
        isVisualQuery: visualAnalysis.isVisualQuery,
        hasConversationHistory: conversationHistory && conversationHistory.length > 0,
        processingTimeMs: Date.now() - startTime,
        queryWasExpanded: queryWasExpanded,
        usedConversationContext: isLikelyFollowUp,
        followUpDetected: isLikelyFollowUp
      }
    };

    // After processing search results, update the response to include info about enhanced follow-up handling
    if (queryWasExpanded) {
      responseData.metadata = {
        ...responseData.metadata,
        queryWasExpanded: true,
        usedConversationContext: true,
        followUpDetected: isLikelyFollowUp
      };
    }

    console.log(`[${requestId}] API REQUEST COMPLETE: Success - Returning ${processedResults.length} results`);
    
    // Log metrics without filesystem operations
    const duration = metricsTimer();
    console.log(`[${requestId}] [METRICS] Query processing completed in ${duration}ms`, {
      query: originalQuery,
      resultCount: processedResults.length,
      searchMode,
      hasAnswer: !!answer,
      length: answer?.length || 0
    });

    return res.status(200).json(responseData);
  } catch (error: any) {
    const duration = metricsTimer();
    console.error(`[${requestId}] [ERROR] Query processing failed:`, error);
    
    // Get query and conversationHistory from req.body to ensure they're in scope
    const { query: originalQuery = "", conversationHistory = [] } = req.body || {};
    
    console.log(`[${requestId}] API REQUEST FAILED after ${Date.now() - startTime}ms`, {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorType: error.constructor ? error.constructor.name : typeof error,
      statusCode: error.statusCode || 500
    });
    
    // Check if this is likely a follow-up from the error context
    // We need to recompute this since the previous isLikelyFollowUp variable is out of scope
    const isFollowUpQuestion = Array.isArray(conversationHistory) && 
                              conversationHistory.length > 0 && 
                              (originalQuery.length < 20 || /^(who|what|when|where|why|how|which|they|them|it|this|that)/i.test(originalQuery));
    
    // Log error metrics without filesystem operations
    console.log(`[${requestId}] [METRICS] Query processing failed in ${duration}ms`, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Handle follow-up error fallback
    if (isFollowUpQuestion) {
      try {
        const contextualAnswer = await generateAnswer(
          originalQuery, 
          [],  // No search results available
          {
            systemPrompt: FALLBACK_FOLLOW_UP_SYSTEM_PROMPT, // Use constant for fallback
            conversationHistory,
            timeout: 15000
          }
        );
        
        return res.status(200).json({
          answer: contextualAnswer,
          results: [],
          metadata: {
            followUpDetected: true,
            searchFailed: true,
            usedConversationHistoryFallback: true,
            timings: {
              total: Date.now() - startTime
            }
          }
        });
      } catch (fallbackError) {
        logError('Error generating fallback answer for follow-up question:', fallbackError);
        // Continue to the standard error response if fallback fails
      }
    }
    
    // Add this at the end of the catch block:
    console.log(`[${requestId}] API REQUEST COMPLETE: Error response sent`);
    
    // Standard error response
    return res.status(error.statusCode || 500).json({ 
      error: error.message || 'An error occurred while processing your query',
      errorDetails: String(error),
      metadata: {
        timings: {
          total: Date.now() - startTime
        }
      }
    });
  } finally {
    // Record overall API metrics
    recordMetricSafely('api', 'query', Date.now() - startTime, success, {});
  }
}

// Helper function to extract product keywords from query
function extractProductKeywords(query: string): string[] {
  const keywords: string[] = [];
  const queryLower = query.toLowerCase();
  
  // Look for known product names and features - expanded list with more variations
  const productTerms = [
    // Text-to-Apply Related
    'text-to-apply', 'text to apply', 'texting', 'sms', 'messaging', 'text messaging',
    'applicant texting', 'candidate texting', 'job application texting',
    
    // Onboarding Related
    'onboarding', 'e-verify', 'everify', 'i9', 'forms', 'documents', 'paperwork',
    'employee onboarding', 'digital onboarding', 'automated onboarding', 'new hire',
    'background check', 'background screening', 'screening', 'verification',
    
    // Payroll Related
    'payroll', 'payment', 'direct deposit', 'pay', 'paychecks', 'payroll processing',
    'wage', 'wages', 'salary', 'compensation', 'paystub', 'paystubs',
    
    // Scheduling Related
    'scheduling', 'schedule', 'shifts', 'shift management', 'time tracking',
    'time clock', 'attendance', 'timesheets', 'time sheets', 'clock in', 'clock out',
    
    // Recruiting/Hiring Related
    'recruiting', 'recruitment', 'hiring', 'applicant tracking', 'ats',
    'job posting', 'job postings', 'job listing', 'job listings', 'talent acquisition',
    'candidate', 'candidates', 'application', 'applications', 'job application',
    
    // HR Related
    'compliance', 'hr', 'human resources', 'employee management',
    'workforce management', 'employee data', 'hr management',
    
    // Integration Related
    'integration', 'integrations', 'api', 'connect', 'connection',
    'third-party', 'third party', 'software integration',
    
    // General Product Terms
    'product', 'products', 'feature', 'features', 'solution', 'solutions',
    'platform', 'service', 'services', 'software', 'tool', 'tools',
    'offering', 'offerings', 'capability', 'capabilities'
  ];
  
  productTerms.forEach(term => {
    if (queryLower.includes(term)) {
      keywords.push(term);
      
      // If the query is asking about "our products" or similar, add a specific keyword
      if (queryLower.match(/\b(our|your|workstream('s)?)\s+(products?|features?|offerings?)\b/) &&
          !keywords.includes('product_overview')) {
        keywords.push('product_overview');
      }
    }
  });
  
  // If no specific product keywords were found but the query is about products generally
  if (keywords.length === 0 && 
      (queryLower.includes('product') || 
       queryLower.includes('offering') || 
       queryLower.includes('feature') || 
       queryLower.match(/\b(what|tell|list|show).*(products?|features?|offerings?)\b/))) {
    keywords.push('product_overview');
  }
  
  return keywords;
}

/**
 * Extracts categories and tags from a query string
 * @param query The user's query
 * @returns Object containing primary category, secondary categories, and keywords
 */
function extractCategoriesFromQuery(query: string): {
  primaryCategory?: DocumentCategoryType;
  secondaryCategories: DocumentCategoryType[];
  keywords: string[];
} {
  const queryLower = query.toLowerCase();
  let primaryCategory: DocumentCategoryType | undefined = undefined;
  const secondaryCategories: DocumentCategoryType[] = [];
  const keywords: string[] = [];

  // Map of category indicators to primary categories
  const categoryMappings: Record<string, DocumentCategoryType> = {
    // Product-related categories
    'product': DocumentCategoryType.PRODUCT_OVERVIEW,
    'feature': DocumentCategoryType.PRODUCT_OVERVIEW,
    'integration': DocumentCategoryType.INTEGRATIONS,
    'text to apply': DocumentCategoryType.TEXT_TO_APPLY,
    'text-to-apply': DocumentCategoryType.TEXT_TO_APPLY,
    'sms': DocumentCategoryType.TWO_WAY_SMS,
    'onboarding': DocumentCategoryType.ONBOARDING,
    'payroll': DocumentCategoryType.PAYROLL,
    'scheduling': DocumentCategoryType.SCHEDULING,
    'hiring': DocumentCategoryType.HIRING,

    // Topic-based categories
    'compliance': DocumentCategoryType.COMPLIANCE,
    'legal': DocumentCategoryType.LEGAL,
    'regulation': DocumentCategoryType.COMPLIANCE,
    'privacy': DocumentCategoryType.SECURITY_PRIVACY,
    'security': DocumentCategoryType.SECURITY_PRIVACY,
    'pricing': DocumentCategoryType.PRICING_INFORMATION,
    'cost': DocumentCategoryType.PRICING_INFORMATION,
    'subscription': DocumentCategoryType.PRICING_INFORMATION,
    'plan': DocumentCategoryType.PRICING_INFORMATION,
    
    // Customer/support categories
    'support': DocumentCategoryType.GENERAL,
    'help': DocumentCategoryType.GENERAL,
    'troubleshoot': DocumentCategoryType.GENERAL,
    'issue': DocumentCategoryType.GENERAL,
    'training': DocumentCategoryType.TRAINING_MODULES,
    'learn': DocumentCategoryType.TRAINING_MODULES,
    'tutorial': DocumentCategoryType.TRAINING_MODULES,
    'guide': DocumentCategoryType.GENERAL,
    'documentation': DocumentCategoryType.DOCUMENTS,
    
    // Company categories
    'about': DocumentCategoryType.COMPANY_INFO,
    'history': DocumentCategoryType.COMPANY_INFO,
    'team': DocumentCategoryType.COMPANY_INFO,
    'leadership': DocumentCategoryType.LEADERSHIP_DEV,
    'ceo': DocumentCategoryType.COMPANY_INFO,
    'founder': DocumentCategoryType.COMPANY_INFO,
    'company': DocumentCategoryType.COMPANY_INFO
  };
  
  // Search for category indicators in the query
  Object.entries(categoryMappings).forEach(([indicator, category]) => {
    if (queryLower.includes(indicator)) {
      if (!primaryCategory) {
        primaryCategory = category;
      } else if (category !== primaryCategory && !secondaryCategories.includes(category)) {
        secondaryCategories.push(category);
      }
      
      // Add the detected indicator as a keyword
      if (!keywords.includes(indicator)) {
        keywords.push(indicator);
      }
    }
  });
  
  // Extract additional keywords from the query
  // Split the query into words and filter out common words
  const commonWords = ['and', 'or', 'the', 'a', 'an', 'in', 'on', 'with', 'for', 'to', 'from', 'by', 'about', 'tell', 'me'];
  const queryWords = queryLower.split(/\W+/).filter(word => word.length > 3 && !commonWords.includes(word));
  
  // Add important words as keywords
  queryWords.forEach(word => {
    if (!keywords.includes(word)) {
      keywords.push(word);
    }
  });
  
          return {
    primaryCategory,
    secondaryCategories,
    keywords
  };
}

/**
 * Maps product keywords to appropriate product categories
 * @param productKeywords List of detected product keywords
 * @returns List of product category tags
 */
function mapProductKeywordsToCategories(productKeywords: string[]): DocumentCategoryType[] {
  const categoryMap: Record<string, { category: DocumentCategoryType, keywords: string[] }> = {
    'recruiting': { 
      category: DocumentCategoryType.HIRING, 
      keywords: ['text-to-apply', 'text to apply', 'texting', 'sms', 'hiring', 'recruitment', 'recruiting', 'applicant tracking']
    },
    'onboarding': { 
      category: DocumentCategoryType.ONBOARDING, 
      keywords: ['onboarding', 'e-verify', 'everify', 'i9', 'forms', 'documents', 'background check', 'background screening', 'screening']
    },
    'payroll': { 
      category: DocumentCategoryType.PAYROLL, 
      keywords: ['payroll', 'payment', 'direct deposit']
    },
    'scheduling': { 
      category: DocumentCategoryType.SCHEDULING, 
      keywords: ['scheduling', 'schedule', 'shifts', 'time tracking']
    },
    'compliance': { 
      category: DocumentCategoryType.COMPLIANCE, 
      keywords: ['compliance', 'hr', 'human resources']
    },
    'integration': { 
      category: DocumentCategoryType.INTEGRATIONS, 
      keywords: ['integration', 'integrations', 'api']
    }
  };
  
  const categories = new Set<DocumentCategoryType>();
  
  productKeywords.forEach(keyword => {
    Object.values(categoryMap).forEach(({ category, keywords }) => {
      if (keywords.some(k => keyword.includes(k) || k.includes(keyword))) {
        categories.add(category);
      }
    });
  });
  
  return Array.from(categories);
}

/**
 * Extracts document references from previous conversation history
 * @param conversationHistory Array of previous messages
 * @returns Array of document references
 */
function extractPreviousDocumentReferences(conversationHistory: Array<{role: string; content: string}> = []): Array<{
  id: string;
  text: string;
  source: string;
  metadata: Record<string, any>;
}> {
  if (!conversationHistory || conversationHistory.length === 0) {
    return [];
  }

  const documentReferences: Array<{
    id: string;
    text: string;
    source: string;
    metadata: Record<string, any>;
  }> = [];

  // Only look at assistant messages as they would contain references to documents
  const assistantMessages = conversationHistory.filter(msg => 
    msg.role === 'assistant' || msg.role === 'bot'
  );

  // For each assistant message, try to extract source references
  // This is a simplistic approach - in production you would want to use 
  // a more sophisticated method to extract and match document references
  for (const message of assistantMessages) {
    // Look for explicit source citations in the format [n] or source {n}
    const sourceMatches = message.content.match(/\[([\d]+)\]|\{source: ?([\d]+)\}/g);
    
    if (sourceMatches && sourceMatches.length > 0) {
      // We found source references, but we need the actual document content
      // In a real system, you would look these up in your database
      // Here we're creating placeholder entries that would be populated from your database
      
      for (const match of sourceMatches) {
        const sourceId = match.match(/\[([\d]+)\]/) || match.match(/\{source: ?([\d]+)\}/);
        if (sourceId && sourceId[1]) {
          // Create a unique ID for this reference - make sure it's a string to avoid type issues
          const referenceId = `prev_doc_${sourceId[1]}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          
          // In a real implementation, you would look up the actual document
          // For now, we're creating a reference with the information we have
          // Note: We need to ensure these document references adhere to the expected structure
          documentReferences.push({
            id: referenceId,
            text: `This is a previously referenced document from the conversation.`,
            source: `Previous source [${sourceId[1]}]`,
            metadata: {
              isPreviouslyReferenced: true,
              sourceNumber: sourceId[1],
              fromMessage: message.content.substring(0, 100) + '...'
            }
    });
  }
}
    }
  }

  return documentReferences;
}


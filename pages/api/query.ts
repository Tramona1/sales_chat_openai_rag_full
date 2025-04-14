import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabase } from '../../utils/supabaseClient';
import { logInfo, logWarning, logError, logDebug } from '../../lib/logging';
import { testSupabaseConnection } from '../../lib/supabase';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import { recordMetric, metrics } from '../../lib/metrics';
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

// API handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Start timing the API call
  const startTime = Date.now();
  let success = false;

  try {
    // Check for required parameters
    if (!req.body || !req.body.query) {
      res.status(400).json({ error: 'Missing required parameters: query' });
      return;
    }
    
    // Extract parameters from request
    const {
      query: originalQuery,
      limit = 10,
      useContextualRetrieval = true,
      searchMode = 'hybrid'
    } = req.body;

    logInfo(`Processing query: "${originalQuery}"`);
    
    // Analyze the query to understand intent, entities, etc.
    const analysisStartTime = Date.now();
    const queryAnalysis = await analyzeQueryWithGemini(originalQuery);
    recordMetric('query', metrics.QUERY_ANALYSIS, Date.now() - analysisStartTime, true);
    
    // Check if we should rewrite the query to include "Workstream" context
    let queryToUse = originalQuery;
    let queryWasRewritten = false;
    
    // Only attempt query rewriting if the feature flag is enabled
    if (FEATURE_FLAGS.queryRewriting) {
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
      
      recordMetric('query', metrics.QUERY_REWRITE, Date.now() - rewriteStartTime, true);
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
    
    // Perform search based on selected mode, using the real implementations
    if (searchMode === 'hybrid' || searchMode === 'default') {
      try {
        // Use the real hybrid search implementation
        const hybridResults = await hybridSearch(queryToUse, searchOptions);
        searchResults = hybridResults.results || [];
      } catch (searchError) {
        logError('Error in hybrid search:', searchError);
        // Fall back to text search if hybrid search fails
        try {
          // For now, just do another hybrid search with different parameters
          const keywordResults = await hybridSearch(queryToUse, {
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
        const keywordResults = await hybridSearch(queryToUse, {
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
        const hybridResults = await hybridSearch(queryToUse, {
          ...searchOptions,
          // Add visual search parameters when implementing multimodal search
        });
        searchResults = hybridResults.results || [];
      } catch (multimodalError) {
        logError('Error in multimodal search:', multimodalError);
        searchResults = [];
      }
    }
    
    // Fallback search if no results - try query expansion
    if (searchResults.length === 0) {
      logWarning(`No results found for "${queryToUse}". Attempting expanded search.`);
      
      try {
        // Use the directly imported query expansion function
        const expandedQueryResult = await expandQuery(queryToUse);
        if (expandedQueryResult && expandedQueryResult.expandedQuery !== queryToUse) {
          logInfo(`Expanded query: "${queryToUse}" -> "${expandedQueryResult.expandedQuery}"`);
          const expandedResults = await hybridSearch(expandedQueryResult.expandedQuery, {
            ...searchOptions,
            vectorWeight: 0.4,
            keywordWeight: 0.6 // Emphasize keywords even more for expanded queries
          });
          searchResults = expandedResults.results || [];
        }
        
        // If still no results, try fallback search
        if (searchResults.length === 0) {
          logWarning(`No results from expanded search. Attempting fallback search.`);
          const fallbackResults = await fallbackSearch(queryToUse);
          searchResults = fallbackResults.map(item => ({
            ...item,
            score: item.score || 0.5 // Ensure score exists
          }));
          
          // If even fallback failed, try with original query in case rewriting caused issues
          if (searchResults.length === 0 && queryWasRewritten) {
            logWarning(`No results from fallback search. Trying original query: "${originalQuery}"`);
            const originalQueryResults = await fallbackSearch(originalQuery);
            searchResults = originalQueryResults.map(item => ({
              ...item,
              score: item.score || 0.5 // Ensure score exists
            }));
          }
        }
      } catch (fallbackError) {
        logError('Error in fallback search:', fallbackError);
      }
    }
    
    recordMetric('search', metrics.HYBRID_SEARCH, Date.now() - searchStartTime, searchResults.length > 0);
    
    // Convert search results to the SearchResultItem format
    const processedResults: SearchResultItem[] = searchResults.map(result => ({
      id: result.id,
      document_id: result.document_id,
      text: result.text || '',
      metadata: result.metadata || {}, // Keep general metadata here
      score: result.score || result.similarity || 0.5,
      vectorScore: result.vectorScore,
      keywordScore: result.keywordScore,
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
    }));

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
        
        recordMetric('search', metrics.RERANKING, Date.now() - rerankStartTime, true);
      } catch (rerankError) {
        logError('Error during reranking:', rerankError);
        recordMetric('search', metrics.RERANKING, Date.now() - rerankStartTime, false);
        // Continue with un-reranked results
      }
    }
    
    // Prepare context for answer generation
    const context = processedResults.map(result => ({
      text: result.text,
      source: result.metadata?.source || result.metadata?.url || 'Unknown source',
      relevance: result.score || 0,
      metadata: result.metadata || {} // Include full metadata for better context
    }));
    
    // Log some debug info about the search results
    if (processedResults.length > 0) {
      logInfo(`Found ${processedResults.length} results for query: "${queryToUse}"`);
      processedResults.slice(0, 3).forEach((result, idx) => {
        logInfo(`Result ${idx+1}: ${result.text.substring(0, 100)}...`);
      });
    } else {
      logWarning(`No results found for query: "${queryToUse}"`);
    }
    
    // Determine if we should include source citations based on result quality
    const includeCitations = FEATURE_FLAGS.sourceCitations && 
                            processedResults.length > 0 &&
                            processedResults.some(result => result.score > 0.4); // Only cite if we have decent results
    
    // Generate answer from search results using the real LLM-based implementation
    const answerStartTime = Date.now();
    
    // Create a customized system prompt for product queries
    let systemPrompt = modelConfig.getSystemPromptForQuery(originalQuery);
    
    // Add special instructions for product-related queries
    if (isProductQuery) {
      systemPrompt = `
You are a knowledgeable Sales Assistant for Workstream, a company providing HR, Payroll, and Hiring solutions for the hourly workforce.

When answering questions about Workstream's products and features, provide a comprehensive and structured response that:
1. Clearly lists and describes the relevant products/features mentioned in the context
2. Highlights key benefits and value propositions for each product
3. Organizes information in a logical way (e.g., by product category)
4. Includes specific capabilities and differentiators from the context
5. Maintains a helpful, informative tone appropriate for sales conversations

IMPORTANT INSTRUCTIONS:
- Answer based ONLY on the provided context
- For product-related questions, try to provide a comprehensive overview of multiple products when available
- If information about specific products is not in the context, be transparent about what IS available
- Avoid repeating the user's question in your response
- Do not make up information that isn't present in the context
- Focus on factual information about products, their features, and benefits
`;
      logInfo(`Using specialized product query system prompt`);
    }
    
    // If we have no results or poor results, add instructions to be honest about limitations
    if (processedResults.length === 0 || !processedResults.some(result => result.score > 0.3)) {
      systemPrompt += `

SPECIAL INSTRUCTION FOR LIMITED INFORMATION:
- The context provided does not contain sufficient information to answer this question in detail
- Please be HONEST and CLEAR that you don't have enough information in the provided context
- Avoid making up information or providing generic responses that imply you have knowledge you don't
- Suggest that the user ask about something you might be able to help with, such as Workstream's products or features
`;
      logInfo(`Adding limited information instruction to system prompt`);
    }
    
    const answer = await generateAnswer(originalQuery, context, {
      systemPrompt: systemPrompt,
      includeSourceCitations: includeCitations,
      maxSourcesInAnswer: 5,
    });
    recordMetric('query', metrics.ANSWER_GENERATION, Date.now() - answerStartTime, true);
    
    // Prepare and return the response
    success = true;
    res.status(200).json({
      query: originalQuery,
      answer,
      resultCount: processedResults.length,
      metadata: {
        queryAnalysis,
        queryWasRewritten,
        rewrittenQuery: queryWasRewritten ? queryToUse : undefined,
        isProductQuery,
        isVisualQuery: visualAnalysis.isVisualQuery,
        processingTimeMs: Date.now() - startTime
      }
    });
    
  } catch (error) {
    logError('Error processing query:', error);
    res.status(500).json({ 
      error: 'An error occurred while processing your query',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  } finally {
    // Record overall API metrics
    recordMetric('api', metrics.API_QUERY, Date.now() - startTime, success);
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

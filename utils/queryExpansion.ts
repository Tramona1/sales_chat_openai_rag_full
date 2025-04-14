/**
 * Query Expansion Module
 * 
 * This module provides functionality to expand user queries with related terms
 * to improve retrieval performance, especially for complex or ambiguous queries.
 */

// Import Gemini client functions and remove OpenAI client import
// import { generateChatCompletion, generateStructuredResponse } from './openaiClient'; 
import { generateStructuredGeminiResponse, generateGeminiChatCompletion } from './geminiClient'; 
import { tokenize } from './tokenization';
import { logError } from './logger';
import { getFromCache, cacheWithExpiry } from './caching';

/**
 * Configuration options for query expansion
 */
export interface QueryExpansionOptions {
  // Maximum number of expanded terms to add
  maxExpandedTerms: number;
  
  // Model to use for semantic expansion
  // Can use faster models for simple expansion
  model: string; // Should be a Gemini model now
  
  // Whether to use semantic expansion with LLMs
  useSemanticExpansion: boolean;
  
  // Whether to use keyword-based techniques
  useKeywordExpansion: boolean;
  
  // Balance between semantic and keyword expansion (0-1)
  // 1.0 = all semantic, 0.0 = all keyword
  semanticWeight: number;
  
  // Whether to include metadata like technical level in expanded query
  includeMetadata: boolean;
  
  // Timeout for semantic expansion in ms
  timeoutMs: number;
  
  // Enable caching of expansion results
  enableCaching: boolean;
  
  // Cache TTL in seconds
  cacheTtlSeconds: number;
  
  // Debug mode
  debug: boolean;
}

/**
 * Default options for query expansion
 */
export const DEFAULT_EXPANSION_OPTIONS: QueryExpansionOptions = {
  maxExpandedTerms: 4, // Reduced from 5 based on test results
  model: 'gemini-2.0-flash', // UPDATED: Use Gemini model
  useSemanticExpansion: true,
  useKeywordExpansion: true,
  semanticWeight: 0.7, // Favor semantic expansion by default
  includeMetadata: true,
  timeoutMs: 2000, // Reduced timeout for better performance
  enableCaching: true,
  cacheTtlSeconds: 86400, // 24 hours
  debug: false
};

/**
 * Result of query expansion
 */
export interface ExpandedQuery {
  originalQuery: string;
  expandedQuery: string;
  addedTerms: string[];
  expansionType: 'semantic' | 'keyword' | 'hybrid' | 'none';
  technicalLevel?: number; // 1-5 scale
  domainContext?: string; // e.g., 'pricing', 'technical', 'support'
  processingTimeMs?: number; // Tracking performance
}

/**
 * Expand a query using semantic techniques (LLM-based)
 * 
 * This approach uses language models to understand query intent
 * and generate related terms.
 */
export async function semanticQueryExpansion(
  query: string,
  options: Partial<QueryExpansionOptions> = {}
): Promise<string[]> {
  const config = { ...DEFAULT_EXPANSION_OPTIONS, ...options };
  const startTime = Date.now();
  
  // Try to get cached result if caching is enabled
  if (config.enableCaching) {
    const cacheKey = `semantic_expansion:${query}`;
    const cachedResult = getFromCache<string[]>(cacheKey);
    if (cachedResult && Array.isArray(cachedResult)) {
      if (config.debug) {
        console.log('Using cached semantic expansion results for query:', query);
      }
      return cachedResult;
    }
  }
  
  try {
    // Create system prompt for semantic expansion
    // This prompt should work reasonably well with Gemini too
    const systemPrompt = `You are an expert in information retrieval helping to improve search quality.
Your task is to expand the user's query with related terms to improve search results.
Focus on adding precise, targeted phrases that might appear in relevant documents.
The phrases should be concise (2-5 words) and directly related to the original query.
Do NOT change the original meaning or intent of the query.
Return ONLY a JSON array of additional search terms (no explanations).
Limit your response to the most effective expansion terms.`;

    // Create user prompt - using better instruction for more focused expansion
    const userPrompt = `Original Query: ${query}
    
Please provide up to ${config.maxExpandedTerms} additional phrases that would be effective for retrieving relevant documents.
Consider:
- Alternative terminology experts might use
- Specific phrases likely to appear in authoritative sources
- Terms that clarify ambiguous aspects of the query
- Focus on precision over recall

Return as a JSON array of strings.`;

    // Define the expected schema for the structured response
    const responseSchema = {
      type: "array",
      items: { type: "string" }
    };

    // Set up timeout for semantic expansion 
    // Note: Timeout implementation might need adjustment if geminiClient doesn't support AbortController directly
    // For now, we assume the geminiClient handles timeouts internally or we rely on default timeouts.
    // const controller = new AbortController(); 
    // const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      // Try structured response first using Gemini
      const result = await generateStructuredGeminiResponse(
        systemPrompt,
        userPrompt,
        responseSchema 
        // Pass model if needed by geminiClient function, assuming it uses config
        // config.model 
      );
      // clearTimeout(timeoutId); // Clear timeout if used

      if (Array.isArray(result)) {
        const validTerms = result
          .filter(term => 
            typeof term === 'string' && 
            term.length > 0 && 
            term.length < 60 && // Reasonable length limit
            !query.toLowerCase().includes(term.toLowerCase())
          )
          .slice(0, config.maxExpandedTerms);
          
        // Cache the result if caching is enabled
        if (config.enableCaching && validTerms.length > 0) {
          const cacheKey = `semantic_expansion:${query}`;
          await cacheWithExpiry(cacheKey, validTerms, config.cacheTtlSeconds);
        }
        
        return validTerms;
      }
    } catch (structuredError) {
      // If structured response fails, try fallback with Gemini chat
      if (config.debug) {
        console.log(`Structured expansion failed for "${query}". Using fallback.`);
      }
    }
    
    // Fallback to simpler expansion using Gemini chat completion
    try {
      const fallbackSystemPrompt = "You are a search query expansion expert. Provide only related search terms, no explanations.";
      const fallbackUserPrompt = `Generate ${config.maxExpandedTerms} search terms related to: "${query}"\nReturn one term per line, no numbering or bullets.`;
      
      const fallbackResponse = await generateGeminiChatCompletion(
        fallbackSystemPrompt,
        fallbackUserPrompt
        // Pass model if needed, assuming geminiClient uses config
        // config.model 
      );
      
      // Parse the response to extract terms (one per line)
      const terms = fallbackResponse
        .split('\\n')
        .map(line => line.trim().replace(/^[•\\-\\d.\\s]+/, '')) // Remove bullets, numbers
        .filter(line => 
          line && 
          !line.startsWith('-') && 
          line.length > 2 && 
          line.length < 60 &&
          !query.toLowerCase().includes(line.toLowerCase())
        )
        .slice(0, config.maxExpandedTerms);
      
      // Cache the result if caching is enabled
      if (config.enableCaching && terms.length > 0) {
        const cacheKey = `semantic_expansion:${query}`;
        await cacheWithExpiry(cacheKey, terms, config.cacheTtlSeconds);
      }
      
      return terms;
    } catch (fallbackError) {
      logError('semanticQueryExpansion:fallback', fallbackError);
      return []; // Return empty array if all methods fail
    }
  } catch (error) {
    logError('semanticQueryExpansion', error);
    return []; // Return empty array on error
  } finally {
    if (config.debug) {
      const duration = Date.now() - startTime;
      console.log(`Semantic expansion took ${duration}ms for query: \"${query}\"`);
    }
  }
}

/**
 * Expand a query using keyword-based techniques
 * 
 * This simpler approach uses word forms, common synonyms, and
 * domain-specific transformations.
 */
export function keywordQueryExpansion(
  query: string,
  options: Partial<QueryExpansionOptions> = {}
): string[] {
  const config = { ...DEFAULT_EXPANSION_OPTIONS, ...options };
  const startTime = Date.now();
  
  // Try to get cached result if caching is enabled
  if (config.enableCaching) {
    const cacheKey = `keyword_expansion:${query}`;
    const cachedResult = getFromCache<string[]>(cacheKey);
    if (cachedResult && Array.isArray(cachedResult)) {
      if (config.debug) {
        console.log(`Cache hit for keyword expansion of query: "${query}"`);
      }
      return cachedResult;
    }
  }
  
  try {
    // Tokenize the query
    const tokens = tokenize(query);
    const expandedTerms: string[] = [];
    const queryLower = query.toLowerCase();
    
    // Common business terms synonyms/related terms - expanded with more relevant terms
    const synonymMap: Record<string, string[]> = {
      'price': ['cost', 'pricing', 'fee', 'subscription', 'pricing plans'],
      'pricing': ['price', 'cost', 'fee', 'subscription', 'rate card'],
      'cost': ['price', 'pricing', 'expense', 'fee', 'budget'],
      'discount': ['offer', 'deal', 'promotion', 'reduced', 'savings', 'special offer'],
      'feature': ['capability', 'functionality', 'option', 'service', 'tool'],
      'security': ['protection', 'privacy', 'secure', 'encryption', 'data protection'],
      'support': ['help', 'assistance', 'service', 'customer service', 'technical support'],
      'compare': ['comparison', 'versus', 'vs', 'difference', 'competitive analysis'],
      'competitor': ['competition', 'alternative', 'rival', 'industry peer', 'market competitor'],
      'enterprise': ['business', 'corporate', 'company', 'organization', 'large company'],
      'plan': ['package', 'tier', 'subscription', 'offering', 'service level'],
      'basic': ['starter', 'standard', 'entry-level', 'fundamental', 'essential'],
      'professional': ['premium', 'advanced', 'expert', 'pro', 'business level'],
      'upgrade': ['enhance', 'improve', 'advance', 'move up', 'switch plans'],
      'team': ['group', 'staff', 'employees', 'workforce', 'personnel'],
      'user': ['account', 'seat', 'license', 'member', 'individual']
    };
    
    // Domain-specific transformations - more focused on query type
    // Pricing queries
    if (queryLower.includes('price') || queryLower.includes('cost') || queryLower.includes('pricing')) {
      expandedTerms.push('pricing plans');
      expandedTerms.push('subscription options');
      
      if (queryLower.includes('enterprise') || queryLower.includes('business') || queryLower.includes('corporate')) {
        expandedTerms.push('enterprise pricing');
        expandedTerms.push('business rates');
      }
      
      if (queryLower.includes('basic') || queryLower.includes('standard')) {
        expandedTerms.push('basic plan pricing');
        expandedTerms.push('standard tier cost');
      }
    }
    
    // Compare/competitor queries
    if (queryLower.includes('compare') || queryLower.includes('competitor') || queryLower.includes('vs')) {
      expandedTerms.push('versus competitors');
      expandedTerms.push('competitive advantage');
      expandedTerms.push('product comparison');
    }
    
    // Discount queries
    if (queryLower.includes('discount') || queryLower.includes('offer')) {
      expandedTerms.push('special pricing');
      expandedTerms.push('promotional discount');
      expandedTerms.push('volume discount');
      
      if (queryLower.includes('education') || queryLower.includes('student') || queryLower.includes('school')) {
        expandedTerms.push('educational discount');
        expandedTerms.push('academic pricing');
      }
    }
    
    // Feature queries
    if (queryLower.includes('feature') || queryLower.includes('include') || queryLower.includes('offer')) {
      expandedTerms.push('product features');
      expandedTerms.push('included capabilities');
      expandedTerms.push('service offerings');
    }
    
    // Add synonyms for each token
    for (const token of tokens) {
      const lowerToken = token.toLowerCase();
      if (synonymMap[lowerToken]) {
        // Add relevant synonyms
        expandedTerms.push(...synonymMap[lowerToken]);
      }
    }
    
    // Remove duplicates and limit to max terms
    const uniqueTerms = [...new Set(expandedTerms)]
      .filter(term => !queryLower.includes(term.toLowerCase()))
      .slice(0, config.maxExpandedTerms);
    
    // Cache the result if caching is enabled
    if (config.enableCaching && uniqueTerms.length > 0) {
      const cacheKey = `keyword_expansion:${query}`;
      cacheWithExpiry(cacheKey, uniqueTerms, config.cacheTtlSeconds);
    }
    
    if (config.debug) {
      const duration = Date.now() - startTime;
      console.log(`Keyword expansion took ${duration}ms for query: "${query}"`);
    }
    
    return uniqueTerms;
  } catch (error) {
    logError('keywordQueryExpansion', error);
    return []; // Return empty array on error
  }
}

/**
 * Analyze query to determine context for expansion (internal use)
 */
async function analyzeQueryExpansionContext(
  query: string
): Promise<{
  technicalLevel: number;
  domainContext: string;
  complexity: number;
}> {
  try {
    // Try to get cached result
    const cacheKey = `query_analysis:${query}`;
    const cachedResult = getFromCache<{
      technicalLevel: number;
      domainContext: string;
      complexity: number;
    }>(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }
    
    const systemPrompt = `You are an expert query analyzer. Analyze the given query and determine:
1. Technical level (1-5 scale where 1=basic, 5=highly technical)
2. Domain context (single word: pricing, technical, support, feature, comparison, general)
3. Complexity (1-5 scale where 1=simple, 5=complex)`;

    const userPrompt = `Query: ${query}
    
Please analyze this query and return a JSON object with technicalLevel (number 1-5), domainContext (string), and complexity (number 1-5).`;

    // Define the expected schema
    const responseSchema = {
      type: "object",
      properties: {
        technicalLevel: { type: "number", minimum: 1, maximum: 5 },
        domainContext: { type: "string", enum: ["pricing", "technical", "support", "feature", "comparison", "general"] },
        complexity: { type: "number", minimum: 1, maximum: 5 }
      },
      required: ["technicalLevel", "domainContext", "complexity"]
    };

    // Use Gemini structured response
    const result = await generateStructuredGeminiResponse(
      systemPrompt,
      userPrompt,
      responseSchema
      // Assuming geminiClient uses default model from config, or pass explicitly:
      // 'gemini-2.0-flash' 
    );
    
    const analysis = {
      technicalLevel: result?.technicalLevel || 1,
      domainContext: result?.domainContext || 'general',
      complexity: result?.complexity || 1
    };
    
    // Cache the result
    await cacheWithExpiry(cacheKey, analysis, 86400); // 24 hours TTL
    
    return analysis;
  } catch (error) {
    logError('analyzeQueryExpansionContext', error);
    return {
      technicalLevel: 1,
      domainContext: 'general',
      complexity: 1
    };
  }
}

/**
 * Main function to expand a query using multiple techniques
 */
export async function expandQuery(
  query: string,
  options: Partial<QueryExpansionOptions> = {}
): Promise<ExpandedQuery> {
  const config = { ...DEFAULT_EXPANSION_OPTIONS, ...options };
  let expansionType: 'semantic' | 'keyword' | 'hybrid' | 'none' = 'none';
  let addedTerms: string[] = [];
  const startTime = Date.now();
  
  try {
    if (config.debug) {
      console.log(`Expanding query: "${query}"`);
    }
    
    // Try to get cached full expansion result
    if (config.enableCaching) {
      const cacheKey = `full_expansion:${query}:${config.useSemanticExpansion}:${config.useKeywordExpansion}:${config.maxExpandedTerms}`;
      const cachedResult = getFromCache<ExpandedQuery>(cacheKey);
      if (cachedResult) {
        if (config.debug) {
          console.log('Using cached query expansion results for query:', query);
        }
        return cachedResult;
      }
    }
    
    // Analyze query for context (technical level, domain)
    let analysis = { technicalLevel: 1, domainContext: 'general', complexity: 1 };
    if (config.includeMetadata) {
      try {
        analysis = await analyzeQueryExpansionContext(query);
      } catch (analysisError) {
        logError('Failed to analyze query context for expansion', analysisError);
        // Use defaults if analysis fails
      }
    }
    
    // Adjust semantic/keyword weights based on query characteristics
    let dynamicSemanticWeight = config.semanticWeight;
    
    // More complex or technical queries benefit from semantic expansion
    if (analysis.complexity > 3 || analysis.technicalLevel > 3) {
      dynamicSemanticWeight = Math.min(0.9, dynamicSemanticWeight + 0.2);
    }
    
    // Simple pricing or feature queries often do well with keyword expansion
    if (analysis.complexity < 2 && 
        (analysis.domainContext === 'pricing' || analysis.domainContext === 'feature')) {
      dynamicSemanticWeight = Math.max(0.3, dynamicSemanticWeight - 0.2);
    }
    
    if (config.debug) {
      console.log(`Query analysis: level=${analysis.technicalLevel}, domain=${analysis.domainContext}, complexity=${analysis.complexity}`);
      console.log(`Using semantic weight: ${dynamicSemanticWeight}`);
    }
    
    // Start with an empty set of added terms
    addedTerms = [];
    
    // Try semantic expansion if enabled
    const semanticTerms: string[] = [];
    if (config.useSemanticExpansion) {
      const semResults = await semanticQueryExpansion(query, {
        ...config,
        maxExpandedTerms: Math.ceil(config.maxExpandedTerms * dynamicSemanticWeight)
      });
      
      if (semResults.length > 0) {
        semanticTerms.push(...semResults);
        expansionType = 'semantic';
      }
    }
    
    // Add keyword-based expansion if enabled
    const keywordTerms: string[] = [];
    if (config.useKeywordExpansion) {
      const kwResults = keywordQueryExpansion(query, {
        ...config,
        maxExpandedTerms: Math.ceil(config.maxExpandedTerms * (1 - dynamicSemanticWeight))
      });
      
      if (kwResults.length > 0) {
        keywordTerms.push(...kwResults);
        expansionType = semanticTerms.length > 0 ? 'hybrid' : 'keyword';
      }
    }
    
    // Combine results based on weights
    if (semanticTerms.length > 0 && keywordTerms.length > 0) {
      // Calculate how many terms to take from each source
      const semanticCount = Math.min(
        semanticTerms.length,
        Math.max(1, Math.round(config.maxExpandedTerms * dynamicSemanticWeight))
      );
      
      const keywordCount = Math.min(
        keywordTerms.length,
        config.maxExpandedTerms - semanticCount
      );
      
      addedTerms = [
        ...semanticTerms.slice(0, semanticCount),
        ...keywordTerms.slice(0, keywordCount)
      ];
      
      expansionType = 'hybrid';
    } else {
      // Just add whatever we have
      addedTerms = [...semanticTerms, ...keywordTerms];
    }
    
    // Remove duplicates and filter out terms already in the query
    addedTerms = [...new Set(addedTerms)]
      .filter(term => !query.toLowerCase().includes(term.toLowerCase()))
      .slice(0, config.maxExpandedTerms);
    
    // Create expanded query by combining original with added terms
    const expandedQuery = addedTerms.length > 0
      ? `${query} ${addedTerms.join(' ')}`
      : query;
    
    if (config.debug) {
      console.log(`Original query: "${query}"`);
      console.log(`Expanded query: "${expandedQuery}"`);
      console.log(`Added terms: ${addedTerms.join(', ')}`);
      console.log(`Expansion type: ${expansionType}`);
    }
    
    const result = {
      originalQuery: query,
      expandedQuery,
      addedTerms,
      expansionType,
      technicalLevel: analysis.technicalLevel,
      domainContext: analysis.domainContext,
      processingTimeMs: Date.now() - startTime
    };
    
    // Cache the result
    if (config.enableCaching && addedTerms.length > 0) {
      const cacheKey = `full_expansion:${query}:${config.useSemanticExpansion}:${config.useKeywordExpansion}:${config.maxExpandedTerms}`;
      await cacheWithExpiry(cacheKey, result, config.cacheTtlSeconds);
    }
    
    return result;
  } catch (error) {
    logError('expandQuery', error);
    const processingTime = Date.now() - startTime;
    
    // Return original query on error
    return {
      originalQuery: query,
      expandedQuery: query,
      addedTerms: [],
      expansionType: 'none',
      processingTimeMs: processingTime
    };
  }
} 
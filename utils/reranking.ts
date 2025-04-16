/**
 * Multi-Modal Reranking Module
 * 
 * This module applies LLM-based reranking to improve search result ordering,
 * with specialized handling for multi-modal content using Gemini.
 */

import { generateStructuredGeminiResponse } from './geminiClient';
import { logError, logWarning, logInfo, logDebug, logApiCall } from './logger';
import { getModelForTask } from './modelConfig';
import { analyzeVisualQuery } from './queryAnalysis';
import { recordMetric } from './performanceMonitoring';

/**
 * Interface for visual content in multi-modal vector store items
 */
export interface VisualContent {
  /** Type of visual (image, chart, table, diagram) */
  type: string;
  
  /** Description of the visual content */
  description?: string;
  
  /** Text extracted from the visual */
  extractedText?: string;
  
  /** For charts/tables, structured data representation */
  structuredData?: any;
  
  /** Other properties */
  [key: string]: any;
}

/**
 * Base type for all search results
 */
export interface BaseSearchResult {
  item: {
    id: string;
    text: string;
    metadata: {
      category?: string;
      technicalLevel?: number;
      [key: string]: any;
    };
    [key: string]: any;
  };
  score: number;
}

/**
 * Enhanced type for multi-modal content
 */
export interface MultiModalSearchResult extends BaseSearchResult {
  item: BaseSearchResult['item'] & {
    visualContent?: VisualContent | VisualContent[];
  };
  matchType?: string;
  matchedVisual?: VisualContent;
}

/**
 * Type for ranked results
 */
export interface RankedSearchResult extends MultiModalSearchResult {
  originalScore?: number;
  explanation?: string;
  item: MultiModalSearchResult['item'] & {
    metadata: MultiModalSearchResult['item']['metadata'] & {
      rerankScore?: number;
      originalScore?: number;
    };
  };
}

/**
 * Options for multi-modal reranking with Gemini
 */
export interface MultiModalRerankOptions {
  /** Maximum number of results to return */
  limit?: number;
  
  /** Whether to include scores in the results */
  includeScores?: boolean;
  
  /** Whether to include visual context during reranking */
  useVisualContext?: boolean;
  
  /** Whether to prioritize visual results for visual queries */
  visualFocus?: boolean;
  
  /** Types of visuals to prioritize (if visual focus is enabled) */
  visualTypes?: string[];
  
  /** Maximum time to wait for reranking (ms) */
  timeoutMs?: number;
}

/**
 * Temporary interface for items being prepared for reranking
 */
interface ItemToRerank {
  id: number;
  text: string;
  visualContext: string;
  initialScore: number;
  hasMatchedVisual: boolean;
  matchType: string;
  visualTypes: string[];
  hasVisualTypeMatch: boolean;
  primaryCategory?: string;
  contentQualityScore?: number;
}

/**
 * Structure for Gemini reranker response items
 */
interface RankerResponseItem {
  id: number;
  score: number;
  reason: string;
}

/**
 * Extract visual context from an item
 * @param item The item to extract visual context from
 * @returns A string representation of the visual context
 */
function extractVisualContext(item: any): { 
  visualContextInfo: string; 
  visualTypesList: string[];
} {
  // Initialize with safe defaults
  let visualContextInfo = '';
  let visualTypesList: string[] = [];
  
  try {
    // Early return if item is invalid
    if (!item) return { visualContextInfo, visualTypesList };
    
    // Safely access metadata
    const metadata = item.metadata || {};
    
    // Extract visual content information with robust checks
    if (item.visualContent && Array.isArray(item.visualContent) && item.visualContent.length > 0) {
      try {
        // Process each visual element
        const visualDescriptions = item.visualContent
          .filter((visual: any) => visual != null) // Filter out null entries
          .map((visual: VisualContent) => {
            try {
              // Track the visual type, with null check
              const visualType = visual.type ? visual.type.toString() : 'unknown';
              if (visualType && !visualTypesList.includes(visualType)) {
                visualTypesList.push(visualType);
              }
              
              // Safely construct visual description
              let visualDesc = `[${(visualType || 'UNKNOWN').toUpperCase()}]: ${visual.description || 'No description available'}`;
              
              // Add extracted text if available
              if (visual.extractedText || visual.detectedText) {
                const extractedText = visual.extractedText || visual.detectedText;
                visualDesc += `\nText in visual: ${extractedText}`;
              }
              
              // Add structured data summary if available with better error handling
              if (visual.structuredData || visual.data) {
                try {
                  const structuredData = visual.structuredData || visual.data;
                  let structuredDataSummary = '';
                  
                  if (typeof structuredData === 'object' && structuredData !== null) {
                    try {
                      structuredDataSummary = JSON.stringify(structuredData).substring(0, 150) + '...';
                    } catch (e) {
                      structuredDataSummary = 'Complex structured data (could not stringify)';
                    }
                  } else if (structuredData !== null && structuredData !== undefined) {
                    structuredDataSummary = String(structuredData).substring(0, 150) + '...';
                  } else {
                    structuredDataSummary = 'No structured data available';
                  }
                  
                  visualDesc += `\nStructured data: ${structuredDataSummary}`;
                } catch (e) {
                  // Ignore structured data if it causes issues
                  console.warn('Error processing structured data:', e);
                }
              }
              
              // Add figure number if available
              if (visual.figureNumber) {
                visualDesc += `\nFigure #${visual.figureNumber}`;
              }
              
              return visualDesc;
            } catch (error) {
              console.warn('Error processing visual element:', error);
              return 'Error processing visual element';
            }
          })
          .filter(Boolean) // Remove any nulls or empty strings
          .join('\n\n');
        
        if (visualDescriptions) {
          visualContextInfo = `VISUAL CONTENT:\n${visualDescriptions}\n\n`;
        }
      } catch (error) {
        console.warn('Error processing visual content array:', error);
        visualContextInfo = 'VISUAL CONTENT: Error processing visual elements\n\n';
      }
    }
    // Or if we have metadata about visual elements
    else if (metadata.isVisualElement || metadata.hasVisualContent || metadata.hasVisualElements) {
      visualContextInfo = 'VISUAL CONTENT:\n';
      
      if (metadata.isVisualElement && metadata.visualElementType) {
        const elementType = metadata.visualElementType || 'unknown';
        visualContextInfo += `[${elementType.toUpperCase()}]: This is a visual element`;
        
        // Add to visual types list
        if (!visualTypesList.includes(elementType)) {
          visualTypesList.push(elementType);
        }
      } else if (metadata.hasVisualContent || metadata.hasVisualElements) {
        visualContextInfo += 'Contains visual elements that may be relevant to the query';
      }
      
      if (metadata.visualElementTypes && Array.isArray(metadata.visualElementTypes)) {
        // Handle empty or invalid arrays
        if (metadata.visualElementTypes.length === 0) {
          visualContextInfo += '\nVisual types: none specified';
        } else {
          const typesText = metadata.visualElementTypes
            .filter((type: string | null | undefined) => type != null) // Filter out nulls with proper typing
            .join(', ') || 'unknown';
          visualContextInfo += `\nVisual types: ${typesText}`;
          
          // Add to visual types list
          for (const vType of metadata.visualElementTypes) {
            if (vType && !visualTypesList.includes(vType)) {
              visualTypesList.push(vType);
            }
          }
        }
      }
    }
    
    return { visualContextInfo, visualTypesList };
  } catch (error) {
    console.error('Error in extractVisualContext:', error);
    // Return empty values on error
    return { visualContextInfo: '', visualTypesList: [] };
  }
}

// Helper function to detect low-value boilerplate content
function isLikelyBoilerplateContent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  const boilerplateIndicators = [
    /this (website|site) (uses|stores) cookies/i,
    /cookie (policy|notice|preferences|settings)/i,
    /privacy (policy|notice|statement)/i,
    /terms (of service|of use|and conditions)/i,
    /all rights reserved/i,
    /copyright © \d{4}/i,
    /by (using|continuing to use|browsing) (this|our) (site|website)/i,
    /we (use|collect) (personal information|data|cookies)/i,
    /login|sign in|create( an)? account|forgot password/i,
    /contact (us|form|details|information)/i,
    /follow us on/i,
    /share (this|on)/i,
    /subscribe to (our|the) newsletter/i,
    /404 (not found|error)/i,
  ];

  // Check for multiple indicators
  let matchCount = 0;
  for (const indicator of boilerplateIndicators) {
    if (indicator.test(text)) {
      matchCount++;
      // If we find multiple matches, it's very likely boilerplate
      if (matchCount >= 2) return true;
    }
  }

  // Check content length - very short content is often navigation or headers
  if (text.length < 100 && /copyright|rights reserved|privacy|terms|cookies/i.test(text)) {
    return true;
  }

  // Check ratio of navigation/boilerplate terms to content length
  const boilerplateTerms = ['home', 'about', 'contact', 'privacy', 'terms', 'cookies', 
                           'login', 'sign in', 'register', 'copyright', 'all rights'];
  let termCount = 0;
  for (const term of boilerplateTerms) {
    if (text.toLowerCase().includes(term)) {
      termCount++;
    }
  }

  // If more than 25% of the text consists of boilerplate terms, it's likely boilerplate
  if (termCount > 3 && text.length < termCount * 50) {
    return true;
  }

  return false;
}

/**
 * Specialized reranking function for multi-modal content using Gemini
 * This reranker is designed to process both text and visual context
 * 
 * @param query The user query
 * @param results The search results to rerank
 * @param options Reranking options
 * @returns Reranked results optimized for multi-modal content
 */
export async function rerankWithGemini(
  query: string,
  results: MultiModalSearchResult[],
  options: MultiModalRerankOptions = {}
): Promise<RankedSearchResult[]> {
  const limit = options.limit || 5;
  const includeScores = options.includeScores ?? true;
  const targetVisualTypes = (options.visualTypes || []).map(t => t.toLowerCase());
  const validResults = results.filter(r => r && r.item);
  if (validResults.length === 0) { return []; }

  // Pre-filter results to remove obvious junk content
  const filteredResults = validResults.filter(result => {
    const textContent = result.item?.text || '';
    // Only filter out if it's clearly boilerplate
    if (isLikelyBoilerplateContent(textContent)) {
      logInfo(`[Reranking] Filtered out boilerplate content: "${textContent.substring(0, 100)}..."`);
      return false;
    }
    return true;
  });

  // If we filtered everything out, fall back to the original results
  if (filteredResults.length === 0) {
    logWarning('[Reranking] All results were filtered as boilerplate, using original results');
    // Continue with original results in this case
  }
  
  const resultsToRank = filteredResults.length > 0 ? filteredResults : validResults;
  
  // Get visual focus info (assuming this part exists or is needed)
  // Placeholder: You might need to add this back if it was removed or is elsewhere
  let queryHasVisualFocus = options.visualFocus ?? false;
  // if (!options.visualFocus && query) { // Example logic if needed
  //   const visualAnalysis = analyzeVisualQuery(query);
  //   queryHasVisualFocus = visualAnalysis.isVisualQuery;
  // }

  const startTime = Date.now();
  const modelName = 'gemini-2.0-flash'; // Define model used for logging

  try {
    // Prepare items for reranking
    const itemsToRerank: ItemToRerank[] = resultsToRank.map((result, index) => {
        const item = result?.item || {};
        const metadata = item.metadata || {};
        const { visualContextInfo, visualTypesList } = extractVisualContext(item);
        const textContent = item.text || item.originalText || '';
        const hasMatchedVisual = result && result.matchedVisual !== undefined;
        const matchType = result?.matchType || 'text';
        const hasVisualTypeMatch = targetVisualTypes.length > 0 && visualTypesList.length > 0 && 
          visualTypesList.some(vType => {
          if (!vType) return false;
            const vTypeLower = vType.toLowerCase();
            return targetVisualTypes.some(tType => {
            if (!tType) return false;
              const tTypeLower = tType.toLowerCase();
              return vTypeLower.includes(tTypeLower) || tTypeLower.includes(vTypeLower);
            });
          });
        const qualityScoreValue = metadata.contentQualityScore;
        const qualityScore = typeof qualityScoreValue === 'number'
                           ? Math.min(1, Math.max(0, qualityScoreValue))
                           : undefined;
      const primaryCategory = metadata.primaryCategory;
        
        return {
          id: index,
        text: textContent,
        visualContext: visualContextInfo,
          initialScore: typeof result.score === 'number' ? result.score : 0,
        hasMatchedVisual: !!hasMatchedVisual,
        matchType: matchType,
        visualTypes: visualTypesList,
        hasVisualTypeMatch: !!hasVisualTypeMatch,
        primaryCategory: primaryCategory,
          contentQualityScore: qualityScore,
        };
    });

    // Format items for the prompt
    const formattedItems = itemsToRerank.map(item => (
      `Document ID: ${item.id}\n` +
      `Initial Score: ${item.initialScore.toFixed(4)}\n` +
      (item.primaryCategory ? `Category: ${item.primaryCategory}\n` : '') +
      (item.matchType !== 'unknown' ? `Match Type: ${item.matchType}\n` : '') +
      // Limit visual context to avoid excessively large prompts
      (item.visualContext ? `Visual Context: ${item.visualContext.substring(0, 500)}${item.visualContext.length > 500 ? '...' : ''}\n` : '') +
      // Limit text content to avoid excessively large prompts
      `Text: ${item.text.substring(0, 800)}...`
    )).join('\n---\n');

    // Construct the system prompt dynamically based on options
    const systemPrompt = `You are a Multi-Modal Search Ranker. Score each document 0–10 based on how well it directly and completely answers the query. Consider both text and visuals if present.

Scoring Guide:
- 10: Precise, complete answer.
- 7–9: Relevant and mostly complete.
- 4–6: Somewhat relevant, incomplete or vague.
- 1–3: Loosely related or shallow.
- 0: Irrelevant or boilerplate.

Principles:
- Prefer documents that explicitly answer the question over general context.
- Use visuals (e.g., charts, tables, images) only if they improve understanding.
- Penalize low-value content: cookie banners, login prompts, legal disclaimers.

If contentQualityScore is present:
- Prefer higher scores if documents are equally relevant.
- Downrank very low scores (< 0.5) if content is borderline.
`;

    const userPrompt = `Documents to Rank:
      ${formattedItems}
      
JSON Output:`;

    // Define response schema
    const responseSchema = {
        ranked_items: {
            type: "array",
      items: {
                type: "object",
        properties: {
                    id: { type: "number" },
                    score: { type: "number" },
                    reason: { type: "string" },
                },
                required: ["id", "score", "reason"],
            },
        }
    };

    // Call Gemini API
    logDebug('[API Reranking] Calling Gemini for reranking');
    const apiCallStartTime = Date.now();
    let rerankerResponse: any = null;
    let apiError: any = null;

    try {
      rerankerResponse = await generateStructuredGeminiResponse(
        systemPrompt,
        userPrompt,
        responseSchema
      );
      logInfo('[API Reranking] Gemini Reranking Success');
      logApiCall('gemini', 'rerank', 'success', Date.now() - apiCallStartTime, undefined, { model: modelName });
    } catch (error) {
      apiError = error;
      logError('[API Reranking] Gemini Reranking Error', { error: error instanceof Error ? error.message : String(error) });
      logApiCall('gemini', 'rerank', 'error', Date.now() - apiCallStartTime, error instanceof Error ? error.message : String(error), { model: modelName });
      throw error; // Re-throw to trigger fallback
    }
    
    // Process rerankerResponse and map back to results
    // Check if the response has the expected 'ranked_items' key
    let rankedItems: RankerResponseItem[] = [];
    if (rerankerResponse && rerankerResponse.ranked_items && Array.isArray(rerankerResponse.ranked_items)) {
       rankedItems = rerankerResponse.ranked_items;
    } else if (typeof rerankerResponse === 'string') {
       // Try to parse JSON from string response
       try {
         // Look for JSON pattern in the response
         const jsonMatch = rerankerResponse.match(/\{[\s\S]*"ranked_items"[\s\S]*\}/);
         if (jsonMatch) {
           const parsedJson = JSON.parse(jsonMatch[0]);
           if (parsedJson.ranked_items && Array.isArray(parsedJson.ranked_items)) {
             rankedItems = parsedJson.ranked_items;
             logWarning('[Reranking] Had to extract JSON from string response');
           }
         } else {
           logError('[Reranking] Could not extract JSON from string response', { responsePreview: rerankerResponse.substring(0, 100) });
           throw new Error('Invalid reranker response format');
         }
       } catch (jsonError) {
         logError('[Reranking] Failed to parse JSON from string response', jsonError);
         throw new Error('JSON parsing error');
       }
    } else {
       logError('[Reranking] Invalid or unexpected response structure from Gemini reranker (missing ranked_items array)', rerankerResponse);
       throw new Error('Invalid reranker response structure');
    }

    const rankedItemsMap = new Map<number, { score: number; reason: string }>();
    rankedItems.forEach((item: RankerResponseItem) => {
      if (typeof item.id === 'number' && typeof item.score === 'number' && typeof item.reason === 'string') {
         rankedItemsMap.set(item.id, { score: item.score, reason: item.reason });
      } else {
         logWarning(`[Reranking] Skipping invalid ranked item: ${JSON.stringify(item)}`);
      }
    });

    const finalResults = resultsToRank
      .map((originalResult, index) => {
        const rerankInfo = rankedItemsMap.get(index);
        const rerankScore = rerankInfo ? Math.min(10, Math.max(0, rerankInfo.score)) : 5;
        const explanation = rerankInfo ? rerankInfo.reason : 'Reranking info unavailable';
        const combinedScore = (originalResult.score + (rerankScore / 10)) / 2;

          return {
            ...originalResult,
          score: combinedScore,
          originalScore: originalResult.score,
          explanation: explanation,
            item: {
            ...originalResult.item,
              metadata: {
              ...originalResult.item.metadata,
              rerankScore: rerankScore / 10,
              originalScore: originalResult.score
            }
            }
          } as RankedSearchResult;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    recordMetric('reranking', 'gemini', Date.now() - startTime, true, { resultCount: finalResults.length, inputCount: results.length });
    return finalResults;
      
  } catch (error) {
    // Outer catch handles errors from API call or response processing
    // API call logging is done in the inner try/catch
    logError('[Reranker] Error during Gemini reranking:', error); // Keep outer log
    recordMetric('reranking', 'gemini', Date.now() - startTime, false, { error: error instanceof Error ? error.message : String(error), inputCount: results.length });

    // Corrected call to applyFallbackReranking - ensure options object is passed
    return applyFallbackReranking(validResults, {
      query,
      limit,
      visualFocus: options.visualFocus || false,
      targetVisualTypes: targetVisualTypes,
      includeScores: includeScores,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Apply a simple heuristic-based fallback reranking when Gemini reranking fails
 * This ensures we still get reasonable results even if the LLM-based reranking fails
 */
function applyFallbackReranking(
  results: MultiModalSearchResult[],
  options: {
    query: string;
    limit: number;
    visualFocus: boolean;
    targetVisualTypes: string[];
    includeScores: boolean;
    error?: string;
  }
): RankedSearchResult[] {
  logWarning(`[Reranking] Applying fallback ranking due to error: ${options.error || 'Unknown error'}`);

  // Simple fallback: Sort by original score, potentially boosting visual matches slightly
  const fallbackResults = results.map((r, index) => {
    let boost = 0;
    const { visualTypesList } = extractVisualContext(r.item);
    const hasVisualMatch = options.targetVisualTypes.length > 0 &&
                           visualTypesList.some(vt => options.targetVisualTypes.includes(vt.toLowerCase()));

    if (options.visualFocus && hasVisualMatch) {
      boost = 0.05; // Small boost for visual match in visual query
    }

        return {
          ...r,
      score: r.score + boost, // Apply slight boost
      originalScore: r.score,
      explanation: `Fallback ranking applied: ${options.error || 'Reranker error'}`,
          item: {
        ...r.item,
        id: r.item?.id || `fallback-${index}`, // Ensure ID exists
            metadata: {
          ...r.item?.metadata,
          rerankScore: r.score + boost, // Store boosted score as rerank score
          originalScore: r.score,
            }
          }
        } as RankedSearchResult;
  });

  return fallbackResults
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit);
} 
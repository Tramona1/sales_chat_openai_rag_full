/**
 * Multi-Modal Reranking Module
 * 
 * This module applies LLM-based reranking to improve search result ordering,
 * with specialized handling for multi-modal content using Gemini.
 */

import { generateStructuredGeminiResponse } from './geminiClient';
import { logError, logWarning } from './logger';
import { getModelForTask } from './modelConfig';
import { analyzeVisualQuery } from './queryAnalysis';

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

  // Get visual focus info (assuming this part exists or is needed)
  // Placeholder: You might need to add this back if it was removed or is elsewhere
  let queryHasVisualFocus = options.visualFocus ?? false;
  // if (!options.visualFocus && query) { // Example logic if needed
  //   const visualAnalysis = analyzeVisualQuery(query);
  //   queryHasVisualFocus = visualAnalysis.isVisualQuery;
  // }

  try {
    // Prepare items for reranking
    const itemsToRerank: ItemToRerank[] = validResults.map((result, index) => {
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
      (item.visualContext ? `Visual Context: ${item.visualContext}\n` : '') +
      `Text: ${item.text.substring(0, 1000)}...`
    )).join('\n---\n');

    // *** NEW GENERALIZED SYSTEM PROMPT ***
    const systemPrompt = `
You are a specialized Multi-Modal Search Result Evaluator. Your task is to rank search results by relevance to the user's query, considering text, visual context (if provided), and content quality score (if provided).

Assign a score from 0-10 for each result based on how well it DIRECTLY and COMPLETELY answers the user's specific question:
- 10: Perfect match. Contains a direct, complete, and accurate answer to the query.
- 7-9: Highly relevant. Contains most of the key information needed for a direct answer, perhaps missing minor details.
- 4-6: Moderately relevant. Addresses the topic but provides only partial information or requires significant inference to answer the query. Contains useful related context.
- 1-3: Slightly relevant. Mentions keywords or concepts from the query but doesn't meaningfully contribute to answering it. General background information.
- 0: Completely irrelevant.

**KEY EVALUATION PRINCIPLES:**

1.  **Directness:** Prioritize documents that provide a direct answer over documents that only discuss the topic generally. If the query asks for a specific fact, list, name, or definition, documents containing that specific information are much more relevant than documents just talking about the surrounding subject.
2.  **Completeness & Specificity:** For questions asking "Who...", "What...", "List...", "How many...", or seeking specific details, documents that provide explicit lists, names, numbers, or the requested details are significantly more relevant than those offering only vague descriptions or single examples. Prefer completeness.
3.  **Query Intent:** Consider the implied intent. A "How to..." query requires procedural steps. A "Why..." query requires explanations. A "Compare..." query needs information on both items being compared. Rank based on how well the document fulfills that specific intent.

**DOWN-RANKING / SPECIAL CASES:**
- Job Postings: Check the 'Category'. If 'HIRING' or 'JOB_POSTING', significantly lower its score (e.g., subtract 3-5 points or cap at 3) UNLESS the query explicitly asks about jobs/hiring/careers/titles/locations in a hiring context.
- Boilerplate/Navigation: Documents consisting primarily of navigation links, footers, or repetitive boilerplate with only keyword mentions should receive very low scores (0-2).

**CONTENT QUALITY SCORE (If Provided):**
- Each document may include a 'Quality' score (0-1). Relevance to the query is PRIMARY.
- If documents are similarly relevant, slightly prefer higher Quality scores (> 0.8).
- You MAY slightly penalize documents with very low Quality scores (< 0.5) if relevance is borderline. Use it as a secondary signal ONLY.

**MULTI-MODAL EVALUATION (If Applicable):**
${queryHasVisualFocus ? `
- This query is SPECIFICALLY ABOUT VISUAL CONTENT. Prioritize results containing relevant visual elements, especially types: ${targetVisualTypes.join(', ') || 'any'}. Text-only results should be downranked unless exceptionally relevant.` : `
- This query is primarily about textual information. Consider if visual elements described in the context enhance understanding or provide supplementary information.`
}
- Visual Content Evaluation Guidelines: Evaluate relevance of visual descriptions, charts/diagrams/tables data, and image content to the query.
- Scoring Adjustments: Apply scoring adjustments for visuals AFTER establishing the core relevance score based on the directness/completeness of the answer to the query intent.

**OUTPUT FORMAT:**
IMPORTANT: Your response must be a valid JSON array of objects, where each object has 'id', 'score', and 'reason' properties. The 'reason' should briefly justify the score based on the principles above (directness, completeness, intent, quality, visual relevance).
`;
    // *** END NEW GENERALIZED SYSTEM PROMPT ***

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
    const rerankerResponse = await generateStructuredGeminiResponse(
      systemPrompt,
      userPrompt,
      responseSchema
    );
    
    // Process rerankerResponse and map back to results
    // Check if the response has the expected 'ranked_items' key
    let rankedItems: RankerResponseItem[] = [];
    if (rerankerResponse && rerankerResponse.ranked_items && Array.isArray(rerankerResponse.ranked_items)) {
       rankedItems = rerankerResponse.ranked_items;
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

    const finalResults = validResults
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

    return finalResults;
      
  } catch (error) {
    logError('Error during Gemini reranking:', error);
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
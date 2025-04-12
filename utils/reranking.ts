/**
 * Reranking Module for Smart Query Routing
 * 
 * This module applies LLM-based reranking to improve search result ordering.
 */

import { generateStructuredResponse } from './openaiClient';
import { generateStructuredGeminiResponse } from './geminiClient';
import { logError } from './logger';
import { HybridSearchResult } from './hybridSearch';
import { getModelForTask } from './modelConfig';

/**
 * Reranking configuration options
 */
export interface RerankOptions {
  // Provider for reranking ('openai' or 'gemini')
  provider?: 'openai' | 'gemini';
  
  // Model to use for reranking
  model?: string;
  
  // Maximum time to wait for reranking
  timeoutMs?: number;
  
  // Whether to include explanation in results
  includeExplanations?: boolean;
  
  // Whether to use contextual information in reranking
  useContextualInfo?: boolean;
}

/**
 * Result from the reranking process
 */
export interface RerankResult {
  // Original search result
  original: HybridSearchResult;
  
  // Relevance score (0-10) from reranker
  relevanceScore: number;
  
  // Optional explanation
  explanation?: string;
}

/**
 * Reranks search results based on relevance to the query
 * 
 * @param query The original user query
 * @param results The search results to rerank
 * @param topK Number of top results to return
 * @param options Optional reranking configuration
 * @returns Reranked results (topK of them)
 */
export async function rerank(
  query: string,
  results: any[],
  topK: number = results.length,
  options: RerankOptions = {}
): Promise<any[]> {
  // No need to rerank if we have 0 or 1 results
  if (results.length <= 1) {
    return results;
  }
  
  try {
    // Convert results to HybridSearchResult format if needed
    const hybridResults = results.map((result: any, index: number) => {
      try {
        // If it's already a HybridSearchResult, return it as is
        if (result && result.metadata && result.bm25Score !== undefined && result.vectorScore !== undefined) {
          return result;
        }
        
        // Safely extract the item, or use the result itself if item is undefined
        const item = result ? (result.item || result) : null;
        
        // Handle the case where both result and item could be undefined
        if (!item) {
          console.log(`[Reranking] Warning: Empty result at index ${index}, creating placeholder`);
          return {
            item: {
              id: `empty-${Math.random().toString(36).substring(2, 9)}`,
              text: '',
              embedding: []
            },
            score: 0,
            bm25Score: 0,
            vectorScore: 0,
            metadata: {
              matchesCategory: false,
              categoryBoost: 0,
              technicalLevelMatch: 0
            }
          };
        }
        
        // Otherwise, create a compatible structure with null checks
        return {
          item: {
            ...item,
            // Add required VectorStoreItem fields
            embedding: Array.isArray(item.embedding) ? item.embedding : [], // Safe check for embedding
            id: item.id || `result-${Math.random().toString(36).substring(2, 9)}`
          },
          score: result && result.score !== undefined ? result.score : 0,
          bm25Score: result && result.bm25Score !== undefined ? result.bm25Score : 0,
          vectorScore: result && result.vectorScore !== undefined ? result.vectorScore : 0,
          metadata: {
            matchesCategory: true,
            categoryBoost: 0,
            technicalLevelMatch: 1,
            // Safely check for metadata properties
            hasContextualMetadata: item.metadata && item.metadata.isContextualChunk ? true : false,
            contextBoost: item.metadata && item.metadata.isContextualChunk ? 0.1 : 0
          }
        };
      } catch (error) {
        console.error(`[Reranking] Error processing result at index ${index}:`, error);
        // Return a fallback result in case of errors
        return {
          item: {
            id: `error-${Math.random().toString(36).substring(2, 9)}`,
            text: 'Error processing this result',
            embedding: []
          },
          score: 0,
          bm25Score: 0,
          vectorScore: 0,
          metadata: {
            matchesCategory: false,
            categoryBoost: 0,
            technicalLevelMatch: 0,
            isErrorResult: true
          }
        };
      }
    });
    
    // Get model info from central configuration
    const useContextualInfo = options.useContextualInfo ?? true;
    const modelConfig = getModelForTask(undefined, 'reranking');
    
    // Default options
    const provider = options.provider || modelConfig.provider;
    const model = options.model || modelConfig.model;
    const timeoutMs = options.timeoutMs || 10000;
    
    console.log(`[Reranking] Reranking ${hybridResults.length} results with provider: ${provider}, model: ${model}`);
    
    // Create prompt for the reranker with contextual awareness
    const systemPrompt = `
      You are a Search Result Evaluator. Your task is to rank search results by relevance to the query.
      Assign a score from 0-10 for each result where:
      - 10: Perfect match that directly and comprehensively answers the query
      - 7-9: Highly relevant with most information needed
      - 4-6: Moderately relevant with partial information
      - 1-3: Slightly relevant but missing key information
      - 0: Completely irrelevant
      
      Focus on semantic relevance, factual accuracy, and information completeness.
      ${useContextualInfo ? `
      IMPORTANT: Pay special attention to results that contain contextual metadata:
      - Document summaries provide an overview of the source document
      - Key points highlight important information in the result
      - When results contain definitions or examples, they may be more useful to the user
      - Related topics can indicate broader relevance to the query
      ` : ''}
      
      IMPORTANT: You must respond with a valid JSON array of objects, where each object has resultId and score properties.
    `;
    
    // Prepare results for evaluation
    const formattedResults = hybridResults.map((result, i) => {
      // Safely check if text property exists
      const itemText = result.item && result.item.text ? result.item.text : '';
      
      // Truncate content to a reasonable length for evaluation
      const content = itemText.length > 500 
        ? itemText.substring(0, 500) + '...' 
        : itemText;
      
      // Include contextual information if available and requested
      let contextInfo = '';
      if (useContextualInfo && result.item && result.item.metadata) {
        const metadata = result.item.metadata;
        
        if (metadata.documentSummary) {
          contextInfo += `\nDocument Summary: ${metadata.documentSummary}`;
        }
        
        if (metadata.context?.description) {
          contextInfo += `\nContent Description: ${metadata.context.description}`;
        }
        
        if (metadata.context?.keyPoints && Array.isArray(metadata.context.keyPoints) && metadata.context.keyPoints.length > 0) {
          contextInfo += `\nKey Points: ${metadata.context.keyPoints.join(', ')}`;
        }
        
        if (metadata.context?.isDefinition) {
          contextInfo += `\nContains Definition: Yes`;
        }
        
        if (metadata.context?.containsExample) {
          contextInfo += `\nContains Example: Yes`;
        }
        
        if (metadata.context?.relatedTopics && Array.isArray(metadata.context.relatedTopics) && metadata.context.relatedTopics.length > 0) {
          contextInfo += `\nRelated Topics: ${metadata.context.relatedTopics.join(', ')}`;
        }
      }
        
      return `[${i+1}] ${content}${contextInfo}`;
    }).join('\n\n');
    
    // User prompt with query and results
    const userPrompt = `
      Query: "${query}"
      
      Search Results:
      ${formattedResults}
      
      Evaluate the relevance of each search result to the query. Return a JSON array where each item has:
      - resultId: The result number (1, 2, etc.)
      - score: A relevance score from 0-10
      ${options.includeExplanations ? '- explanation: Brief justification for the score' : ''}
      
      Format your response as a JSON array ONLY, with no additional text. Example:
      [{"resultId": 1, "score": 7.5}, {"resultId": 2, "score": 4.2}]
    `;
    
    // Set up timeout
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });
    
    // Schema for structured response
    const responseSchema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          resultId: { type: 'integer' },
          score: { type: 'number' },
          explanation: { type: 'string' }
        },
        required: ['resultId', 'score']
      }
    };
    
    // Choose appropriate provider to generate reranking
    let rerankerPromise;
    if (provider === 'gemini') {
      rerankerPromise = generateStructuredGeminiResponse(
        systemPrompt,
        userPrompt,
        responseSchema
      );
    } else {
      // Default to OpenAI
      rerankerPromise = generateStructuredResponse(
        systemPrompt,
        userPrompt,
        responseSchema,
        model
      );
    }
    
    // Race between reranker and timeout
    const rerankerResponse = await Promise.race([rerankerPromise, timeoutPromise]);
    
    // Handle timeout
    if (!rerankerResponse) {
      console.log(`[Reranking] Timed out after ${timeoutMs}ms, using original order`);
      return hybridResults.slice(0, topK);
    }
    
    // Extract and parse the reranker response
    let responseArray;

    // Handle different response formats
    if (Array.isArray(rerankerResponse)) {
      // Direct array response - ideal case
      responseArray = rerankerResponse;
    } else if (typeof rerankerResponse === 'object' && rerankerResponse !== null) {
      // If response has an 'error' field, it means JSON parsing failed in the Gemini client
      if (rerankerResponse.error === true && rerankerResponse.rawResponse) {
        console.log('[Reranking] Gemini client returned error with raw response');
        
        // Attempt to parse the raw response ourselves
        try {
          // Check for JSON array in code blocks: ```json [...] ```
          const codeBlockMatch = rerankerResponse.rawResponse.match(/```(?:json)?\s*([\[\{][\s\S]*?[\]\}])\s*```/);
          if (codeBlockMatch) {
            responseArray = JSON.parse(codeBlockMatch[1]);
            console.log('[Reranking] Successfully extracted JSON from code block');
          } else {
            // Try to match any JSON array pattern [...]
            const jsonArrayMatch = rerankerResponse.rawResponse.match(/\[([\s\S]*?)\]/);
            if (jsonArrayMatch) {
              responseArray = JSON.parse(`[${jsonArrayMatch[1]}]`);
              console.log('[Reranking] Successfully extracted JSON array using regex');
            }
          }
        } catch (parseError) {
          console.log('[Reranking] Failed to parse JSON from raw response:', parseError);
        }
      } else {
        // Check if the response object contains an array property
        for (const key in rerankerResponse) {
          if (Array.isArray(rerankerResponse[key])) {
            responseArray = rerankerResponse[key];
            console.log(`[Reranking] Found array in response under key: ${key}`);
            break;
          }
        }
      }
    } else if (typeof rerankerResponse === 'string') {
      // Try to parse string as JSON
      try {
        // First check for JSON in code blocks
        const codeBlockMatch = rerankerResponse.match(/```(?:json)?\s*([\[\{][\s\S]*?[\]\}])\s*```/);
        if (codeBlockMatch) {
          responseArray = JSON.parse(codeBlockMatch[1]);
          console.log('[Reranking] Successfully extracted JSON from code block in string');
        } else {
          // Try direct parsing
          responseArray = JSON.parse(rerankerResponse);
          console.log('[Reranking] Successfully parsed string as JSON');
        }
      } catch (parseError) {
        console.log('[Reranking] Failed to parse string as JSON:', parseError);
      }
    }

    // If we still don't have a valid array, fall back to original order
    if (!Array.isArray(responseArray)) {
      console.log('[Reranking] Could not extract a valid array from response, using original order');
      return hybridResults.slice(0, topK);
    }
    
    // Parse and map reranking results
    const rerankedResults = responseArray
      .map((item: any) => {
        // Use 0-based index to access results array
        const resultIndex = Math.max(0, (parseInt(item.resultId, 10) || 1) - 1);
        
        // Ensure index is valid
        const resultItem = resultIndex < hybridResults.length 
          ? hybridResults[resultIndex]
          : hybridResults[0];
          
        return {
          original: resultItem,
          relevanceScore: item.score || 0,
          explanation: item.explanation
        } as RerankResult;
      })
      // Sort by relevance score in descending order
      .sort((a: RerankResult, b: RerankResult) => b.relevanceScore - a.relevanceScore);
    
    console.log(`[Reranking] Successfully reranked results`);
    
    // Return the top K results in reranked order with added reranking metadata
    return rerankedResults
      .slice(0, topK)
      .map((item: RerankResult) => {
        // Add reranking score to the result metadata for debugging/analysis
        const original = item.original;
        if (original.item && original.item.metadata) {
          // Use type assertion to add the reranking metadata properties
          (original.item.metadata as any).rerankScore = item.relevanceScore;
          (original.item.metadata as any).originalScore = original.score;
        }
        return original;
      });
      
  } catch (error: unknown) {
    // Log error and fall back to original ranking
    logError('[Reranking] Error during reranking', String(error));
    console.log('[Reranking] Falling back to original ranking due to error');
    return results.slice(0, topK);
  }
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
 * Interface for visual content in multi-modal vector store items
 */
interface VisualContent {
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
 * Represents a search result item with reranking information
 */
interface RankedSearchResult {
  item: any;
  score: number;
  matchType?: string;
  matchedVisual?: any;
  explanation?: string;
  originalScore?: number;
  [key: string]: any;
}

/**
 * Internal structure for items being reranked
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
  results: RankedSearchResult[],
  options: MultiModalRerankOptions = {}
): Promise<RankedSearchResult[]> {
  // Early return if not enough results to rerank
  if (results.length <= 1) return results;
  
  // Set default options
  const { 
    limit = 5, 
    includeScores = true,
    useVisualContext = true,
    visualFocus = false,
    visualTypes = [],
    timeoutMs = 10000
  } = options;

  try {
    // Import Gemini client functions
    const { generateStructuredGeminiResponse } = await import('./geminiClient');
    
    // Get enhanced visual query analysis
    let queryVisualAnalysis = {
      isVisualQuery: visualFocus,
      visualTypes: visualTypes as string[],
      confidence: visualFocus ? 1.0 : 0,
      explicitVisualRequest: visualFocus
    };
    
    // Use the enhanced query analysis if not explicitly set
    if (!visualFocus && query) {
      try {
        const { analyzeVisualQuery } = await import('./queryAnalysis');
        queryVisualAnalysis = analyzeVisualQuery(query);
      } catch (e) {
        console.log('[Reranking] Error analyzing visual aspects of query:', e);
      }
    }
    
    // Determine which visual types to prioritize
    const targetVisualTypes = queryVisualAnalysis.visualTypes.length > 0 
      ? queryVisualAnalysis.visualTypes 
      : visualTypes;
    
    const queryHasVisualFocus = queryVisualAnalysis.isVisualQuery;
    const visualConfidence = queryVisualAnalysis.confidence;
    
    // Convert to the internal structure for reranking
    const itemsToRerank: ItemToRerank[] = results.map((result, index) => {
      try {
        // Safely extract the item
        const item = result && result.item ? result.item : {};
        const metadata = item.metadata || {};
        
        // Prepare visual context information
        let visualContextInfo = '';
        let visualTypesList: string[] = [];
        
        // Include visual content information if available and enabled
        if (useVisualContext) {
          // Extract visual content information
          if (item.visualContent && Array.isArray(item.visualContent) && item.visualContent.length > 0) {
            // Process each visual element
            const visualDescriptions = item.visualContent.map((visual: VisualContent) => {
              // Check if visual is valid
              if (!visual) return 'Invalid visual element';
              
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
              
              // Add structured data summary if available
              if (visual.structuredData || visual.data) {
                try {
                  const structuredData = visual.structuredData || visual.data;
                  const structuredDataSummary = typeof structuredData === 'object' 
                    ? JSON.stringify(structuredData).substring(0, 150) + '...'
                    : String(structuredData).substring(0, 150) + '...';
                    
                  visualDesc += `\nStructured data: ${structuredDataSummary}`;
                } catch (e) {
                  // Ignore structured data if it causes issues
                }
              }
              
              // Add figure number if available
              if (visual.figureNumber) {
                visualDesc += `\nFigure #${visual.figureNumber}`;
              }
              
              return visualDesc;
            }).filter(Boolean).join('\n\n');
            
            visualContextInfo = `VISUAL CONTENT:\n${visualDescriptions}\n\n`;
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
              const typesText = Array.isArray(metadata.visualElementTypes) ? metadata.visualElementTypes.join(', ') : 'unknown';
              visualContextInfo += `\nVisual types: ${typesText}`;
              
              // Add to visual types list
              if (Array.isArray(metadata.visualElementTypes)) {
                for (const vType of metadata.visualElementTypes) {
                  if (vType && !visualTypesList.includes(vType)) {
                    visualTypesList.push(vType);
                  }
                }
              }
            }
          }
        }
        
        // Get the text content, prioritizing original text if available with fallback
        const textContent = item.originalText || item.text || '';
        
        // Check if this result has matched visuals
        const hasMatchedVisual = result.matchedVisual !== undefined;
        const matchType = result.matchType || 'text';
        
        // Determine if there's a visual type match with the query
        const hasVisualTypeMatch = targetVisualTypes.length > 0 && visualTypesList.length > 0 && 
          visualTypesList.some(vType => {
            if (!vType) return false; // Skip null/undefined types
            const vTypeLower = vType.toLowerCase();
            return targetVisualTypes.some(tType => {
              if (!tType) return false; // Skip null/undefined target types
              const tTypeLower = tType.toLowerCase();
              return vTypeLower.includes(tTypeLower) || tTypeLower.includes(vTypeLower);
            });
          });
        
        return {
          id: index,
          text: textContent,
          visualContext: visualContextInfo,
          initialScore: result && typeof result.score === 'number' ? result.score : 0,
          hasMatchedVisual,
          matchType,
          visualTypes: visualTypesList,
          hasVisualTypeMatch
        };
      } catch (error) {
        console.error(`[Reranking] Error processing result at index ${index}:`, error);
        // Return a minimal safe object if we encounter an error
        return {
          id: index,
          text: '',
          visualContext: '',
          initialScore: 0,
          hasMatchedVisual: false,
          matchType: 'text',
          visualTypes: [],
          hasVisualTypeMatch: false
        };
      }
    });
    
    // Create enhanced prompt for Gemini with multi-modal awareness
    const systemPrompt = `
      You are a specialized Multi-Modal Search Result Evaluator. Your task is to rank search results by relevance to the query, considering both textual and visual content.
      
      Assign a score from 0-10 for each result where:
      - 10: Perfect match that directly and comprehensively answers the query
      - 7-9: Highly relevant with most information needed
      - 4-6: Moderately relevant with partial information
      - 1-3: Slightly relevant but missing key information
      - 0: Completely irrelevant
      
      IMPORTANT INSTRUCTIONS FOR MULTI-MODAL EVALUATION:
      
      ${queryHasVisualFocus ? `
      - This query is SPECIFICALLY ABOUT VISUAL CONTENT with a confidence of ${(visualConfidence * 100).toFixed(0)}%.
      - The query is explicitly asking for visual information${targetVisualTypes.length > 0 ? ` related to: ${targetVisualTypes.join(', ')}` : ''}.
      - Results containing relevant visual elements should receive significantly higher scores.
      - Text-only results should be downranked unless they are exceptionally relevant to the query.
      - Results with the exact visual types requested should receive the highest scores.
      ` : `
      - This query is primarily about textual information, but may benefit from supporting visuals.
      - Results with relevant visual content that complements the text should receive moderately higher scores.
      `}
      
      Visual Content Evaluation Guidelines:
      - Always examine the "VISUAL CONTENT" sections when present - they contain valuable context
      - For each result, consider how well the visual elements enhance understanding of the topic
      - Evaluate the relevance of the visual descriptions to the query
      - Consider both the quality and quantity of visual information provided
      - For charts and diagrams, check if they illustrate concepts mentioned in the query
      - For tables, assess if they contain data points relevant to the query
      - For images and screenshots, evaluate if they show the relevant visual information
      
      Scoring Adjustments:
      - Results with visuals that match the specific types requested should get +2-3 points
      - Results with relevant but not exact visual matches should get +1-2 points
      - Results with high-quality textual content AND relevant visuals should receive the highest scores
      - If a query explicitly asks to "show" something, results without visuals should rarely score above 5
      
      IMPORTANT: Your response must be a valid JSON array of objects, where each object has 'id', 'score', and 'reason' properties.
    `;
    
    // Prepare the documents for evaluation
    const formattedItems = itemsToRerank.map((item) => {
      // Build document representation with visual type highlighting
      let documentInfo = `DOCUMENT ${item.id}:`;
      
      // Add visual type information if available
      if (item.visualTypes && item.visualTypes.length > 0) {
        documentInfo += `\nVISUAL TYPES PRESENT: ${item.visualTypes.join(', ')}`;
        
        // Highlight visual type matches if query has specific targets
        if (targetVisualTypes.length > 0 && item.hasVisualTypeMatch) {
          documentInfo += `\n⭐ MATCHES REQUESTED VISUAL TYPE: ${targetVisualTypes.join(', ')} ⭐`;
        }
      }
      
      // Add the visual context and text content
      documentInfo += `\n${item.visualContext ? item.visualContext : ''}---\n${item.text}`;
      
      return documentInfo;
    }).join('\n\n');
    
    // User prompt with query and documents
    const userPrompt = `
      QUERY: "${query}"
      
      ${queryHasVisualFocus 
        ? `This is a VISUAL QUERY with confidence ${(visualConfidence * 100).toFixed(0)}%.${
            targetVisualTypes.length > 0 
              ? ` It specifically requests these visual types: ${targetVisualTypes.join(', ')}.` 
              : ''
          }`
        : 'This is primarily a text-based query that may benefit from visual information.'
      }
      
      DOCUMENTS:
      ${formattedItems}
      
      Evaluate the relevance of each document to the query, paying special attention to visual content when present.
      ${targetVisualTypes.length > 0 
        ? `Prioritize results containing these specific visual types: ${targetVisualTypes.join(', ')}.` 
        : ''
      }
      
      Return a JSON array where each item has:
      - id: The document number
      - score: A relevance score from 0-10
      - reason: Brief justification for the score that includes consideration of visual content when present
      
      Format your response as a JSON array ONLY, with no additional text.
    `;
    
    // Schema for structured response
    const responseSchema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          score: { type: 'number' },
          reason: { type: 'string' }
        },
        required: ['id', 'score', 'reason']
      }
    };
    
    // Set up timeout for the reranking
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });
    
    // Generate reranking with Gemini
    const rerankerPromise = generateStructuredGeminiResponse(
      systemPrompt,
      userPrompt,
      responseSchema
    );
    
    // Race between reranker and timeout
    const rerankerResponse = await Promise.race([rerankerPromise, timeoutPromise]);
    
    // Handle timeout with intelligent fallback
    if (!rerankerResponse) {
      console.log(`[MultiModal Reranking] Timed out after ${timeoutMs}ms, using fallback reranking`);
      
      // Use a simple heuristic-based fallback reranking when Gemini times out
      return applyFallbackReranking(results, {
        query,
        limit,
        visualFocus: queryHasVisualFocus,
        targetVisualTypes,
        includeScores
      });
    }
    
    // Process the response
    let rankingItems: RankerResponseItem[] = Array.isArray(rerankerResponse) ? rerankerResponse : [];
    
    // Handle empty or invalid responses with fallback
    if (rankingItems.length === 0) {
      console.log('[MultiModal Reranking] Empty response from reranker, using fallback');
      return applyFallbackReranking(results, {
        query,
        limit,
        visualFocus: queryHasVisualFocus,
        targetVisualTypes,
        includeScores
      });
    }
    
    // Map the ranked items back to the original results
    const rerankedResults: RankedSearchResult[] = rankingItems.map(rankItem => {
      const originalResultIndex = rankItem.id;
      
      // Safety check to ensure the index is valid
      if (originalResultIndex < 0 || originalResultIndex >= results.length) {
        console.warn(`[Reranking] Invalid result index: ${originalResultIndex}`);
        return null;
      }
      
      const originalResult = results[originalResultIndex];
      
      // Normalize the score to 0-1 range (from 0-10)
      const normalizedScore = rankItem.score / 10;
      
      return {
        ...originalResult,
        score: normalizedScore,
        // Include the original score and explanation if requested
        ...(includeScores ? { 
          originalScore: originalResult.score,
          explanation: rankItem.reason 
        } : {})
      };
    }).filter(Boolean) as RankedSearchResult[]; // Remove any null results from invalid indices
    
    // Sort the results by their new scores and limit them
    return rerankedResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
      
  } catch (error) {
    console.error("[MultiModal Reranking] Error during Gemini reranking:", error);
    
    // Fallback to a simple reranking strategy based on visual content
    return applyFallbackReranking(results, {
      query,
      limit,
      visualFocus: visualFocus,
      targetVisualTypes: visualTypes,
      includeScores,
      error: String(error)
    });
  }
}

/**
 * Apply a simple heuristic-based fallback reranking when Gemini reranking fails
 * This ensures we still get reasonable results even if the LLM-based reranking fails
 */
function applyFallbackReranking(
  results: RankedSearchResult[],
  options: {
    query: string;
    limit: number;
    visualFocus: boolean;
    targetVisualTypes: string[];
    includeScores: boolean;
    error?: string;
  }
): RankedSearchResult[] {
  const { query, limit, visualFocus, targetVisualTypes, includeScores, error } = options;
  
  // Clone the results to avoid modifying the originals
  const modifiedResults = results.map(r => ({ ...r }));
  
  // Apply heuristic score adjustments
  for (const result of modifiedResults) {
    const item = result.item;
    const metadata = item.metadata || {};
    let scoreAdjustment = 0;
    let explanationText = 'Fallback scoring: ';
    
    // Boost results with matched visuals
    if (result.matchedVisual) {
      scoreAdjustment += 0.25;
      explanationText += 'Has matched visual (+0.25). ';
    }
    
    // Boost results with any visual content if the query has visual focus
    if (visualFocus && 
        (item.visualContent || metadata.hasVisualContent || metadata.isVisualElement)) {
      scoreAdjustment += 0.2;
      explanationText += 'Query has visual focus and result has visual content (+0.2). ';
      
      // Additional boost for specific visual type matches
      const resultVisualTypes: string[] = [];
      
      // Get visual types from visualContent
      if (item.visualContent && Array.isArray(item.visualContent)) {
        for (const visual of item.visualContent) {
          if (visual.type && !resultVisualTypes.includes(visual.type.toString())) {
            resultVisualTypes.push(visual.type.toString());
          }
        }
      }
      
      // Get visual types from metadata
      if (metadata.visualElementType && !resultVisualTypes.includes(metadata.visualElementType)) {
        resultVisualTypes.push(metadata.visualElementType);
      }
      
      if (metadata.visualElementTypes && Array.isArray(metadata.visualElementTypes)) {
        for (const type of metadata.visualElementTypes) {
          if (!resultVisualTypes.includes(type)) {
            resultVisualTypes.push(type);
          }
        }
      }
      
      // Check for visual type matches
      if (targetVisualTypes.length > 0 && resultVisualTypes.length > 0) {
        const hasTypeMatch = resultVisualTypes.some(resultType => 
          targetVisualTypes.some(targetType => 
            resultType.toLowerCase().includes(targetType.toLowerCase()) || 
            targetType.toLowerCase().includes(resultType.toLowerCase())
          )
        );
        
        if (hasTypeMatch) {
          scoreAdjustment += 0.3;
          explanationText += `Matches requested visual type(s): ${targetVisualTypes.join(', ')} (+0.3). `;
        }
      }
    }
    
    // Preserve the original score for reference
    if (includeScores) {
      result.originalScore = result.score;
    }
    
    // Apply the adjustment (keeping within 0-1 range)
    result.score = Math.min(1, Math.max(0, result.score + scoreAdjustment));
    
    // Add explanation if scores are included
    if (includeScores) {
      if (error) {
        explanationText += `Fallback used due to error: ${error}. `;
      }
      result.explanation = explanationText;
    }
  }
  
  // Sort by adjusted scores
  return modifiedResults
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
} 
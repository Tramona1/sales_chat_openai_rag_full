/**
 * Multi-Modal Reranking Module
 *
 * This module applies LLM-based reranking to improve search result ordering,
 * with specialized handling for multi-modal content using Gemini.
 */
import { generateStructuredGeminiResponse } from './geminiClient';
import { analyzeVisualQuery } from './queryAnalysis';
/**
 * Extract visual context from an item
 * @param item The item to extract visual context from
 * @returns A string representation of the visual context
 */
function extractVisualContext(item) {
    // Initialize with safe defaults
    let visualContextInfo = '';
    let visualTypesList = [];
    try {
        // Early return if item is invalid
        if (!item)
            return { visualContextInfo, visualTypesList };
        // Safely access metadata
        const metadata = item.metadata || {};
        // Extract visual content information with robust checks
        if (item.visualContent && Array.isArray(item.visualContent) && item.visualContent.length > 0) {
            try {
                // Process each visual element
                const visualDescriptions = item.visualContent
                    .filter((visual) => visual != null) // Filter out null entries
                    .map((visual) => {
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
                                    }
                                    catch (e) {
                                        structuredDataSummary = 'Complex structured data (could not stringify)';
                                    }
                                }
                                else if (structuredData !== null && structuredData !== undefined) {
                                    structuredDataSummary = String(structuredData).substring(0, 150) + '...';
                                }
                                else {
                                    structuredDataSummary = 'No structured data available';
                                }
                                visualDesc += `\nStructured data: ${structuredDataSummary}`;
                            }
                            catch (e) {
                                // Ignore structured data if it causes issues
                                console.warn('Error processing structured data:', e);
                            }
                        }
                        // Add figure number if available
                        if (visual.figureNumber) {
                            visualDesc += `\nFigure #${visual.figureNumber}`;
                        }
                        return visualDesc;
                    }
                    catch (error) {
                        console.warn('Error processing visual element:', error);
                        return 'Error processing visual element';
                    }
                })
                    .filter(Boolean) // Remove any nulls or empty strings
                    .join('\n\n');
                if (visualDescriptions) {
                    visualContextInfo = `VISUAL CONTENT:\n${visualDescriptions}\n\n`;
                }
            }
            catch (error) {
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
            }
            else if (metadata.hasVisualContent || metadata.hasVisualElements) {
                visualContextInfo += 'Contains visual elements that may be relevant to the query';
            }
            if (metadata.visualElementTypes && Array.isArray(metadata.visualElementTypes)) {
                // Handle empty or invalid arrays
                if (metadata.visualElementTypes.length === 0) {
                    visualContextInfo += '\nVisual types: none specified';
                }
                else {
                    const typesText = metadata.visualElementTypes
                        .filter((type) => type != null) // Filter out nulls with proper typing
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
    }
    catch (error) {
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
export async function rerankWithGemini(query, results, options = {}) {
    // Validate input: Early return if no valid results or invalid input
    if (!results || !Array.isArray(results)) {
        console.log('[MultiModal Reranking] Invalid results array provided');
        return [];
    }
    // Filter out any null/undefined results to prevent errors
    const validResults = results.filter(r => r != null);
    // Early return if not enough results to rerank
    if (validResults.length === 0) {
        console.log('[MultiModal Reranking] No valid results to rerank');
        return [];
    }
    if (validResults.length === 1) {
        // If only one result, format it properly and return
        const result = validResults[0];
        // Create a safe RankedSearchResult with proper structure and defaults
        return [{
                ...result,
                score: result.score || 0,
                originalScore: result.score || 0,
                item: {
                    ...(result.item || {}),
                    id: result.item?.id || `result-${Date.now()}`,
                    text: result.item?.text || '',
                    metadata: {
                        ...(result.item?.metadata || {}),
                        rerankScore: result.score || 0,
                        originalScore: result.score || 0
                    }
                }
            }];
    }
    // Set default options
    const { limit = Math.min(5, validResults.length), includeScores = true, useVisualContext = true, visualFocus = false, visualTypes = [], timeoutMs = 10000 } = options;
    try {
        // Get enhanced visual query analysis
        let queryVisualAnalysis = {
            isVisualQuery: visualFocus,
            visualTypes: visualTypes,
            confidence: visualFocus ? 1.0 : 0,
            explicitVisualRequest: visualFocus
        };
        // Use the enhanced query analysis if not explicitly set
        if (!visualFocus && query) {
            try {
                queryVisualAnalysis = analyzeVisualQuery(query);
            }
            catch (e) {
                console.log('[Reranking] Error analyzing visual aspects of query:', e);
                // Continue with default analysis on error
            }
        }
        // Determine which visual types to prioritize
        const targetVisualTypes = queryVisualAnalysis.visualTypes.length > 0
            ? queryVisualAnalysis.visualTypes
            : visualTypes;
        const queryHasVisualFocus = queryVisualAnalysis.isVisualQuery;
        const visualConfidence = queryVisualAnalysis.confidence;
        // Convert to the internal structure for reranking with improved error handling
        const itemsToRerank = validResults.map((result, index) => {
            try {
                // Safely extract the item with fallbacks
                const item = result?.item || {};
                const metadata = item.metadata || {};
                // Extract visual context information using the utility function with safe defaults
                const { visualContextInfo, visualTypesList } = extractVisualContext(item);
                // Get the text content, prioritizing original text if available with fallback
                const textContent = item.text || item.originalText || '';
                // Safely check if this result has matched visuals
                const hasMatchedVisual = result && result.matchedVisual !== undefined;
                const matchType = result?.matchType || 'text';
                // Determine if there's a visual type match with the query
                const hasVisualTypeMatch = targetVisualTypes.length > 0 && visualTypesList.length > 0 &&
                    visualTypesList.some(vType => {
                        if (!vType)
                            return false; // Skip null/undefined types
                        const vTypeLower = vType.toLowerCase();
                        return targetVisualTypes.some(tType => {
                            if (!tType)
                                return false; // Skip null/undefined target types
                            const tTypeLower = tType.toLowerCase();
                            return vTypeLower.includes(tTypeLower) || tTypeLower.includes(vTypeLower);
                        });
                    });
                // Extract Content Quality Score
                const qualityScoreValue = metadata.contentQualityScore;
                const qualityScore = typeof qualityScoreValue === 'number'
                    ? Math.min(1, Math.max(0, qualityScoreValue))
                    : undefined;
                return {
                    id: index,
                    text: textContent || '', // Ensure we never have null text
                    visualContext: visualContextInfo || '',
                    initialScore: typeof result.score === 'number' ? result.score : 0,
                    hasMatchedVisual: !!hasMatchedVisual, // Convert to boolean
                    matchType: matchType || 'text', // Ensure default
                    visualTypes: visualTypesList || [],
                    hasVisualTypeMatch: !!hasVisualTypeMatch, // Convert to boolean
                    primaryCategory: metadata.primaryCategory,
                    contentQualityScore: qualityScore,
                };
            }
            catch (error) {
                console.error(`[Reranking] Error processing result at index ${index}:`, error);
                // Return a safe default object, including the new field
                return {
                    id: index,
                    text: '',
                    visualContext: '',
                    initialScore: 0,
                    hasMatchedVisual: false,
                    matchType: 'text',
                    visualTypes: [],
                    hasVisualTypeMatch: false,
                    primaryCategory: undefined,
                    contentQualityScore: undefined
                };
            }
        });
        // Create enhanced prompt for Gemini with multi-modal awareness AND content quality score
        const systemPrompt = `
      You are a specialized Multi-Modal Search Result Evaluator. Your task is to rank search results by relevance to the query, considering both textual and visual content, AND the provided content quality score.
      
      Assign a score from 0-10 for each result where:
      - 10: Perfect match that directly and comprehensively answers the query
      - 7-9: Highly relevant with most information needed
      - 4-6: Moderately relevant with partial information
      - 1-3: Slightly relevant but missing key information
      - 0: Completely irrelevant
      
      **DOWN-RANKING FOR JOB POSTINGS:**
      - Check the 'Category' provided for each document.
      - If a document's category is 'HIRING' or 'JOB_POSTING', significantly lower its score (e.g., subtract 3-5 points or cap it at 3) **UNLESS** the user query explicitly asks about jobs, hiring, careers, specific job titles, or locations in a hiring context.
      - For general product/company queries, job postings are usually low relevance.

      **NEW: CONTENT QUALITY SCORE:**
      - Each document includes a 'Quality' score (0-1), indicating the reliability or cleanliness of the scraped source text.
      - Relevance to the query is the MOST important factor.
      - However, if multiple documents seem similarly relevant, slightly prefer those with higher Quality scores (e.g., > 0.8).
      - You MAY slightly penalize documents with very low Quality scores (e.g., < 0.5) if their relevance is borderline, but do NOT heavily penalize a highly relevant document just because its quality score is low. Use it as a secondary signal.
            
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
      - Remember to factor in the Content Quality score as a secondary consideration, as this tells us how quality the source text is. A low score means the source text is likely to be bad quality so this should de-rank it slightly.
      
      IMPORTANT: Your response must be a valid JSON array of objects, where each object has 'id', 'score', and 'reason' properties. The 'reason' should briefly justify the score, potentially mentioning how relevance and quality were balanced if quality significantly influenced the score.
    `;
        // Prepare the documents for evaluation
        const formattedItems = itemsToRerank.map((item) => {
            // Build document representation with visual type highlighting
            let documentInfo = `DOCUMENT ${item.id} (Category: ${item.primaryCategory || 'Unknown'}`;
            if (item.contentQualityScore !== undefined) {
                documentInfo += `, Quality: ${item.contentQualityScore.toFixed(3)}`;
            }
            documentInfo += `):`;
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
            ? `This is a VISUAL QUERY with confidence ${(visualConfidence * 100).toFixed(0)}%.${targetVisualTypes.length > 0
                ? ` It specifically requests these visual types: ${targetVisualTypes.join(', ')}.`
                : ''}`
            : 'This is primarily a text-based query that may benefit from visual information.'}
      
      DOCUMENTS:
      ${formattedItems}
      
      Evaluate the relevance of each document to the query, paying special attention to visual content when present.
      ${targetVisualTypes.length > 0
            ? `Prioritize results containing these specific visual types: ${targetVisualTypes.join(', ')}.`
            : ''}
      
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
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => resolve(null), timeoutMs);
        });
        // Generate reranking with Gemini
        const rerankerPromise = generateStructuredGeminiResponse(systemPrompt, userPrompt, responseSchema);
        // Race between reranker and timeout
        const rerankerResponse = await Promise.race([rerankerPromise, timeoutPromise]);
        // Handle timeout with intelligent fallback
        if (!rerankerResponse) {
            console.log(`[MultiModal Reranking] Timed out after ${timeoutMs}ms, using fallback reranking`);
            // Use a simple heuristic-based fallback reranking when Gemini times out
            return applyFallbackReranking(validResults, {
                query,
                limit,
                visualFocus: queryHasVisualFocus,
                targetVisualTypes,
                includeScores
            });
        }
        // Process the response with improved error handling
        let rankingItems = Array.isArray(rerankerResponse) ? rerankerResponse : [];
        // Handle empty or invalid responses with fallback
        if (rankingItems.length === 0) {
            console.log('[MultiModal Reranking] Empty response from reranker, using fallback');
            return applyFallbackReranking(validResults, {
                query,
                limit,
                visualFocus: queryHasVisualFocus,
                targetVisualTypes,
                includeScores
            });
        }
        // Map the ranked items back to the original results with proper error handling
        const rerankedResults = rankingItems
            .map(rankItem => {
            try {
                // Get the original result index, with validation
                const originalResultIndex = typeof rankItem?.id === 'number' ? rankItem.id : -1;
                // Safety check to ensure the index is valid
                if (originalResultIndex < 0 || originalResultIndex >= validResults.length) {
                    console.warn(`[Reranking] Invalid result index: ${originalResultIndex}`);
                    return null;
                }
                // Get the original result with validation
                const originalResult = validResults[originalResultIndex];
                if (!originalResult) {
                    console.warn(`[Reranking] Missing original result at index: ${originalResultIndex}`);
                    return null;
                }
                // Normalize the score to 0-1 range (from 0-10) with validation
                const normalizedScore = typeof rankItem?.score === 'number'
                    ? Math.min(1, Math.max(0, rankItem.score / 10))
                    : 0;
                // Create a new result object with proper types, adding fallbacks for all paths
                return {
                    ...originalResult,
                    score: normalizedScore,
                    originalScore: originalResult.score || 0,
                    explanation: includeScores && rankItem?.reason ? rankItem.reason : undefined,
                    item: {
                        ...(originalResult.item || {}),
                        id: (originalResult.item?.id || `result-${originalResultIndex}`),
                        text: (originalResult.item?.text || ''),
                        metadata: {
                            ...(originalResult.item?.metadata || {}),
                            rerankScore: normalizedScore,
                            originalScore: originalResult.score || 0
                        }
                    }
                };
            }
            catch (error) {
                console.error(`[Reranking] Error processing rank item:`, error);
                return null;
            }
        })
            .filter(Boolean); // Remove any null results
        // Sort the results by their new scores and limit them
        return rerankedResults.length > 0
            ? rerankedResults
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, limit)
            : applyFallbackReranking(validResults, {
                query,
                limit,
                visualFocus: queryHasVisualFocus,
                targetVisualTypes,
                includeScores
            });
    }
    catch (error) {
        console.error("[MultiModal Reranking] Error during Gemini reranking:", error);
        // Fallback to a simple reranking strategy based on visual content
        return applyFallbackReranking(validResults, {
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
function applyFallbackReranking(results, options) {
    const { query, limit, visualFocus, targetVisualTypes, includeScores, error } = options;
    // Validate inputs and provide safe defaults
    if (!results || !Array.isArray(results) || results.length === 0) {
        console.log('[Fallback Reranking] No valid results to rerank');
        return [];
    }
    // Clone the results to avoid modifying the originals, with validation
    const modifiedResults = results
        .filter(r => r != null) // Filter out null/undefined items
        .map(r => {
        try {
            // Create a properly structured RankedSearchResult
            return {
                ...r,
                score: r.score || 0,
                originalScore: r.score || 0,
                item: {
                    ...(r.item || {}),
                    id: r.item?.id || `fallback-${Math.random().toString(36).substring(2, 9)}`,
                    text: r.item?.text || '',
                    metadata: {
                        ...(r.item?.metadata || {})
                    }
                }
            };
        }
        catch (err) {
            console.error('[Fallback Reranking] Error cloning result:', err);
            // Return a minimal safe object
            return {
                score: 0,
                originalScore: 0,
                item: {
                    id: `fallback-${Math.random().toString(36).substring(2, 9)}`,
                    text: '',
                    metadata: {}
                }
            };
        }
    });
    // Apply heuristic score adjustments with proper error handling
    for (const result of modifiedResults) {
        try {
            // Skip invalid results
            if (!result || !result.item) {
                continue;
            }
            // Ensure metadata exists
            if (!result.item.metadata) {
                result.item.metadata = {};
            }
            const item = result.item;
            const metadata = item.metadata || {};
            let scoreAdjustment = 0;
            let explanationText = 'Fallback scoring: ';
            // Boost results with matched visuals (with null check)
            if (result.matchedVisual) {
                scoreAdjustment += 0.25;
                explanationText += 'Has matched visual (+0.25). ';
            }
            // Boost results with any visual content if the query has visual focus
            const hasVisualContent = (item.visualContent ||
                metadata.hasVisualContent ||
                metadata.isVisualElement);
            if (visualFocus && hasVisualContent) {
                scoreAdjustment += 0.2;
                explanationText += 'Query has visual focus and result has visual content (+0.2). ';
                // Additional boost for specific visual type matches
                const resultVisualTypes = [];
                // Get visual types from visualContent
                if (item.visualContent && Array.isArray(item.visualContent)) {
                    for (const visual of item.visualContent) {
                        if (visual && visual.type && !resultVisualTypes.includes(visual.type.toString())) {
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
                        if (type && !resultVisualTypes.includes(type)) {
                            resultVisualTypes.push(type);
                        }
                    }
                }
                // Check for visual type matches
                if (targetVisualTypes.length > 0 && resultVisualTypes.length > 0) {
                    const hasTypeMatch = resultVisualTypes.some(resultType => targetVisualTypes.some(targetType => {
                        // Null check both types
                        if (!resultType || !targetType)
                            return false;
                        return resultType.toLowerCase().includes(targetType.toLowerCase()) ||
                            targetType.toLowerCase().includes(resultType.toLowerCase());
                    }));
                    if (hasTypeMatch) {
                        scoreAdjustment += 0.3;
                        explanationText += `Matches requested visual type(s): ${targetVisualTypes.join(', ')} (+0.3). `;
                    }
                }
            }
            // Preserve the original score for reference
            result.originalScore = result.score || 0;
            // Apply the adjustment (keeping within 0-1 range)
            result.score = Math.min(1, Math.max(0, (result.score || 0) + scoreAdjustment));
            // Add explanation if scores are included
            if (includeScores) {
                if (error) {
                    explanationText += `Fallback used due to error: ${error}. `;
                }
                result.explanation = explanationText;
            }
            // Update metadata with reranking information
            result.item.metadata.rerankScore = result.score;
            result.item.metadata.originalScore = result.originalScore;
            result.item.metadata.fallbackRanking = true;
        }
        catch (err) {
            console.error('[Fallback Reranking] Error processing result:', err);
            // Continue with next result - don't break the whole process for one bad result
        }
    }
    // Sort by adjusted scores and handle empty results
    return modifiedResults.length > 0
        ? modifiedResults
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, Math.min(limit, modifiedResults.length))
        : [];
}

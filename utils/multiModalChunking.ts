/**
 * Multi-Modal Chunking Utilities
 * 
 * This file provides functionality for processing documents that contain
 * both text and visual elements, ensuring proper association between them.
 */

import { ContextualChunk, ChunkContext } from '../types/documentProcessing';
import { 
  VisualContentType, 
  ProcessedImage, 
  BaseMultiModalChunk,
  VisualContentItem
} from '../types/baseTypes';
import { MultiModalChunk } from '../types/multiModal';
import { ImageAnalysisResult } from './imageAnalysis/imageAnalyzer';
import { recordMetric } from './performanceMonitoring';
import { extractDocumentContext, generateChunkContext } from './geminiClient';
import { analyzeImage, extractImagesFromPDF } from './multiModalProcessing';
import { v4 as uuidv4 } from 'uuid';
import { VisualContent } from '../types/visualContent';

// No longer need the type alias since we're using the proper types now
// type MultiModalChunk = TypedMultiModalChunk;

// Simple logger implementation to replace the missing logger module
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args)
};

// Simplified text processing function to replace missing module
function overlappingTextSplit(text: string, maxTokens: number, overlap: number): string[] {
  // Simple implementation that splits by approximate token count (characters / 4)
  const textLength = text.length;
  const chunkSize = maxTokens * 4; // Rough approximation: 1 token ≈ 4 chars
  const overlapSize = overlap * 4;
  
  if (textLength <= chunkSize) {
    return [text];
  }
  
  const chunks: string[] = [];
  let startIndex = 0;
  
  while (startIndex < textLength) {
    let endIndex = Math.min(startIndex + chunkSize, textLength);
    
    // Try to end at a sentence boundary
    if (endIndex < textLength) {
      const nextPeriod = text.indexOf('.', endIndex - 20);
      if (nextPeriod > 0 && nextPeriod < endIndex + 20) {
        endIndex = nextPeriod + 1;
      }
    }
    
    chunks.push(text.substring(startIndex, endIndex));
    startIndex = endIndex - overlapSize;
  }
  
  return chunks;
}

/**
 * Find visual elements relevant to a specific text chunk
 * 
 * @param chunk - Text chunk to find relevant visuals for
 * @param visuals - Array of available visual elements
 * @param options - Configuration options
 * @returns Array of relevant visuals
 */
export function findRelevantVisualElements(
  chunk: ContextualChunk,
  visuals: ProcessedImage[],
  options: {
    maxDistance?: number;
    maxVisuals?: number;
    requirePageMatch?: boolean;
  } = {}
): ProcessedImage[] {
  const {
    maxDistance = 3,
    maxVisuals = 3,
    requirePageMatch = false
  } = options;
  
  const chunkText = chunk.text.toLowerCase();
  const chunkMetadata = chunk.metadata || {};
  const chunkPage = (chunkMetadata as any).page;
  
  // Start performance tracking
  const startTime = performance.now();
  
  // Try to find explicit figure references like "Figure 1" or "Table 2"
  const figureReferences = findExplicitReferences(chunkText);
  const explicitMatches: ProcessedImage[] = [];
  
  if (figureReferences.length > 0) {
    for (const ref of figureReferences) {
      // Find visuals matching the reference
      const matchingVisuals = visuals.filter(visual => {
        // Match by figure number if available
        if (ref.number && visual.analysis && visual.analysis.metadata && 
            visual.analysis.metadata.figureNumber === ref.number) {
          return true;
        }
        
        // Match by type
        const visualType = (visual.analysis && visual.analysis.type || '').toLowerCase();
        return visualType.includes(ref.type.toLowerCase());
      });
      
      // Add any matches found
      explicitMatches.push(...matchingVisuals.slice(0, maxVisuals));
    }
  }
  
  // If we have explicit matches from references, prioritize those
  if (explicitMatches.length > 0) {
    const duration = performance.now() - startTime;
    recordMetric(
      'multiModalChunking',
      'findRelevantVisualElements',
      duration,
      true,
      { 
        visualCount: explicitMatches.length,
        method: 'explicitReference'
      }
    );
    
    return explicitMatches.slice(0, maxVisuals);
  }
  
  // If no explicit matches, use keyword matching
  const chunkKeywords = extractKeywords(chunkText, 10);
  
  // Score each visual by keyword matches
  const scoredVisuals = visuals.map(visual => {
    // Skip if page requirement doesn't match
    if (requirePageMatch && chunkPage && visual.page && chunkPage !== visual.page) {
      return { visual, score: 0 };
    }
    
    let score = 0;
    
    // If on same page, boost score
    if (chunkPage && visual.page && chunkPage === visual.page) {
      score += 5;
    }
    
    if (visual.analysis) {
      const visualText = (
        visual.analysis.description + ' ' + 
        (visual.analysis.extractedText || '')
      ).toLowerCase();
      
      // Count keyword matches
      for (const keyword of chunkKeywords) {
        if (visualText.includes(keyword)) {
          score += 1;
        }
      }
    }
    
    return { visual, score };
  });
  
  // Sort by score (highest first) and take top matches
  const sortedVisuals = scoredVisuals
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxVisuals)
    .map(item => item.visual);
  
  const duration = performance.now() - startTime;
  recordMetric(
    'multiModalChunking',
    'findRelevantVisualElements',
    duration,
    true,
    { 
      visualCount: sortedVisuals.length,
      method: 'keywordMatching'
    }
  );
  
  return sortedVisuals;
}

/**
 * Find explicit references to figures, tables, etc. in text
 * 
 * @param text - Text to search for references
 * @returns Array of found references
 */
function findExplicitReferences(text: string): Array<{
  type: string;
  number?: number;
  fullMatch: string;
}> {
  const references = [];
  
  // Match patterns like "Figure 1", "Table 3.2", "Fig. 5", etc.
  const patterns = [
    { type: 'figure', regex: /figure\s+(\d+(\.\d+)?)/gi },
    { type: 'figure', regex: /fig\.\s+(\d+(\.\d+)?)/gi },
    { type: 'table', regex: /table\s+(\d+(\.\d+)?)/gi },
    { type: 'chart', regex: /chart\s+(\d+(\.\d+)?)/gi },
    { type: 'diagram', regex: /diagram\s+(\d+(\.\d+)?)/gi },
    { type: 'graph', regex: /graph\s+(\d+(\.\d+)?)/gi },
    { type: 'image', regex: /image\s+(\d+(\.\d+)?)/gi },
    { type: 'illustration', regex: /illustration\s+(\d+(\.\d+)?)/gi }
  ];
  
  for (const pattern of patterns) {
    let match;
    // Use exec in a loop to find all matches
    while ((match = pattern.regex.exec(text)) !== null) {
      references.push({
        type: pattern.type,
        number: parseFloat(match[1]),
        fullMatch: match[0]
      });
    }
  }
  
  return references;
}

/**
 * Extract keywords from text
 * 
 * @param text - Text to extract keywords from
 * @param maxTerms - Maximum number of terms to extract
 * @returns Array of keywords
 */
function extractKeywords(text: string, maxTerms: number = 10): string[] {
  // Remove common stop words
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
    'to', 'of', 'in', 'for', 'with', 'by', 'on', 'at', 'from', 'as',
    'this', 'that', 'these', 'those', 'it', 'they', 'we', 'you', 'he', 'she',
    'his', 'her', 'their', 'our', 'your', 'its'
  ]);
  
  // Normalize and split text
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Count word frequency
  const wordCounts = new Map<string, number>();
  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  }
  
  // Convert to array and sort by frequency
  const sortedWords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .slice(0, maxTerms);
  
  return sortedWords;
}

/**
 * Create a multi-modal chunk from text and visuals
 * 
 * @param chunk - Text chunk
 * @param relevantVisuals - Visual elements relevant to the chunk
 * @param documentContext - Context of the document
 * @returns Promise resolving to a multi-modal chunk
 */
async function createMultiModalChunk(
  chunk: ContextualChunk,
  relevantVisuals: ProcessedImage[],
  documentContext: any
): Promise<MultiModalChunk> {
  const startTime = performance.now();
  
  try {
    // Get the original chunk metadata or initialize an empty object
    const metadata = { ...(chunk.metadata || {}) };
    
    // Collect all text from visuals
    const visualTexts = relevantVisuals
      .map(visual => visual.analysis && visual.analysis.extractedText)
      .filter(text => text && text.length > 0);
    
    // Generate enhanced context that incorporates visual information
    const enhancedContext = await generateChunkContext(
      chunk.text + (visualTexts.length > 0 ? '\n\n' + visualTexts.join('\n') : ''),
      documentContext
    );
    
    // Create the multi-modal chunk
    const multiModalChunk: MultiModalChunk = {
      id: uuidv4(),
      text: chunk.text,
      content: chunk.text,
      metadata: {
        ...metadata,
        hasVisualContent: relevantVisuals.length > 0,
        visualCount: relevantVisuals.length,
        context: {
          description: enhancedContext.summary || '',
          keyPoints: enhancedContext.keyPoints || [],
          isDefinition: false,
          containsExample: false,
          relatedTopics: []
        }
      },
      // Map the visuals to the expected structure
      visualContent: relevantVisuals.map(visual => ({
        type: (visual.analysis && visual.analysis.type) || VisualContentType.UNKNOWN,
        description: (visual.analysis && visual.analysis.description) || 'No description available',
        detectedText: visual.analysis && visual.analysis.extractedText,
        data: visual.analysis && visual.analysis.structuredData,
        path: visual.path,
        page: visual.page
      }))
    };
    
    const duration = performance.now() - startTime;
    recordMetric(
      'multiModalChunking',
      'createMultiModalChunk',
      duration,
      true,
      { 
        visualCount: relevantVisuals.length
      }
    );
    
    return multiModalChunk;
  } catch (error) {
    logger.error('Error creating multi-modal chunk:', error);
    
    // Return a basic chunk without the enhanced context if there's an error
    const duration = performance.now() - startTime;
    recordMetric(
      'multiModalChunking',
      'createMultiModalChunk',
      duration,
      false,
      { 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    );
    
    return {
      id: uuidv4(),
      text: chunk.text,
      content: chunk.text,
      metadata: {
        ...(chunk.metadata || {}),
        hasVisualContent: relevantVisuals.length > 0,
        visualCount: relevantVisuals.length,
        processingError: error instanceof Error ? error.message : 'Error processing chunk'
      },
      visualContent: relevantVisuals.map(visual => ({
        type: (visual.analysis && visual.analysis.type) || VisualContentType.UNKNOWN,
        description: (visual.analysis && visual.analysis.description) || 'No description available',
        detectedText: visual.analysis && visual.analysis.extractedText,
        path: visual.path,
        page: visual.page
      }))
    };
  }
}

/**
 * Prepare multi-modal chunks for embedding by creating enhanced text representation
 * 
 * @param chunk - The multi-modal chunk to prepare
 * @returns Text string optimized for embedding
 */
export function prepareMultiModalChunkForEmbedding(chunk: MultiModalChunk): string {
  const originalText = chunk.content || chunk.text || '';
  const contextParts: string[] = [];
  
  // --- DOCUMENT METADATA ---
  // Add document-level metadata if available
  const metadata = chunk.metadata || {};
  
  if (metadata.source) {
    contextParts.push(`Source: ${metadata.source}`);
  }
  
  if (metadata.documentType) {
    contextParts.push(`Document type: ${metadata.documentType}`);
  }
  
  if (metadata.documentSummary) {
    contextParts.push(`Document summary: ${metadata.documentSummary}`);
  }
  
  if (metadata.primaryTopics) {
    contextParts.push(`Topics: ${metadata.primaryTopics}`);
  }
  
  // Add audience and technical level information
  if (metadata.audienceType) {
    contextParts.push(`Audience: ${metadata.audienceType}`);
  }
  
  if (metadata.technicalLevel !== undefined) {
    const techLevelTerms = ['non-technical', 'basic', 'intermediate', 'advanced'];
    const techLevel = techLevelTerms[Math.min(metadata.technicalLevel, 3)];
    contextParts.push(`Technical level: ${techLevel}`);
  }
  
  // --- CHUNK CONTEXT ---
  // Add chunk-level context
  if (metadata.context) {
    const context = metadata.context;
    
    // Add chunk description
    if (context.description) {
      contextParts.push(`Content: ${context.description}`);
    }
    
    // Add key points
    if (context.keyPoints && context.keyPoints.length > 0) {
      contextParts.push(`Key points: ${context.keyPoints.join('; ')}`);
    }
    
    // Add special content type markers
    const contentMarkers = [];
    if (context.isDefinition) {
      contentMarkers.push('definition');
    }
    if (context.containsExample) {
      contentMarkers.push('example');
    }
    if (contentMarkers.length > 0) {
      contextParts.push(`Contains: ${contentMarkers.join(', ')}`);
    }
    
    // Add related topics
    if (context.relatedTopics && context.relatedTopics.length > 0) {
      contextParts.push(`Related topics: ${context.relatedTopics.join(', ')}`);
    }
  }
  
  // --- VISUAL CONTENT ---
  // Add rich visual content information
  if (chunk.visualContent && chunk.visualContent.length > 0) {
    // Group visuals by type
    const visualsByType: Record<string, any[]> = {};
    
    for (const visual of chunk.visualContent) {
      const type = visual.type || 'unknown';
      if (!visualsByType[type]) {
        visualsByType[type] = [];
      }
      visualsByType[type].push(visual);
    }
    
    // Create structured visual descriptions grouped by type
    const visualDescriptions = [];
    
    for (const [type, visuals] of Object.entries(visualsByType)) {
      if (visuals.length === 1) {
        // Single visual of this type
        const visual = visuals[0];
        let desc = `${type}`;
        
        if (visual.description) {
          desc += `: ${visual.description.substring(0, 100)}`;
        }
        
        if (visual.detectedText) {
          const truncatedText = visual.detectedText.length > 50 
            ? visual.detectedText.substring(0, 50) + '...' 
            : visual.detectedText;
          desc += ` [Text: ${truncatedText}]`;
        }
        
        visualDescriptions.push(desc);
      } else {
        // Multiple visuals of this type
        visualDescriptions.push(`${visuals.length} ${type}s: ${
          visuals.map(v => v.description?.substring(0, 30) || 'No description').join(' | ')
        }`);
      }
    }
    
    contextParts.push(`Visual content: ${visualDescriptions.join(' | ')}`);
  }
  
  // Add structured info type if available
  if (metadata.isStructured && metadata.infoType) {
    contextParts.push(`Content type: ${metadata.infoType.replace(/_/g, ' ')}`);
  }
  
  // If this is a standalone visual element
  if (metadata.isVisualElement || metadata.isStandaloneVisual) {
    contextParts.push(`Element type: visual ${metadata.visualElementType || ''}`);
  }
  
  // Format the final text with context
  if (contextParts.length > 0) {
    return `[CONTEXT: ${contextParts.join(' | ')}] ${originalText}`;
  }
  
  // If no context, return original text
  return originalText;
}

/**
 * Create multi-modal chunks from text and visuals
 * 
 * @param text - Document text
 * @param visuals - Visual contents from the document
 * @param metadata - Metadata to include with chunks
 * @param options - Chunking options
 * @returns Array of multi-modal chunks
 */
export async function createMultiModalChunks(
  text: string,
  visuals: VisualContent[],
  metadata: Record<string, any> = {},
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    keepSeparateVisualChunks?: boolean;
  } = {}
): Promise<MultiModalChunk[]> {
  const startTime = Date.now();
  
  const {
    chunkSize = 500,
    chunkOverlap = 100,
    keepSeparateVisualChunks = true
  } = options;
  
  logger.info(`Creating multi-modal chunks from ${text.length} chars of text and ${visuals.length} visuals`);
  
  // Create text chunks (implementation will depend on your text splitting function)
  // For now, let's assume a simple split by size
  const textChunks: string[] = [];
  for (let i = 0; i < text.length; i += (chunkSize - chunkOverlap)) {
    if (i > 0) {
      i -= chunkOverlap;
    }
    textChunks.push(text.substring(i, Math.min(i + chunkSize, text.length)));
  }
  
  // Find relevant visuals for each text chunk
  const chunksWithVisuals: {text: string, relevantVisuals: VisualContent[]}[] = [];
  
  for (const chunkText of textChunks) {
    const chunkKeywords = extractKeywords(chunkText, 10);
    
    // Score visuals by keyword relevance
    const scoredVisuals = visuals.map(visual => {
      const visualText = (visual.description + ' ' + (visual.detectedText || '')).toLowerCase();
      let score = 0;
      
      for (const keyword of chunkKeywords) {
        if (visualText.toLowerCase().includes(keyword.toLowerCase())) {
          score += 1;
        }
      }
      
      return { visual, score };
    });
    
    // Get top relevant visuals for this chunk
    const relevantVisuals = scoredVisuals
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)  // Limit to top 3 visuals per chunk
      .map(item => item.visual);
    
    chunksWithVisuals.push({ text: chunkText, relevantVisuals });
  }
  
  // Create multi-modal chunks
  const multiModalChunks: MultiModalChunk[] = [];
  
  for (const { text, relevantVisuals } of chunksWithVisuals) {
    // Create a new chunk with text and its relevant visuals
    const chunk: MultiModalChunk = {
      id: uuidv4(),
      text: text,
      content: text,
      metadata: {
        ...metadata,
        hasVisualContent: relevantVisuals.length > 0,
        visualCount: relevantVisuals.length
      },
      visualContent: relevantVisuals.map(visual => ({
        type: visual.type || VisualContentType.UNKNOWN,
        description: visual.description || 'No description available',
        detectedText: visual.detectedText,
        data: visual.data,
        path: visual.path,
        page: visual.page,
        figureNumber: visual.figureNumber
      }))
    };
    
    multiModalChunks.push(chunk);
  }
  
  // Optionally create standalone chunks for visuals that may need their own representation
  if (keepSeparateVisualChunks) {
    for (const visual of visuals) {
      // Create descriptive content for the visual
      let visualText = `[${visual.type}] ${visual.description}`;
      
      if (visual.detectedText) {
        visualText += `\n\nText content: ${visual.detectedText}`;
      }
        
      if (visualText) {
        const visualChunk: MultiModalChunk = {
          id: uuidv4(),
          text: visualText, // Ensure text property is always set
          content: visualText,
          metadata: {
            ...metadata,
            hasVisualContent: true,
            visualCount: 1,
            isStandaloneVisual: true,
            // Set page to undefined if it doesn't exist
            page: visual.page || undefined
          },
          visualContent: [{
            ...visual,
            // Handle missing properties to ensure type safety
            path: visual.path,
            type: visual.type || VisualContentType.UNKNOWN,
            description: visual.description || 'No description available',
            // Ensure page is properly handled (could be undefined)
            page: visual.page || undefined
          }]
        };
        
        multiModalChunks.push(visualChunk);
      }
    }
  }
  
  const duration = Date.now() - startTime;
  recordMetric(
    'multiModalChunking',
    'createMultiModalChunks',
    duration,
    true,
    { 
      chunkCount: multiModalChunks.length,
      visualCount: visuals.length,
      textLength: text.length
    }
  );
  logger.info(`Created ${multiModalChunks.length} multi-modal chunks from text and ${visuals.length} visuals`);
  
  return multiModalChunks;
}

/**
 * Process a document with both text and visual content
 * 
 * @param textContent - The document's text content
 * @param imagePaths - Paths to images extracted from the document
 * @param sourceMetadata - Document source metadata
 * @returns Array of multi-modal chunks
 */
export async function processDocumentWithVisualContent(
  textContent: string,
  imagePaths: string[],
  sourceMetadata: Record<string, any>,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    keepSeparateVisualChunks?: boolean;
  } = {}
): Promise<MultiModalChunk[]> {
  const startTime = Date.now();
  logger.info(`Processing document with ${imagePaths.length} images`);
  
  // 1. Process all images to extract information
  const visualContents: VisualContent[] = [];
  let visualProcessingErrors = 0;
  
  for (let i = 0; i < imagePaths.length; i++) {
    try {
      const imagePath = imagePaths[i];
      const pageNumber = getPageNumberFromImagePath(imagePath);
      
      const analysisResult = await analyzeImage(imagePath);
      
      const visualContent: VisualContent = {
        path: imagePath,
        page: pageNumber ?? undefined, // Use nullish coalescing to convert null to undefined
        figureNumber: i + 1, // Simple sequential numbering
        type: analysisResult.type,
        description: analysisResult.description,
        detectedText: analysisResult.extractedText
      };
      
      visualContents.push(visualContent);
    } catch (error) {
      logger.error(`Error processing image ${i + 1}:`, error);
      visualProcessingErrors++;
    }
  }
  
  // 2. Create multi-modal chunks
  const enhancedMetadata = {
    ...sourceMetadata,
    processingError: visualProcessingErrors > 0 ? 
      `Failed to process ${visualProcessingErrors} images` : undefined
  };
  
  const chunks = await createMultiModalChunks(
    textContent,
    visualContents,
    enhancedMetadata,
    options
  );
  
  const duration = Date.now() - startTime;
  recordMetric(
    'multiModalChunking',
    'processDocumentWithVisualContent',
    duration,
    true,
    { 
      chunkCount: chunks.length,
      visualCount: visualContents.length,
      textLength: textContent.length
    }
  );
  logger.info(`Completed multi-modal processing in ${duration}ms`);
  
  return chunks;
}

/**
 * Extract page number from image path
 * Expected format: something_page_X.jpg or similar
 * 
 * @param imagePath - Path to the image file
 * @returns Page number if found, otherwise undefined
 */
function getPageNumberFromImagePath(imagePath: string): number | undefined {
  // Extract page number from filename patterns like page_X or page-X
  const pageMatch = imagePath.match(/page[_-](\d+)/i);
  if (pageMatch && pageMatch[1]) {
    return parseInt(pageMatch[1], 10);
  }
  
  return undefined;
} 
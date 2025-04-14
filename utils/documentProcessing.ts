import fs from 'fs';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { extractDocumentContext, generateChunkContext } from './geminiClient';
import { analyzeDocument } from './documentAnalysis';
import { 
  ContextualChunk as BaseContextualChunk, 
  DocumentContext, 
  SplitIntoChunksWithContextFn,
  ChunkContext as BaseChunkContext 
} from '../types/documentProcessing';

export type SupportedMimeType = 
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain';

/**
 * Extract text content from various document formats
 * @param filePath Path to the file
 * @param mimetype MIME type of the file
 * @returns Extracted text content
 */
export async function extractText(filePath: string, mimetype: string): Promise<string> {
  try {
    if (mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const result = await pdfParse(dataBuffer);
      return result.text;
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await extractTextFromDoc(filePath);
      return result;
    } else if (mimetype === 'text/plain') {
      return fs.promises.readFile(filePath, 'utf-8');
    } else {
      throw new Error(`Unsupported file type: ${mimetype}`);
    }
  } catch (error) {
    console.error('Error extracting text:', error);
    throw new Error(`Failed to extract text from document: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function extractTextFromDoc(filePath: string): Promise<string> {
  try {
    // Read the file as a buffer
    const fileBuffer = await fs.promises.readFile(filePath);
    
    // Use the buffer directly instead of the path
    const result = await mammoth.extractRawText(fileBuffer);
    return result.value;
  } catch (error: any) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error(`Failed to extract text from DOCX file: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Detect if text contains structured information like company values, investors,
 * leadership, pricing, or sales-related content
 */
export function detectStructuredInfo(text: string): { 
  hasCompanyValues: boolean; 
  hasInvestors: boolean;
  hasLeadership: boolean;
  hasPricing: boolean;
  hasProductFeatures: boolean;
  hasSalesInfo: boolean;
} {
  const textLower = text.toLowerCase();
  
  // Detect company values
  const hasCompanyValues = 
    textLower.includes('our values') ||
    textLower.includes('company values') ||
    textLower.includes('core values') ||
    textLower.includes('our culture') ||
    textLower.includes('culture') ||
    textLower.includes('mission statement') ||
    textLower.includes('vision statement') ||
    textLower.includes('what we believe') ||
    textLower.includes('our beliefs') ||
    textLower.includes('our mission') ||
    textLower.includes('our vision');
  
  // Detect investor information
  const hasInvestors =
    textLower.includes('investor') ||
    textLower.includes('investors') ||
    textLower.includes('funding') ||
    textLower.includes('backed by') ||
    textLower.includes('investment') ||
    textLower.includes('venture capital') ||
    textLower.includes('series ') ||
    textLower.includes('financing') ||
    textLower.includes('raised');
  
  // Detect leadership information
  const hasLeadership =
    textLower.includes('founder') || 
    textLower.includes('founders') || 
    textLower.includes('ceo') ||
    textLower.includes('cto') ||
    textLower.includes('cfo') ||
    textLower.includes('chief') ||
    textLower.includes('president') ||
    textLower.includes('executive') ||
    textLower.includes('director') ||
    textLower.includes('head of') ||
    textLower.includes('lead') ||
    textLower.includes('manager') ||
    textLower.includes('management team') ||
    textLower.includes('leadership team');

  // Detect pricing information
  const hasPricing =
    textLower.includes('pricing') ||
    textLower.includes('price') ||
    textLower.includes('cost') ||
    textLower.includes('subscription') ||
    textLower.includes('tier') ||
    textLower.includes('plan') ||
    textLower.includes('package') ||
    textLower.includes('fee') ||
    textLower.includes('$ ') ||
    textLower.includes('dollar') ||
    textLower.includes('per month') ||
    textLower.includes('per year') ||
    textLower.includes('monthly') ||
    textLower.includes('annually') ||
    textLower.includes('free trial');

  // Detect product features
  const hasProductFeatures =
    textLower.includes('feature') ||
    textLower.includes('benefits') ||
    textLower.includes('capabilities') ||
    textLower.includes('functionality') ||
    textLower.includes('module') ||
    textLower.includes('component') ||
    textLower.includes('how it works') ||
    textLower.includes('what it does') ||
    textLower.includes('our product') ||
    textLower.includes('platform');

  // Detect sales-specific information
  const hasSalesInfo =
    textLower.includes('sales pitch') ||
    textLower.includes('pitch deck') ||
    textLower.includes('value proposition') ||
    textLower.includes('why choose us') ||
    textLower.includes('competitor') ||
    textLower.includes('vs.') ||
    textLower.includes('versus') ||
    textLower.includes('comparison') ||
    textLower.includes('case study') ||
    textLower.includes('success story') ||
    textLower.includes('testimonial') ||
    textLower.includes('roi') ||
    textLower.includes('return on investment');
  
  return { 
    hasCompanyValues, 
    hasInvestors,
    hasLeadership,
    hasPricing,
    hasProductFeatures,
    hasSalesInfo
  };
}

/**
 * Split text into chunks of approximately the specified size
 * Enhanced to preserve context and structured information
 * @param text Text to split
 * @param chunkSize Target size for each chunk
 * @param source Optional source metadata for context-aware chunking
 * @returns Array of text chunks with metadata
 */
export function splitIntoChunks(
  text: string, 
  chunkSize: number = 500,
  source?: string
): Array<{ text: string; metadata?: { isStructured?: boolean; infoType?: string; } }> {
  // Remove excess whitespace
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  
  // Ensure source is treated as a string for checks below
  const sourceString = typeof source === 'string' ? source : ''; // Default to empty string if not a string
  
  if (cleanedText.length <= chunkSize) {
    // For small text, check if it contains structured information
    const structuredInfo = detectStructuredInfo(cleanedText);
    const metadata: { isStructured?: boolean; infoType?: string } = {};
    
    if (structuredInfo.hasCompanyValues || structuredInfo.hasInvestors || structuredInfo.hasLeadership ||
        structuredInfo.hasPricing || structuredInfo.hasProductFeatures || structuredInfo.hasSalesInfo) {
      metadata.isStructured = true;
      
      if (structuredInfo.hasCompanyValues) {
        metadata.infoType = 'company_values';
      } else if (structuredInfo.hasInvestors) {
        metadata.infoType = 'investors';
      } else if (structuredInfo.hasLeadership) {
        metadata.infoType = 'leadership';
      } else if (structuredInfo.hasPricing) {
        metadata.infoType = 'pricing';
      } else if (structuredInfo.hasProductFeatures) {
        metadata.infoType = 'product_features';
      } else if (structuredInfo.hasSalesInfo) {
        metadata.infoType = 'sales_info';
      }
    }
    
    return [{ text: cleanedText, metadata }];
  }

  // If this is a careers or about page, we may need special handling
  const isAboutPage = sourceString.includes('/about') || sourceString.toLowerCase().includes('about us');
  const isCareersPage = sourceString.includes('/careers') || sourceString.toLowerCase().includes('careers');
  
  // For career and about pages, try to locate sections for special handling
  if (isAboutPage || isCareersPage) {
    return splitStructuredContent(cleanedText, chunkSize, sourceString);
  }

  // Standard chunking for other content
  return splitRegularContent(cleanedText, chunkSize);
}

/**
 * Split potentially structured content like about pages and careers pages
 * Preserves sections related to company information
 */
function splitStructuredContent(
  text: string,
  chunkSize: number,
  source?: string
): Array<{ text: string; metadata?: { isStructured?: boolean; infoType?: string; } }> {
  const chunks: Array<{ text: string; metadata?: { isStructured?: boolean; infoType?: string; } }> = [];
  
  // Try to identify sections in the text
  const sections = identifySections(text);
  
  // If we identified structured sections, process them specially
  if (sections.length > 0) {
    for (const section of sections) {
      const structuredInfo = detectStructuredInfo(section.text);
      const metadata: { isStructured?: boolean; infoType?: string } = {};
      
      if (structuredInfo.hasCompanyValues) {
        metadata.isStructured = true;
        metadata.infoType = 'company_values';
      } else if (structuredInfo.hasInvestors) {
        metadata.isStructured = true;
        metadata.infoType = 'investors';
      } else if (structuredInfo.hasLeadership) {
        metadata.isStructured = true;
        metadata.infoType = 'leadership';
      } else if (structuredInfo.hasPricing) {
        metadata.isStructured = true;
        metadata.infoType = 'pricing';
      } else if (structuredInfo.hasProductFeatures) {
        metadata.isStructured = true;
        metadata.infoType = 'product_features';
      } else if (structuredInfo.hasSalesInfo) {
        metadata.isStructured = true;
        metadata.infoType = 'sales_info';
      }
      
      // If this is a structured section, try to keep it intact if possible
      if (metadata.isStructured && section.text.length <= chunkSize * 1.5) {
        chunks.push({ text: section.text, metadata });
      } else {
        // If too large, split but preserve the metadata
        const sectionChunks = splitRegularContent(section.text, chunkSize);
        for (const chunk of sectionChunks) {
          if (metadata.isStructured) {
            chunk.metadata = { ...metadata };
          }
          chunks.push(chunk);
        }
      }
    }
    
    return chunks;
  }
  
  // If we couldn't identify structured sections, fall back to regular chunking
  return splitRegularContent(text, chunkSize);
}

/**
 * Identify potential sections in text based on headings and patterns
 */
function identifySections(text: string): Array<{ text: string; type?: string }> {
  const sections: Array<{ text: string; type?: string }> = [];
  
  // Common section indicators
  const sectionIndicators = [
    'our values', 'company values', 'our investors', 'our mission',
    'leadership', 'team', 'about us', 'our story', 'vision',
    'what we do', 'who we are', 'our investors'
  ];
  
  // Try to split by common headings and indicators
  let remainingText = text;
  
  // First pass: Look for section headings
  for (const indicator of sectionIndicators) {
    const indicatorRegex = new RegExp(`(^|\\s)${indicator}[:\\s]`, 'i');
    const match = remainingText.match(indicatorRegex);
    
    if (match && match.index !== undefined) {
      // Find the next section indicator after this one
      let nextIndex = remainingText.length;
      for (const nextIndicator of sectionIndicators) {
        if (nextIndicator === indicator) continue;
        
        const nextRegex = new RegExp(`(^|\\s)${nextIndicator}[:\\s]`, 'i');
        const nextMatch = remainingText.slice(match.index + indicator.length).match(nextRegex);
        
        if (nextMatch && nextMatch.index !== undefined) {
          nextIndex = Math.min(nextIndex, match.index + indicator.length + nextMatch.index);
        }
      }
      
      // Extract this section
      const sectionText = remainingText.slice(
        Math.max(0, match.index - 20), // Include some context before
        nextIndex + 20 // Include some context after
      ).trim();
      
      if (sectionText.length > 50) { // Ensure it's a meaningful section
        sections.push({ text: sectionText, type: indicator });
      }
    }
  }
  
  // If we didn't find sections, try another approach with paragraph breaks
  if (sections.length === 0) {
    const paragraphs = text.split(/\n\s*\n/);
    let currentSection = "";
    let currentType: string | undefined = undefined;
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim().length < 10) continue; // Skip very short paragraphs
      
      // Check if this paragraph starts a new section
      let foundNewSection = false;
      for (const indicator of sectionIndicators) {
        if (paragraph.toLowerCase().includes(indicator)) {
          // If we have a current section, add it before starting a new one
          if (currentSection.length > 0) {
            sections.push({ text: currentSection, type: currentType });
          }
          
          // Start a new section
          currentSection = paragraph;
          currentType = indicator;
          foundNewSection = true;
          break;
        }
      }
      
      // If not a new section, add to current section
      if (!foundNewSection) {
        if (currentSection.length > 0) {
          currentSection += "\n\n" + paragraph;
        } else {
          currentSection = paragraph;
        }
      }
    }
    
    // Add the final section if it exists
    if (currentSection.length > 0) {
      sections.push({ text: currentSection, type: currentType });
    }
  }
  
  // If we still don't have sections, create one for the whole text
  if (sections.length === 0) {
    sections.push({ text });
  }
  
  return sections;
}

/**
 * Split regular non-structured content into chunks of appropriate size
 * Enhanced to prioritize paragraph breaks for chunk boundaries
 */
function splitRegularContent(
  text: string,
  chunkSize: number
): Array<{ text: string; metadata?: { isStructured?: boolean; infoType?: string; } }> {
  // Initial cleaning
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  
  // If the text is already small enough, return it as-is
  if (cleanedText.length <= chunkSize) {
    return [{ text: cleanedText }];
  }
  
  const chunks: Array<{ text: string; metadata?: { isStructured?: boolean; infoType?: string; } }> = [];
  
  // First, try to split on double newlines (paragraph breaks)
  const paragraphs = text.split(/\n\s*\n+/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // Clean the paragraph
    const cleanedParagraph = paragraph.replace(/\s+/g, ' ').trim();
    
    if (!cleanedParagraph) continue; // Skip empty paragraphs
    
    // If adding this paragraph exceeds the chunk size and we already have content in the chunk
    if (currentChunk.length > 0 && (currentChunk.length + cleanedParagraph.length + 1) > chunkSize) {
      // Save the current chunk
      chunks.push({ text: currentChunk });
      currentChunk = cleanedParagraph;
    } 
    // If this single paragraph is larger than the chunk size
    else if (cleanedParagraph.length > chunkSize) {
      // If we have content in the current chunk, save it first
      if (currentChunk.length > 0) {
        chunks.push({ text: currentChunk });
        currentChunk = '';
      }
      
      // Split the large paragraph on sentence boundaries
      const sentences = cleanedParagraph.match(/[^.!?]+[.!?]+/g) || [cleanedParagraph];
      let sentenceChunk = '';
      
      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length + 1 <= chunkSize || sentenceChunk.length === 0) {
          sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
        } else {
          chunks.push({ text: sentenceChunk });
          sentenceChunk = sentence;
        }
      }
      
      // Add any remaining sentence chunk
      if (sentenceChunk) {
        if (currentChunk.length + sentenceChunk.length + 1 <= chunkSize) {
          currentChunk += (currentChunk ? ' ' : '') + sentenceChunk;
        } else {
          chunks.push({ text: sentenceChunk });
        }
      }
    } 
    // Otherwise, add the paragraph to the current chunk
    else {
      currentChunk += (currentChunk ? ' ' : '') + cleanedParagraph;
    }
  }
  
  // Add the last chunk if there's any content left
  if (currentChunk) {
    chunks.push({ text: currentChunk });
  }
  
  return chunks;
}

/**
 * Find the last complete sentence in a text
 */
function findLastSentence(text: string): string | null {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 0) {
    return sentences[sentences.length - 1];
  }
  return null;
}

/**
 * Split text into chunks with enhanced contextual information
 * 
 * This advanced chunking method extracts contextual information about each chunk
 * to improve retrieval accuracy and answer generation quality.
 * 
 * @param text The text to split into chunks
 * @param chunkSize Size of each chunk
 * @param source Source identifier for the document
 * @param generateContext Whether to generate context for each chunk
 * @param existingContext Optional existing document context to use
 * @returns Array of chunks with contextual metadata
 */
export const splitIntoChunksWithContext: SplitIntoChunksWithContextFn = async (
  text,
  chunkSize = 500,
  source = 'unknown',
  generateContext = true,
  existingContext
) => {
  // First, generate chunks using the standard method as a base
  const baseChunks = splitIntoChunks(text, chunkSize, source);
  
  // If context generation is disabled, return the base chunks
  if (!generateContext) {
    return baseChunks as BaseContextualChunk[];
  }
  
  // Extract document-level context if not already provided
  let documentContext: DocumentContext;
  try {
    if (existingContext) {
      documentContext = existingContext as DocumentContext;
      console.log('Using provided document context');
    } else {
      console.log('Extracting document context...');
      // Use the new consolidated document analysis function instead
      const documentAnalysis = await analyzeDocument(text, source);
      documentContext = documentAnalysis.documentContext;
      console.log('Document context extracted successfully');
    }
  } catch (error) {
    console.error('Error extracting document context:', error);
    // If document context extraction fails, return base chunks
    return baseChunks as BaseContextualChunk[];
  }
  
  // Process each chunk to add contextual information
  const enhancedChunks: BaseContextualChunk[] = [];
  console.log(`Processing ${baseChunks.length} chunks for contextual enhancement...`);
  
  // Process chunks in batches to avoid overwhelming the API
  const batchSize = 5;
  for (let i = 0; i < baseChunks.length; i += batchSize) {
    const batch = baseChunks.slice(i, i + batchSize);
    const batchPromises = batch.map(async (chunk) => {
      try {
        // Skip empty chunks
        if (!chunk.text.trim()) {
          return {
            text: chunk.text,
            metadata: chunk.metadata
          } as BaseContextualChunk;
        }
        
        // Generate context for this chunk
        const chunkContext = await generateChunkContext(chunk.text, documentContext);
        
        // Create enhanced chunk with context
        return {
          text: chunk.text,
          metadata: {
            ...(chunk.metadata || {}),
            source,
            // Map fields from generateChunkContext and add required defaults
            context: {
              description: chunkContext.summary || '', // Use summary as description, or default
              keyPoints: chunkContext.keyPoints || [], // Use existing keyPoints or default
              isDefinition: false, // Default
              containsExample: false, // Default
              relatedTopics: [] // Default
            }
          }
        } as BaseContextualChunk;
      } catch (error) {
        console.error(`Error generating context for chunk: ${error}`);
        // If chunk context generation fails, return the base chunk
        return {
          text: chunk.text,
          metadata: chunk.metadata
        } as BaseContextualChunk;
      }
    });
    
    // Wait for all chunks in this batch to be processed
    const processBatchResults = await Promise.all(batchPromises);
    enhancedChunks.push(...processBatchResults);
    
    console.log(`Processed batch ${Math.ceil(i / batchSize) + 1}/${Math.ceil(baseChunks.length / batchSize)}`);
  }
  
  console.log(`Enhanced ${enhancedChunks.length} chunks with contextual information`);
  return enhancedChunks;
};

/**
 * Prepare text for embedding by adding contextual information
 * @param chunk Chunk with text and metadata
 * @returns Enhanced text string to be embedded
 */
export function prepareTextForEmbedding(chunk: BaseContextualChunk): string {
  // Convert to our extended type
  const extendedChunk = asExtendedChunk(chunk);
  
  // Start with original text
  const originalText = extendedChunk.text;
  const contextParts: string[] = [];
  
  // Add source if available
  if (extendedChunk.metadata?.source) {
    contextParts.push(`Source: ${extendedChunk.metadata.source}`);
  }
  
  // --- DOCUMENT CONTEXT ---
  if (extendedChunk.metadata?.context) {
    // Convert to our extended context type
    const extendedContext = asExtendedContext(extendedChunk.metadata.context);
    
    if (extendedContext.document) {
      const docContext = extendedContext.document;
      
      // Add document summary
      if (docContext.summary) {
        contextParts.push(`Document summary: ${docContext.summary}`);
      }
      
      // Add document topics
      if (docContext.mainTopics && docContext.mainTopics.length > 0) {
        contextParts.push(`Document topics: ${docContext.mainTopics.join(', ')}`);
      }
      
      // Add document type and technical level
      if (docContext.documentType) {
        let docTypeInfo = `Document type: ${docContext.documentType}`;
        if (docContext.technicalLevel !== undefined) {
          const techLevelTerms = ['non-technical', 'basic', 'intermediate', 'advanced'];
          const techLevel = techLevelTerms[Math.min(docContext.technicalLevel, 3)];
          docTypeInfo += `, ${techLevel} level`;
        }
        contextParts.push(docTypeInfo);
      }
      
      // Add audience information
      if (docContext.audienceType && docContext.audienceType.length > 0) {
        contextParts.push(`Audience: ${docContext.audienceType.join(', ')}`);
      }
    }
  }
  
  // --- CHUNK CONTEXT ---
  if (extendedChunk.metadata?.context) {
    const context = extendedChunk.metadata.context;
    
    // Add chunk description
    if (context.description) {
      contextParts.push(`Content: ${context.description}`);
    }
    
    // Add key points
    if (context.keyPoints && context.keyPoints.length > 0) {
      contextParts.push(`Key points: ${context.keyPoints.join('; ')}`);
    }
    
    // Add semantic markers for special content types
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
    
    // Add related topics for better semantic search
    if (context.relatedTopics && context.relatedTopics.length > 0) {
      contextParts.push(`Related topics: ${context.relatedTopics.join(', ')}`);
    }
  }
  
  // --- VISUAL CONTENT ---
  // Add visual content information if available
  if (extendedChunk.metadata?.hasVisualContent && Array.isArray(extendedChunk.visualContent) && extendedChunk.visualContent.length > 0) {
    const visualDescriptions = extendedChunk.visualContent.map((visual: {
      type: string;
      description?: string;
      detectedText?: string;
      extractedText?: string;
    }) => {
      let desc = `${visual.type}`;
      if (visual.description) {
        desc += `: ${visual.description.substring(0, 100)}`;
      }
      if (visual.detectedText) {
        const truncatedText = visual.detectedText.length > 50 
          ? visual.detectedText.substring(0, 50) + '...' 
          : visual.detectedText;
        desc += ` [Text: ${truncatedText}]`;
      }
      return desc;
    });
    
    contextParts.push(`Visual content: ${visualDescriptions.join(' | ')}`);
  }
  
  // Add structured info type if available
  if (extendedChunk.metadata?.isStructured && extendedChunk.metadata?.infoType) {
    contextParts.push(`Content type: ${extendedChunk.metadata.infoType.replace(/_/g, ' ')}`);
  }
  
  // If we have contextual parts, format them as a structured context prefix
  if (contextParts.length > 0) {
    // Group context by categories to make it more readable and useful for embedding
    return `[CONTEXT: ${contextParts.join(' | ')}] ${originalText}`;
  }
  
  // If no context is available, return the original text
  return originalText;
}

// Extend the ChunkContext interface to add the document property
export interface ChunkContext extends BaseChunkContext {
  document?: {
    summary?: string;
    mainTopics?: string[];
    documentType?: string;
    technicalLevel?: number;
    audienceType?: string[];
  };
}

// Extend the ContextualChunk interface to add visual content support
export interface ContextualChunk extends BaseContextualChunk {
  visualContent?: Array<{
    type: string;
    description: string;
    extractedText?: string;
    detectedText?: string;
    path?: string;
    position?: any;
  }>;
  metadata?: BaseContextualChunk['metadata'] & {
    hasVisualContent?: boolean;
  };
}

// Type assertion function to ensure we're using our extended interfaces
function asExtendedChunk(chunk: BaseContextualChunk): ContextualChunk {
  return chunk as ContextualChunk;
}

// Type assertion function to ensure we're using our extended context interface
function asExtendedContext(context: BaseChunkContext): ChunkContext {
  return context as ChunkContext;
} 
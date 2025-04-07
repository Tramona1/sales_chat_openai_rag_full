import fs from 'fs';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

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
  const isAboutPage = source?.includes('/about') || source?.toLowerCase().includes('about us');
  const isCareersPage = source?.includes('/careers') || source?.toLowerCase().includes('careers');
  
  // For career and about pages, try to locate sections for special handling
  if (isAboutPage || isCareersPage) {
    return splitStructuredContent(cleanedText, chunkSize, source);
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
 * Split text using the standard chunking algorithm
 * @param text Text to split
 * @param chunkSize Target size for each chunk
 * @returns Array of text chunks
 */
function splitRegularContent(
  text: string,
  chunkSize: number
): Array<{ text: string; metadata?: { isStructured?: boolean; infoType?: string; } }> {
  const chunks: Array<{ text: string; metadata?: { isStructured?: boolean; infoType?: string; } }> = [];
  
  let currentIndex = 0;
  while (currentIndex < text.length) {
    // Get a chunk of approximately the target size
    let chunk = text.substring(currentIndex, currentIndex + chunkSize);
    
    // If we're not at the end of the text, try to break at a natural boundary
    if (currentIndex + chunkSize < text.length) {
      // Look for paragraph breaks first (ideal breaking point)
      const paragraphBreak = chunk.lastIndexOf('\n\n');
      
      // Then look for the last sentence break in this chunk
      const sentenceBreaks = [
        chunk.lastIndexOf('. '),
        chunk.lastIndexOf('? '),
        chunk.lastIndexOf('! '),
        chunk.lastIndexOf('.\n'),
        chunk.lastIndexOf('?\n'),
        chunk.lastIndexOf('!\n')
      ];
      const lastSentenceBreak = Math.max(...sentenceBreaks);
      
      // Use paragraph break if available and reasonable, otherwise use sentence break
      if (paragraphBreak > chunkSize * 0.5) {
        chunk = chunk.substring(0, paragraphBreak);
      } else if (lastSentenceBreak > chunkSize * 0.3) {
        // If the sentence break is at least 30% through the chunk
        const breakType = sentenceBreaks.indexOf(lastSentenceBreak);
        // Add 2 to include the period and space/newline
        chunk = chunk.substring(0, lastSentenceBreak + (breakType >= 3 ? 2 : 2));
      }
    }
    
    // Create chunkObj with proper type that includes optional metadata
    const chunkObj: { text: string; metadata?: { isStructured: boolean; infoType?: string } } = { 
      text: chunk.trim() 
    };
    
    const structuredInfo = detectStructuredInfo(chunk);
    
    if (structuredInfo.hasCompanyValues || structuredInfo.hasInvestors || structuredInfo.hasLeadership ||
        structuredInfo.hasPricing || structuredInfo.hasProductFeatures || structuredInfo.hasSalesInfo) {
      const metadata: { isStructured: boolean; infoType?: string } = { isStructured: true };
      
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
      
      chunkObj.metadata = metadata;
    }
    
    chunks.push(chunkObj);
    currentIndex += chunk.length;
    
    // Add slight overlap for context if needed
    if (currentIndex < text.length) {
      const lastSentence = findLastSentence(chunk);
      if (lastSentence && lastSentence.length < chunkSize * 0.2) {
        currentIndex -= lastSentence.length;
      }
    }
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
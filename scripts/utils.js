/**
 * Utils.js - Script utility functions
 * JavaScript version of utility functions needed for the batch processing scripts
 */
const fs = require('fs');
const path = require('path');

// Path to the vector store file
const VECTOR_STORE_FILE = path.join(process.cwd(), 'data', 'vectorStore.json');

// Document processing utilities
function splitIntoChunks(text, chunkSize = 500, source = '') {
  // Remove excess whitespace
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  
  if (cleanedText.length <= chunkSize) {
    // For small text, check if it contains structured information
    const structuredInfo = detectStructuredInfo(cleanedText);
    const metadata = {};
    
    if (structuredInfo.hasCompanyValues || structuredInfo.hasInvestors || structuredInfo.hasLeadership) {
      metadata.isStructured = true;
      
      if (structuredInfo.hasCompanyValues) {
        metadata.infoType = 'company_values';
      } else if (structuredInfo.hasInvestors) {
        metadata.infoType = 'investors';
      } else if (structuredInfo.hasLeadership) {
        metadata.infoType = 'leadership';
      }
    }
    
    return [{ text: cleanedText, metadata }];
  }

  // If this is a careers or about page, we may need special handling
  const isAboutPage = source.includes('/about') || source.toLowerCase().includes('about us');
  const isCareersPage = source.includes('/careers') || source.toLowerCase().includes('careers');
  
  if (isAboutPage || isCareersPage) {
    // For about and careers pages, try to detect sections with company information
    return splitStructuredContent(cleanedText, chunkSize, source);
  }

  // Standard chunking for other content
  return splitRegularContent(cleanedText, chunkSize);
}

/**
 * Detect if text contains structured company information like values or investors
 */
function detectStructuredInfo(text) {
  const lowercaseText = text.toLowerCase();
  
  const valueIndicators = [
    'our values', 'company values', 'core values', 'values', 'at the core',
    'what we believe', 'our principles', 'we believe'
  ];
  
  const investorIndicators = [
    'our investors', 'backed by', 'investor', 'funding', 'investment',
    'venture capital', 'capital', 'partners'
  ];
  
  const leadershipIndicators = [
    'leadership', 'founders', 'board', 'executive', 'ceo', 'cto', 'cfo',
    'chief', 'director', 'head of', 'president'
  ];
  
  const hasCompanyValues = valueIndicators.some(indicator => 
    lowercaseText.includes(indicator)
  );
  
  const hasInvestors = investorIndicators.some(indicator => 
    lowercaseText.includes(indicator)
  );
  
  const hasLeadership = leadershipIndicators.some(indicator => 
    lowercaseText.includes(indicator)
  );
  
  return { hasCompanyValues, hasInvestors, hasLeadership };
}

/**
 * Split content that might have structured information like company values or investors
 */
function splitStructuredContent(text, chunkSize, source) {
  const chunks = [];
  
  // Try to identify sections in the text
  const paragraphs = text.split(/\n\s*\n/);
  let currentSection = "";
  let currentType = null;
  
  // Common section indicators
  const sectionIndicators = [
    'our values', 'company values', 'our investors', 'our mission',
    'leadership', 'team', 'about us', 'our story', 'vision',
    'what we do', 'who we are'
  ];
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim().length < 10) continue; // Skip very short paragraphs
    
    // Check if this paragraph starts a new section
    let foundNewSection = false;
    for (const indicator of sectionIndicators) {
      if (paragraph.toLowerCase().includes(indicator)) {
        // If we have a current section, add it before starting a new one
        if (currentSection.length > 0) {
          const structuredInfo = detectStructuredInfo(currentSection);
          const metadata = {};
          
          if (structuredInfo.hasCompanyValues || structuredInfo.hasInvestors || structuredInfo.hasLeadership) {
            metadata.isStructured = true;
            
            if (structuredInfo.hasCompanyValues) {
              metadata.infoType = 'company_values';
            } else if (structuredInfo.hasInvestors) {
              metadata.infoType = 'investors';
            } else if (structuredInfo.hasLeadership) {
              metadata.infoType = 'leadership';
            }
          }
          
          chunks.push({ text: currentSection, metadata });
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
    const structuredInfo = detectStructuredInfo(currentSection);
    const metadata = {};
    
    if (structuredInfo.hasCompanyValues || structuredInfo.hasInvestors || structuredInfo.hasLeadership) {
      metadata.isStructured = true;
      
      if (structuredInfo.hasCompanyValues) {
        metadata.infoType = 'company_values';
      } else if (structuredInfo.hasInvestors) {
        metadata.infoType = 'investors';
      } else if (structuredInfo.hasLeadership) {
        metadata.infoType = 'leadership';
      }
    }
    
    chunks.push({ text: currentSection, metadata });
  }
  
  // If we didn't create any sections, fallback to regular chunking
  if (chunks.length === 0) {
    return splitRegularContent(text, chunkSize);
  }
  
  // For large sections, split them further
  const result = [];
  for (const chunk of chunks) {
    if (chunk.text.length <= chunkSize * 1.5) {
      result.push(chunk);
    } else {
      const subChunks = splitRegularContent(chunk.text, chunkSize);
      // Preserve metadata from the parent chunk
      for (const subChunk of subChunks) {
        if (chunk.metadata && chunk.metadata.isStructured) {
          subChunk.metadata = { ...chunk.metadata };
        }
        result.push(subChunk);
      }
    }
  }
  
  return result;
}

/**
 * Split text using standard algorithm
 */
function splitRegularContent(text, chunkSize) {
  const chunks = [];
  
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
        chunk = chunk.substring(0, lastSentenceBreak + 2);
      }
    }
    
    const chunkObj = { text: chunk.trim() };
    const structuredInfo = detectStructuredInfo(chunk);
    
    if (structuredInfo.hasCompanyValues || structuredInfo.hasInvestors || structuredInfo.hasLeadership) {
      const metadata = { isStructured: true };
      
      if (structuredInfo.hasCompanyValues) {
        metadata.infoType = 'company_values';
      } else if (structuredInfo.hasInvestors) {
        metadata.infoType = 'investors';
      } else if (structuredInfo.hasLeadership) {
        metadata.infoType = 'leadership';
      }
      
      chunkObj.metadata = metadata;
    }
    
    chunks.push(chunkObj);
    currentIndex += chunk.length;
  }

  return chunks;
}

// Load the vector store from file
function loadVectorStore() {
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(VECTOR_STORE_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Load the vector store file if it exists
    if (fs.existsSync(VECTOR_STORE_FILE)) {
      const data = fs.readFileSync(VECTOR_STORE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      
      // Ensure the vector store has an items array
      if (!parsed.items) {
        return { items: Array.isArray(parsed) ? parsed : [] };
      }
      
      return parsed;
    }
    
    // Return an empty vector store if file doesn't exist
    return { items: [] };
  } catch (error) {
    console.error(`Error loading vector store: ${error.message}`);
    return { items: [] };
  }
}

// Save the vector store to file
function saveVectorStore(vectorStore) {
  try {
    // Ensure vectorStore has an items property
    const dataToSave = vectorStore.items ? vectorStore : { items: Array.isArray(vectorStore) ? vectorStore : [] };
    
    fs.writeFileSync(VECTOR_STORE_FILE, JSON.stringify(dataToSave, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving vector store: ${error.message}`);
    return false;
  }
}

// Add items to the vector store
function addToVectorStore(items) {
  try {
    // Load the existing vector store
    let vectorStore = loadVectorStore();
    
    // Ensure vectorStore has an items array
    if (!vectorStore.items) {
      vectorStore = { items: [] };
    }
    
    // Add the new items
    if (Array.isArray(items)) {
      vectorStore.items.push(...items);
    } else {
      vectorStore.items.push(items);
    }
    
    // Save the updated vector store
    saveVectorStore(vectorStore);
    
    console.log(`  Added ${Array.isArray(items) ? items.length : 1} items to vector store`);
    return true;
  } catch (error) {
    console.error(`Error adding to vector store: ${error.message}`);
    return false;
  }
}

// Clear the vector store (delete all items)
function clearVectorStore() {
  try {
    // Create empty vector store
    const emptyStore = { items: [] };
    
    // Save the empty vector store
    saveVectorStore(emptyStore);
    
    console.log('Vector store has been cleared successfully');
    return true;
  } catch (error) {
    console.error(`Error clearing vector store: ${error.message}`);
    return false;
  }
}

module.exports = {
  splitIntoChunks,
  detectStructuredInfo,
  addToVectorStore,
  loadVectorStore,
  saveVectorStore,
  clearVectorStore
}; 
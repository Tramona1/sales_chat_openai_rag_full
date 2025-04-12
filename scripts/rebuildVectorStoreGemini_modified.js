/**
 * Full Vector Store Rebuild Script for Gemini Migration
 * 
 * This script rebuilds the vector store using Gemini embeddings and
 * stores the results in Supabase.
 * 
 * Usage: node scripts/rebuildVectorStoreGemini_modified.js
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Setup dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Constants
const CRAWL_DATA_FILE = path.resolve(process.cwd(), 'data/workstream_crawl_data_transformed.json');
const BACKUP_DIR = path.resolve(process.cwd(), `data/backups/vector_store_${Date.now()}`);
const BATCH_SIZE = 10; // Number of documents to process in parallel
const REBUILD_LOG_PATH = path.resolve(process.cwd(), 'data/logs/rebuild_gemini.log');
// Updated embedding model - using the proper model for embeddings
const EMBEDDING_MODEL = "text-embedding-004";  // Using the correct model name
const GENERATION_MODEL = "gemini-2.0-flash"; // Using the verified working model

// Validate Gemini API key
const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Error: GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable is not set');
  process.exit(1);
}

// Initialize Google AI client
const googleAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Validate Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Logger setup
function setupLogger() {
  // Create logs directory if it doesn't exist
  const logsDir = path.resolve(process.cwd(), 'data/logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const logStream = fs.createWriteStream(REBUILD_LOG_PATH, { flags: 'a' });
  
  return {
    info: (message) => {
      const formattedMessage = `[INFO] [${new Date().toISOString()}] ${message}`;
      console.log(formattedMessage);
      logStream.write(formattedMessage + '\n');
    },
    error: (message, error) => {
      // Even more detailed error logging
      let errorDetails;
      try {
        if (error?.code) {
          // If it's a structured error object
          errorDetails = JSON.stringify({
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            statusCode: error.statusCode
          }, null, 2);
        } else if (typeof error === 'object') {
          // If it's an object but not a structured error
          errorDetails = JSON.stringify(error, null, 2);
        } else {
          // If it's a primitive
          errorDetails = error;
        }
      } catch (e) {
        // In case JSON.stringify fails
        errorDetails = `Error stringifying error object: ${e.message}`;
      }
      
      const formattedMessage = `[ERROR] [${new Date().toISOString()}] ${message}:\n${errorDetails}`;
      console.error(formattedMessage);
      logStream.write(formattedMessage + '\n');
    },
    debug: (message, data) => {
      let dataStr;
      try {
        dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
      } catch (e) {
        dataStr = `[Unstringifiable data: ${e.message}]`;
      }
      const formattedMessage = `[DEBUG] [${new Date().toISOString()}] ${message}:\n${dataStr}`;
      console.log(formattedMessage);
      logStream.write(formattedMessage + '\n');
    },
    success: (message) => {
      const formattedMessage = `[SUCCESS] [${new Date().toISOString()}] ${message}`;
      console.log(formattedMessage);
      logStream.write(formattedMessage + '\n');
    },
    warning: (message) => {
      const formattedMessage = `[WARNING] [${new Date().toISOString()}] ${message}`;
      console.warn(formattedMessage);
      logStream.write(formattedMessage + '\n');
    }
  };
}

// Direct implementation of text embedding using Gemini
async function embedText(text) {
  try {
    const model = googleAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text);
    const embedding = result.embedding.values;
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Simple text splitting function
function splitTextIntoChunks(text, chunkSize = 500) {
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  for (const word of words) {
    if (currentSize + word.length + 1 > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [word];
      currentSize = word.length;
    } else {
      currentChunk.push(word);
      currentSize += word.length + 1; // +1 for the space
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

// Modified read crawl data function that processes the file line by line
function getCrawlData(logger) {
  logger.info('Reading crawl data...');
  
  if (!fs.existsSync(CRAWL_DATA_FILE)) {
    logger.error(new Error(`Crawl data file not found: ${CRAWL_DATA_FILE}`));
    process.exit(1);
  }
  
  try {
    logger.info(`Reading crawl data from: ${CRAWL_DATA_FILE}`);
    
    // Read file line by line instead of all at once
    const rawData = fs.readFileSync(CRAWL_DATA_FILE, 'utf8');
    const lines = rawData.split('\n');
    
    let docs = [];
    let currentJson = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('{"url"')) {
        // If we have accumulated JSON from previous lines, try to parse it
        if (currentJson.length > 0) {
          try {
            const data = JSON.parse(currentJson);
            docs.push({
              url: data.url,
              title: data.title || data.url,
              content: data.content || '',
              timestamp: data.timestamp
            });
          } catch (e) {
            logger.warning(`Skipping malformed JSON at line ${i-1}: ${e.message}`);
          }
          
          // Reset for the next JSON object
          currentJson = '';
        }
        
        // Start accumulating the new JSON object
        currentJson = line;
      } else if (currentJson.length > 0) {
        // Continue accumulating the current JSON object
        currentJson += line;
      }
    }
    
    // Process the last JSON object if any
    if (currentJson.length > 0) {
      try {
        const data = JSON.parse(currentJson);
        docs.push({
          url: data.url,
          title: data.title || data.url,
          content: data.content || '',
          timestamp: data.timestamp
        });
      } catch (e) {
        logger.warning(`Skipping last malformed JSON: ${e.message}`);
      }
    }
    
    logger.info(`Found ${docs.length} documents in crawl data`);
    return docs;
  } catch (error) {
    logger.error('Error reading crawl data', error);
    process.exit(1);
  }
}

// Extract context from a document using Gemini
async function extractDocumentContext(text, metadata) {
  try {
    // Use a prompt to extract key information with a structured example
    const model = googleAI.getGenerativeModel({ model: GENERATION_MODEL });
    
    const prompt = `
      Analyze this document and extract the following information in JSON format.
      
      Document content:
      ---
      ${text.substring(0, 4000)}... [truncated]
      ---
      
      Extract and return a properly formatted JSON object with these fields:
      - summary: A brief summary (2-3 sentences)
      - documentType: Document type (e.g., blog post, product page, FAQ, tutorial)
      - technicalLevel: Numeric value 1-5, where 1 is beginner and 5 is expert
      - mainTopics: Array of 3-5 key topics (strings)
      - entities: Array of key entities mentioned (organizations, products, technologies)
      - audienceType: Array of target audiences (e.g., developers, managers, general users)
      
      IMPORTANT: Your response must be a valid, parseable JSON object. Use double quotes for keys and string values. Arrays must be in the format ["item1", "item2"]. Do not include any text before or after the JSON.
      
      Example of expected JSON format:
      {
        "summary": "This document describes features of a product called Workstream.",
        "documentType": "product page",
        "technicalLevel": 2,
        "mainTopics": ["HR software", "hiring", "payroll", "employee management"],
        "entities": ["Workstream", "HR", "Payroll", "ATS"],
        "audienceType": ["HR professionals", "business owners", "recruiters"]
      }
    `;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Extract the JSON from the response (handling possible additional text)
    let contextData;
    try {
      // Try first as direct JSON
      contextData = JSON.parse(response.trim());
    } catch (parseError) {
      // If direct parsing fails, try to find JSON in the text
      const jsonMatch = response.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          contextData = JSON.parse(jsonMatch[0]);
        } catch (nestedError) {
          // If that also fails, create a basic structure with extracted info
          contextData = extractBasicContext(response, metadata);
        }
      } else {
        // If no JSON found, create a basic structure
        contextData = extractBasicContext(response, metadata);
      }
    }
    
    // Validate and ensure all expected fields exist with proper types
    return {
      summary: typeof contextData.summary === 'string' ? contextData.summary : metadata.title || '',
      documentType: typeof contextData.documentType === 'string' ? contextData.documentType : 'webpage',
      technicalLevel: typeof contextData.technicalLevel === 'number' ? 
        Math.min(Math.max(contextData.technicalLevel, 1), 5) : 3, // Ensure between 1-5
      mainTopics: Array.isArray(contextData.mainTopics) ? 
        contextData.mainTopics : extractTopicsFromText(text, metadata.title),
      entities: Array.isArray(contextData.entities) ? 
        contextData.entities : extractEntitiesFromText(text, metadata.title),
      audienceType: Array.isArray(contextData.audienceType) ? 
        contextData.audienceType : inferAudienceType(text, metadata.title)
    };
  } catch (error) {
    console.error('Error extracting document context:', error);
    // Return backup context if extraction fails
    return generateBackupContext(text, metadata);
  }
}

// Extract basic context from unstructured text response
function extractBasicContext(responseText, metadata) {
  // Try to find patterns in the response text
  const context = {
    summary: '',
    documentType: 'webpage',
    technicalLevel: 3,
    mainTopics: [],
    entities: [],
    audienceType: ['general users']
  };
  
  // Extract summary - take first paragraph or sentence that's not JSON-related
  const summaryMatch = responseText.match(/summary[:\s]+"([^"]+)"|Summary:?\s+([^\n]+)/i);
  if (summaryMatch) {
    context.summary = summaryMatch[1] || summaryMatch[2];
  } else {
    // Take first 1-2 sentences if no clear summary
    const firstSentences = responseText.split(/[.!?]/).slice(0, 2).join('. ') + '.';
    if (firstSentences.length > 20) {
      context.summary = firstSentences;
    } else {
      context.summary = metadata.title;
    }
  }
  
  // Extract document type
  const typeMatch = responseText.match(/document\s+type[:\s]+"([^"]+)"|type:?\s+([^\n,]+)/i);
  if (typeMatch) {
    context.documentType = (typeMatch[1] || typeMatch[2]).trim().toLowerCase();
  }
  
  // Extract technical level
  const levelMatch = responseText.match(/technical\s+level[:\s]+(\d)/i);
  if (levelMatch && levelMatch[1]) {
    const level = parseInt(levelMatch[1], 10);
    if (level >= 1 && level <= 5) {
      context.technicalLevel = level;
    }
  }
  
  // Extract topics
  const topicsMatch = responseText.match(/topics[:\s]+\[(.*?)\]|topics:?\s+(.*?)(?:\n|$)/i);
  if (topicsMatch) {
    const topicsText = topicsMatch[1] || topicsMatch[2];
    context.mainTopics = topicsText.split(/,\s*/).map(t => 
      t.replace(/"/g, '').trim()
    ).filter(t => t.length > 0);
  }
  
  // Extract audience
  const audienceMatch = responseText.match(/audience[:\s]+\[(.*?)\]|audience:?\s+(.*?)(?:\n|$)/i);
  if (audienceMatch) {
    const audienceText = audienceMatch[1] || audienceMatch[2];
    context.audienceType = audienceText.split(/,\s*/).map(a => 
      a.replace(/"/g, '').trim()
    ).filter(a => a.length > 0);
  }
  
  return context;
}

// Generate fallback topics from text
function extractTopicsFromText(text, title = '') {
  const combinedText = `${title} ${text.substring(0, 2000)}`;
  
  // Common business topics for fallback
  const potentialTopics = [
    'hiring', 'HR', 'payroll', 'recruitment', 'onboarding', 'compliance',
    'employee management', 'time tracking', 'scheduling', 'benefits',
    'workforce management', 'hourly employees', 'training', 'retention'
  ];
  
  // Find which topics appear in the text
  const foundTopics = potentialTopics.filter(topic => 
    new RegExp(`\\b${topic}\\b`, 'i').test(combinedText)
  );
  
  // Add the title as a topic if nothing else found
  if (foundTopics.length === 0 && title) {
    const titleWords = title.split(/[\s|]/);
    if (titleWords.length > 1) {
      // Take first two substantive words if possible
      const filteredWords = titleWords.filter(w => w.length > 3 && !['and', 'the', 'for', 'with'].includes(w.toLowerCase()));
      foundTopics.push(filteredWords.length > 0 ? filteredWords[0] : title.substring(0, 20));
    } else {
      foundTopics.push(title.substring(0, 20));
    }
  }
  
  // Always return at least some basic topics
  return foundTopics.length > 0 ? foundTopics : ['general information'];
}

// Extract entities from text
function extractEntitiesFromText(text, title = '') {
  const combinedText = `${title} ${text.substring(0, 2000)}`;
  let entities = [];
  
  // Common named entities in the domain
  const commonEntities = ['Workstream', 'HR', 'Payroll', 'ATS', 'HRIS'];
  
  // Check for known entities
  entities = commonEntities.filter(entity => 
    new RegExp(`\\b${entity}\\b`, 'i').test(combinedText)
  );
  
  // Look for capitalized multi-word phrases that might be entities
  const potentialEntityMatches = combinedText.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g);
  if (potentialEntityMatches) {
    entities = [...entities, ...potentialEntityMatches.slice(0, 5)];
  }
  
  return [...new Set(entities)]; // Remove duplicates
}

// Infer audience type from text
function inferAudienceType(text, title = '') {
  const combinedText = `${title} ${text.substring(0, 2000)}`.toLowerCase();
  const audiences = [];
  
  const audiencePatterns = [
    { pattern: /business owners?|entrepreneur|ceo|founder/i, audience: 'business owners' },
    { pattern: /hr|human resources|personnel|talent/i, audience: 'HR professionals' },
    { pattern: /recruit|hiring|talent acquisition/i, audience: 'recruiters' },
    { pattern: /manage|supervisor|team lead/i, audience: 'managers' },
    { pattern: /hourly|employee|staff|worker/i, audience: 'hourly workforce managers' }
  ];
  
  audiencePatterns.forEach(({ pattern, audience }) => {
    if (pattern.test(combinedText)) {
      audiences.push(audience);
    }
  });
  
  return audiences.length > 0 ? audiences : ['general business users'];
}

// Generate backup context if all else fails
function generateBackupContext(text, metadata) {
  const title = metadata.title || '';
  const url = metadata.url || '';
  
  return {
    summary: title,
    documentType: url.includes('/product/') ? 'product page' : 
                 url.includes('/blog/') ? 'blog post' : 'webpage',
    technicalLevel: 3,
    mainTopics: extractTopicsFromText(text, title),
    entities: extractEntitiesFromText(text, title),
    audienceType: inferAudienceType(text, title)
  };
}

// Prepare text for embedding by incorporating context
function prepareTextForEmbedding({ originalText, context }) {
  // Create a contextual prefix that will help the embedding model understand the text better
  let contextualPrefix = "";
  
  if (context && context.document) {
    // Include document-level context if available
    const doc = context.document;
    
    if (doc.summary) {
      contextualPrefix += `Document Summary: ${doc.summary}\n`;
    }
    
    if (doc.documentType) {
      contextualPrefix += `Document Type: ${doc.documentType}\n`;
    }
    
    if (doc.mainTopics && Array.isArray(doc.mainTopics) && doc.mainTopics.length > 0) {
      contextualPrefix += `Topics: ${doc.mainTopics.join(', ')}\n`;
    }
    
    if (doc.entities && Array.isArray(doc.entities) && doc.entities.length > 0) {
      contextualPrefix += `Key Entities: ${doc.entities.join(', ')}\n`;
    }
    
    if (doc.technicalLevel) {
      contextualPrefix += `Technical Level: ${doc.technicalLevel}\n`;
    }
    
    if (doc.audienceType && Array.isArray(doc.audienceType) && doc.audienceType.length > 0) {
      contextualPrefix += `Target Audience: ${doc.audienceType.join(', ')}\n`;
    }
  }
  
  // Add any visual content descriptions if available
  if (context && context.visualContent) {
    contextualPrefix += `Visual Content: ${context.visualContent}\n`;
  }
  
  // Combine the contextual prefix with the original text
  // Add a separator to distinguish context from content
  return contextualPrefix ? `${contextualPrefix}\n---\n${originalText}` : originalText;
}

// Process a document and store it in Supabase
async function processDocument(crawlDoc, logger) {
  const startTime = Date.now();
  const url = crawlDoc.url;
  const title = crawlDoc.title;
  
  try {
    logger.info(`Processing document: ${title} (${url})`);
    
    // Use the content from the crawl data
    const documentText = crawlDoc.content;
    
    if (!documentText || documentText.trim().length === 0) {
      logger.warning(`Empty document content for ${title}. Skipping.`);
      return null;
    }
    
    // Generate document context using Gemini
    logger.info(`Generating document context for ${title}...`);
    const documentMetadata = {
      source: title,
      url: url,
      timestamp: crawlDoc.timestamp
    };
    
    const documentContext = await extractDocumentContext(documentText, documentMetadata);
    logger.debug(`Generated context for ${title}`, documentContext);
    
    // Ensure arrays are properly formatted
    const primaryTopics = Array.isArray(documentContext.mainTopics) && documentContext.mainTopics.length > 0 
      ? documentContext.mainTopics 
      : [];
    
    const audienceTypes = Array.isArray(documentContext.audienceType) && documentContext.audienceType.length > 0
      ? documentContext.audienceType
      : [];
      
    const entities = Array.isArray(documentContext.entities) && documentContext.entities.length > 0
      ? documentContext.entities
      : [];
    
    // Create the document in Supabase - using the new schema structure
    const documentToInsert = {
      title: title,
      source: url,
      category: documentContext.documentType || 'web',
      technical_level: documentContext.technicalLevel || 3,
      document_summary: documentContext.summary || '',
      primary_topics: primaryTopics,
      document_type: documentContext.documentType || 'webpage',
      audience_type: audienceTypes,
      entities: entities.length > 0 ? entities.reduce((obj, entity, i) => {
        obj[`entity_${i}`] = entity;
        return obj;
      }, {}) : {},
      approved: true, // Set to approved by default
      review_status: 'approved',
      approved_at: new Date().toISOString(),
      metadata: {
        url: url,
        source: 'web_crawl',
        crawlTimestamp: crawlDoc.timestamp,
        content_preview: documentText.substring(0, 200),
        // Include tags in metadata as well for easier retrieval
        tags: primaryTopics,
        audience: audienceTypes,
        technical_level: documentContext.technicalLevel || 3
      }
    };

    // Log the data being inserted
    logger.debug(`Document to insert for ${title}`, documentToInsert);
    
    // Try with simpler data first to diagnose issues
    logger.info(`Attempting minimal document insertion for ${title}...`);
    const minimalDoc = {
      title: title,
      source: url,
      metadata: { test: 'data' }
    };
    
    const { data: testData, error: testError } = await supabase
      .from('documents')
      .insert(minimalDoc)
      .select();
      
    if (testError) {
      logger.error(`Error with minimal document insertion for ${title}`, testError);
      return null;
    } else {
      logger.success(`Minimal document insertion succeeded for ${title}`);
    }
    
    // Proceed with full document insertion
    logger.info(`Attempting to insert document with fields: ${Object.keys(documentToInsert).join(', ')}`);
    
    const { data: documentData, error: documentError } = await supabase
      .from('documents')
      .insert(documentToInsert)
      .select();
    
    if (documentError) {
      logger.error(`Error inserting document: ${title}`, documentError);
      
      // Log the data that was attempted to be inserted (truncated for readability)
      logger.error('Data attempted to insert', {
        title: documentToInsert.title,
        source: documentToInsert.source,
        category: documentToInsert.category,
        metadata_preview: JSON.stringify(documentToInsert.metadata).substring(0, 300)
      });
      
      // Try with alternative formats
      logger.info(`Attempting alternative document insertion for ${title}...`);
      const alternativeDoc = {
        title: title,
        source: url,
        // Include at least the primary_topics in the alternative format
        primary_topics: primaryTopics,
        document_type: documentContext.documentType || 'webpage',
        technical_level: documentContext.technicalLevel || 3,
        metadata: documentToInsert.metadata
      };
      
      const { data: altData, error: altError } = await supabase
        .from('documents')
        .insert(alternativeDoc)
        .select();
        
      if (altError) {
        logger.error(`Alternative document insertion also failed for ${title}`, altError);
        return null;
      } else {
        logger.success(`Alternative document insertion succeeded for ${title}`);
        return {
          title,
          documentId: altData[0].id,
          chunkCount: 0,
          successfulChunks: 0
        };
      }
    }
    
    const documentId = documentData[0].id;
    logger.info(`Document created with ID: ${documentId}`);
    
    // Split the text into chunks
    logger.info(`Splitting document into chunks...`);
    const textChunks = splitTextIntoChunks(documentText, 500);
    
    logger.info(`Created ${textChunks.length} chunks for ${title}`);
    
    // Process chunks in smaller batches to avoid overloading the API
    const chunkBatchSize = 5;
    let processedChunks = 0;
    let successfulChunks = 0;
    
    for (let i = 0; i < textChunks.length; i += chunkBatchSize) {
      const chunkBatch = textChunks.slice(i, i + chunkBatchSize);
      logger.info(`Processing chunk batch ${Math.floor(i / chunkBatchSize) + 1}/${Math.ceil(textChunks.length / chunkBatchSize)}`);
      
      for (let j = 0; j < chunkBatch.length; j++) {
        const chunkText = chunkBatch[j];
        const chunkIndex = i + j;
        
        try {
          // Prepare text for embedding by incorporating context
          const textToEmbed = prepareTextForEmbedding({
            originalText: chunkText,
            context: { 
              document: documentContext,
              // Add any chunk-specific context here if needed
            }
          });
          
          // Generate embedding for the contextualized text
          logger.debug(`Generating embedding for chunk ${chunkIndex} of document ${documentId}`);
          let embedding = [];
          try {
            embedding = await embedText(textToEmbed);
            logger.debug(`Embedding generated successfully for chunk ${chunkIndex}`, {
              embedding_length: embedding.length
            });
          } catch (embeddingError) {
            logger.error(`Error generating embedding for chunk ${chunkIndex}, will use zero vector`, embeddingError);
            // Create a zero vector as fallback
            embedding = new Array(768).fill(0);
          }
          
          // Create chunk record in Supabase with embedding directly in the document_chunks table
          // Using the new schema structure
          logger.debug(`Preparing to insert chunk ${chunkIndex} for document ${documentId}`, {
            chunk_size: chunkText.length,
            context_size: textToEmbed.length,
            embedding_length: embedding.length,
          });
          
          const chunkToInsert = {
            document_id: documentId,
            chunk_index: chunkIndex,
            text: textToEmbed, // Store the contextualized text that was embedded
            original_text: chunkText, // Store the original text in its own column as per new schema
            embedding: embedding, // Store the embedding directly
            context: {
              document_summary: documentContext.summary,
              document_type: documentContext.documentType,
              technical_level: documentContext.technicalLevel,
              audience: Array.isArray(documentContext.audienceType) ? documentContext.audienceType : [],
              topics: Array.isArray(documentContext.mainTopics) ? documentContext.mainTopics : [],
              entities: Array.isArray(documentContext.entities) ? documentContext.entities : []
            },
            metadata: {
              title: title,
              url: url,
              chunkIndex: chunkIndex,
              source: 'web_crawl',
              document_type: documentContext.documentType,
              technical_level: documentContext.technicalLevel,
              topics: Array.isArray(documentContext.mainTopics) ? documentContext.mainTopics : []
            },
            has_visual_content: false, // Default for text-only content
            created_at: new Date().toISOString()
          };
          
          const { data: chunkData, error: chunkError } = await supabase
            .from('document_chunks')
            .insert(chunkToInsert)
            .select('id')
            .single();
            
          if (chunkError) {
            logger.error(`Error inserting chunk ${chunkIndex} for document ${documentId}`, chunkError);
            // Log more details about the insertion attempt
            logger.debug(`Chunk insertion failure details`, {
              document_id: documentId,
              chunk_index: chunkIndex,
              text_length: textToEmbed.length,
              original_text_length: chunkText.length,
              embedding_length: embedding.length
            });
            
            // Try with minimal data
            logger.info(`Attempting minimal chunk insertion for chunk ${chunkIndex}...`);
            const minimalChunk = {
              document_id: documentId,
              chunk_index: chunkIndex,
              text: textToEmbed.substring(0, 1000), // Truncate if too long
              embedding: embedding,
              metadata: {
                title: title,
                topics: Array.isArray(documentContext.mainTopics) ? documentContext.mainTopics : []
              }
            };
            
            const { data: minimalChunkData, error: minimalChunkError } = await supabase
              .from('document_chunks')
              .insert(minimalChunk)
              .select('id')
              .single();
              
            if (minimalChunkError) {
              logger.error(`Minimal chunk insertion also failed for chunk ${chunkIndex}`, minimalChunkError);
            } else {
              logger.success(`Minimal chunk insertion succeeded for chunk ${chunkIndex}`);
              successfulChunks++;
            }
            
            continue;
          }
          
          successfulChunks++;
          logger.info(`Successfully processed chunk ${chunkIndex} for ${title}`);
        } catch (error) {
          logger.error(`Error processing chunk ${chunkIndex} for ${title}`, error);
        }
        
        processedChunks++;
      }
      
      // Log progress after each batch
      logger.info(`Progress: ${processedChunks}/${textChunks.length} chunks (${Math.round(processedChunks / textChunks.length * 100)}%)`);
    }
    
    logger.success(`Document processed and stored: ${title} (${successfulChunks}/${textChunks.length} chunks)`);
    
    return {
      title,
      documentId,
      chunkCount: textChunks.length,
      successfulChunks
    };
    
  } catch (error) {
    logger.error(`Unexpected error processing document ${title}`, error);
    return null;
  }
}

// Process documents in batches
async function processBatch(documents, logger) {
  return Promise.all(documents.map(doc => processDocument(doc, logger)));
}

// Rebuild BM25 statistics in Supabase
async function rebuildBM25Statistics(logger) {
  logger.info('Rebuilding BM25 statistics in Supabase...');
  
  try {
    // Call the Supabase stored function to rebuild statistics
    logger.info('Calling rebuild_corpus_statistics function...');
    
    try {
      const { data, error } = await supabase.rpc('rebuild_corpus_statistics');
      
      if (error) {
        logger.error('Error rebuilding BM25 statistics', error);
        return false;
      }
      
      logger.success('BM25 statistics rebuilt successfully');
      return true;
    } catch (rpcError) {
      logger.error('Error calling rebuild_corpus_statistics function', rpcError);
      logger.warning('Skipping BM25 statistics rebuild');
      return false;
    }
  } catch (error) {
    logger.error('Error rebuilding BM25 statistics', error);
    return false;
  }
}

// Main function
async function rebuildVectorStore() {
  const logger = setupLogger();
  logger.info('Starting vector store rebuild with Gemini for Supabase...');
  
  try {
    // 1. Test connection to Supabase
    logger.info('Testing connection to Supabase...');
    
    // Simple connection test
    const { error: connectionError } = await supabase.from('documents').select('count', { count: 'exact', head: true });
    
    if (connectionError) {
      logger.error('Error connecting to Supabase', connectionError);
      process.exit(1);
    }
    
    logger.success('Successfully connected to Supabase');
    
    // 2. Get crawl data 
    const crawlDocuments = getCrawlData(logger);
    
    if (crawlDocuments.length === 0) {
      logger.error(new Error('No crawl documents found'));
      process.exit(1);
    }
    
    // 3. Process documents in batches
    logger.info(`Processing ${crawlDocuments.length} documents in batches of ${BATCH_SIZE}...`);
    
    const results = {
      total: crawlDocuments.length,
      processed: 0,
      successful: 0,
      failed: 0,
      totalChunks: 0,
      successfulChunks: 0
    };
    
    // Process in batches
    for (let i = 0; i < crawlDocuments.length; i += BATCH_SIZE) {
      const batch = crawlDocuments.slice(i, i + BATCH_SIZE);
      logger.info(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(crawlDocuments.length / BATCH_SIZE)}`);
      
      const batchResults = await processBatch(batch, logger);
      
      // Update results
      results.processed += batch.length;
      
      for (const result of batchResults) {
        if (result) {
          results.successful++;
          results.totalChunks += result.chunkCount;
          results.successfulChunks += result.successfulChunks;
        } else {
          results.failed++;
        }
      }
      
      // Log progress
      logger.info(`Progress: ${results.processed}/${results.total} documents (${Math.round(results.processed / results.total * 100)}%)`);
    }
    
    // 4. Attempt to rebuild BM25 statistics -- REMOVED as we now use built-in FTS
    // const bm25Rebuilt = await rebuildBM25Statistics(logger);

    // 5. Verify results
    logger.info('Verifying results...');
    
    let documentCount = 0;
    let chunkCount = 0;
    
    try {
      const { count: docCount, error: documentCountError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });
        
      if (!documentCountError) {
        documentCount = docCount;
      }
      
      const { count: chunkCnt, error: chunkCountError } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true });
      
      if (!chunkCountError) {
        chunkCount = chunkCnt;
      }
    } catch (countError) {
      logger.error('Error fetching count statistics', countError);
    }
    
    // 6. Log results
    logger.info('Vector store rebuild complete!');
    logger.info(`
Rebuild Summary:
---------------
Total documents processed: ${results.total}
Successfully processed: ${results.successful}
Failed: ${results.failed}
Total chunks: ${results.totalChunks}
Successful chunks: ${results.successfulChunks}
BM25 statistics: N/A (Using built-in PostgreSQL FTS)

Supabase Verification:
---------------------
Documents in Supabase: ${documentCount}
Chunks in Supabase: ${chunkCount}
    `);
    
    // Exit with appropriate code
    process.exit(0);
    
  } catch (error) {
    logger.error('Fatal error during vector store rebuild', error);
    process.exit(1);
  }
}

// Run the rebuild process
rebuildVectorStore(); 
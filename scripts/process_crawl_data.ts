/**
 * Crawl Data Processing Script
 * 
 * This script processes the workstream crawl data file, extracts metadata,
 * and loads the processed documents into the vector store with enhanced metadata.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { extractMetadata } from '../utils/metadataExtractor';
import { embedText } from '../utils/openaiClient';
import { addToVectorStore, clearVectorStore } from '../utils/vectorStore';
import { calculateCorpusStatistics, saveCorpusStatistics } from '../utils/bm25';
import { logError } from '../utils/errorHandling';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const CONFIG = {
  // Path to the crawl data file
  crawlDataPath: process.argv[2] || path.join(process.cwd(), 'workstream_crawl_data_unlimited_cleaned_NO_ROBOTS_FINAL.json'),
  
  // Output directory for processed data
  outputDir: path.join(process.cwd(), 'data/processed'),
  
  // Backup directory for the current vector store (if it exists)
  backupDir: path.join(process.cwd(), 'data/backups', new Date().toISOString().replace(/:/g, '-')),
  
  // Number of documents to process in each batch (reduced to avoid rate limits)
  batchSize: 5,
  
  // Whether to clear the existing vector store
  clearExistingData: true,
  
  // Whether to skip documents that have already been processed
  skipProcessed: false,
  
  // State file to track progress (for resumability)
  stateFile: path.join(process.cwd(), 'data/process_state.json'),
  
  // Error log file
  errorLogFile: path.join(process.cwd(), 'data/processing_errors.json'),
  
  // Model to use for metadata extraction
  metadataModel: 'gemini',
  
  // Delay between batches in milliseconds (5 seconds)
  batchDelayMs: 5000
};

// Interface for crawl data items
interface CrawlDataItem {
  url: string;
  title: string;
  content: string;
  timestamp: string;
  metadata?: any;
}

// Interface for processing state
interface ProcessingState {
  totalDocuments: number;
  processedDocuments: number;
  failedDocuments: number;
  lastProcessedId: string;
  startTime: string;
  lastUpdateTime: string;
}

// Create initial processing state
function createInitialState(): ProcessingState {
  return {
    totalDocuments: 0,
    processedDocuments: 0,
    failedDocuments: 0,
    lastProcessedId: '',
    startTime: new Date().toISOString(),
    lastUpdateTime: new Date().toISOString()
  };
}

// Load the processing state if it exists
async function loadState(): Promise<ProcessingState> {
  try {
    if (fs.existsSync(CONFIG.stateFile)) {
      const stateData = await fs.promises.readFile(CONFIG.stateFile, 'utf-8');
      return JSON.parse(stateData);
    }
  } catch (error) {
    console.error('Error loading state file:', error);
  }
  return createInitialState();
}

// Save the current processing state
async function saveState(state: ProcessingState): Promise<void> {
  state.lastUpdateTime = new Date().toISOString();
  await fs.promises.writeFile(CONFIG.stateFile, JSON.stringify(state, null, 2));
}

// Log an error to the error log file
async function logProcessingError(documentId: string, error: any): Promise<void> {
  const errorLog = {
    documentId,
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  };
  
  let errors = [];
  try {
    if (fs.existsSync(CONFIG.errorLogFile)) {
      const errorData = await fs.promises.readFile(CONFIG.errorLogFile, 'utf-8');
      errors = JSON.parse(errorData);
    }
  } catch (error) {
    // If error reading file, start with empty array
  }
  
  errors.push(errorLog);
  await fs.promises.writeFile(CONFIG.errorLogFile, JSON.stringify(errors, null, 2));
}

// Backup the current vector store
async function backupCurrentVectorStore(): Promise<void> {
  try {
    const vectorStoreDir = process.env.VECTOR_STORE_DIR || 'data/vector_batches';
    const batchIndexFile = process.env.BATCH_INDEX_FILE || 'data/batch_index.json';
    
    if (!fs.existsSync(vectorStoreDir) || !fs.existsSync(batchIndexFile)) {
      console.log('No existing vector store to backup');
      return;
    }
    
    console.log(`Backing up vector store to ${CONFIG.backupDir}`);
    await fs.promises.mkdir(CONFIG.backupDir, { recursive: true });
    
    // Copy vector store directory
    await fs.promises.cp(vectorStoreDir, path.join(CONFIG.backupDir, 'vector_batches'), { recursive: true });
    
    // Copy batch index file
    await fs.promises.cp(batchIndexFile, path.join(CONFIG.backupDir, 'batch_index.json'));
    
    console.log('Backup completed');
  } catch (error) {
    console.error('Error backing up vector store:', error);
    throw error;
  }
}

// Count the total number of documents in the crawl data file
async function countDocuments(): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    
    try {
      const fileStream = fs.createReadStream(CONFIG.crawlDataPath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      rl.on('line', (line) => {
        if (line.trim()) count++;
      });
      
      rl.on('close', () => resolve(count));
      rl.on('error', (err) => reject(err));
    } catch (error) {
      reject(error);
    }
  });
}

// Process a batch of documents
async function processBatch(
  documents: CrawlDataItem[],
  state: ProcessingState
): Promise<void> {
  // Reduce batch size to avoid rate limits
  const smallerBatches = [];
  const MAX_CONCURRENT_REQUESTS = 3; // Process only 3 documents at once
  
  for (let i = 0; i < documents.length; i += MAX_CONCURRENT_REQUESTS) {
    smallerBatches.push(documents.slice(i, i + MAX_CONCURRENT_REQUESTS));
  }
  
  // Process each smaller batch
  for (const batch of smallerBatches) {
    const processingPromises = batch.map(async (doc) => {
      const documentId = doc.url || `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      
      try {
        // Extract metadata using Gemini model (with fallback to OpenAI)
        console.log(`Processing document: ${documentId}`);
        const metadata = await extractMetadata(doc.content, documentId, { model: CONFIG.metadataModel });
        
        // Generate embedding
        console.log(`Generating embedding for: ${documentId}`);
        const embedding = await embedText(doc.content);
        
        // Create vector store item
        const vectorItem = {
          text: doc.content,
          embedding: embedding, // Set the generated embedding
          metadata: {
            source: documentId,
            title: doc.title,
            url: doc.url,
            timestamp: doc.timestamp,
            category: metadata.primaryCategory,
            technicalLevel: metadata.technicalLevel,
            entities: metadata.entities.map(e => e.name).join(','),
            keywords: metadata.keywords.join(','),
            summary: metadata.summary
          }
        };
        
        // Add to vector store
        await addToVectorStore(vectorItem);
        
        // Update state
        state.processedDocuments++;
        state.lastProcessedId = documentId;
        
        return { success: true, id: documentId };
      } catch (error) {
        console.error(`Error processing document ${documentId}:`, error);
        await logProcessingError(documentId, error);
        state.failedDocuments++;
        return { success: false, id: documentId };
      }
    });
    
    await Promise.all(processingPromises);
    
    // Add a delay between batches to avoid hitting rate limits
    if (smallerBatches.indexOf(batch) < smallerBatches.length - 1) {
      console.log(`Waiting for ${CONFIG.batchDelayMs} milliseconds before processing next batch to avoid rate limits...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.batchDelayMs));
    }
  }
  
  await saveState(state);
}

// Main processing function
async function processCrawlData(): Promise<void> {
  try {
    console.log(`Starting crawl data processing: ${CONFIG.crawlDataPath}`);
    
    // Parse command line arguments for batch size and delay
    process.argv.forEach((arg, index) => {
      if (arg === '--batch-size' && process.argv[index + 1]) {
        const size = parseInt(process.argv[index + 1]);
        if (!isNaN(size) && size > 0) {
          CONFIG.batchSize = size;
          console.log(`Setting batch size to ${size}`);
        }
      }
      if (arg === '--batch-delay' && process.argv[index + 1]) {
        const delay = parseInt(process.argv[index + 1]);
        if (!isNaN(delay) && delay > 0) {
          CONFIG.batchDelayMs = delay;
          console.log(`Setting batch delay to ${delay}ms`);
        }
      }
      if (arg === '--model' && process.argv[index + 1]) {
        CONFIG.metadataModel = process.argv[index + 1];
        console.log(`Setting metadata model to ${CONFIG.metadataModel}`);
      }
    });
    
    // Ensure output directory exists
    await fs.promises.mkdir(CONFIG.outputDir, { recursive: true });
    
    // Load or create state
    const state = await loadState();
    
    // Count documents if not already counted
    if (state.totalDocuments === 0) {
      state.totalDocuments = await countDocuments();
      await saveState(state);
    }
    
    console.log(`Total documents to process: ${state.totalDocuments}`);
    console.log(`Already processed: ${state.processedDocuments}`);
    
    // Backup vector store if needed
    if (CONFIG.clearExistingData) {
      await backupCurrentVectorStore();
      clearVectorStore();
      console.log('Cleared existing vector store');
    }
    
    // Process the file line by line
    const fileStream = fs.createReadStream(CONFIG.crawlDataPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    let currentBatch: CrawlDataItem[] = [];
    let currentDoc = 0;
    let skipCount = 0;
    
    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const document = JSON.parse(line) as CrawlDataItem;
        currentDoc++;
        
        // Skip already processed documents if needed
        if (CONFIG.skipProcessed && currentDoc <= state.processedDocuments) {
          skipCount++;
          continue;
        }
        
        currentBatch.push(document);
        
        // Process the batch when it reaches the batch size
        if (currentBatch.length >= CONFIG.batchSize) {
          await processBatch(currentBatch, state);
          currentBatch = [];
          
          // Log progress
          const progress = ((state.processedDocuments / state.totalDocuments) * 100).toFixed(2);
          console.log(`Progress: ${progress}% (${state.processedDocuments}/${state.totalDocuments})`);
        }
      } catch (error) {
        console.error('Error parsing document:', error);
        await logProcessingError(`line-${currentDoc}`, error);
        state.failedDocuments++;
        
        // Provide helpful suggestion when encountering JSON parsing errors
        if (error instanceof SyntaxError) {
          console.error(`JSON parsing error on line ${currentDoc}. Try using the preprocess script first:`);
          console.error(`npm run preprocess:crawl-data -- ${CONFIG.crawlDataPath}`);
          console.error(`Then run this script with the fixed file: npm run process:crawl-data -- ${CONFIG.crawlDataPath.replace('.json', '.fixed.json')}`);
        }
      }
    }
    
    // Process any remaining documents
    if (currentBatch.length > 0) {
      await processBatch(currentBatch, state);
    }
    
    // Regenerate BM25 statistics
    console.log('Regenerating BM25 corpus statistics');
    const allItems = require('../utils/vectorStore').getAllVectorStoreItems();
    const corpusStats = await calculateCorpusStatistics(allItems);
    await saveCorpusStatistics(corpusStats);
    
    // Final report
    console.log('\nProcessing complete!');
    console.log(`Total documents: ${state.totalDocuments}`);
    console.log(`Successfully processed: ${state.processedDocuments}`);
    console.log(`Failed: ${state.failedDocuments}`);
    console.log(`Skipped: ${skipCount}`);
    console.log(`Start time: ${state.startTime}`);
    console.log(`End time: ${new Date().toISOString()}`);
    
    // Save final state
    await saveState(state);
    
  } catch (error) {
    logError('Crawl data processing error', error);
    process.exit(1);
  }
}

// Run the processing if this script is executed directly
if (require.main === module) {
  processCrawlData()
    .then(() => console.log('Processing completed successfully'))
    .catch(error => {
      console.error('Processing failed:', error);
      process.exit(1);
    });
}

export { processCrawlData }; 
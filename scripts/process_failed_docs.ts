/**
 * Process Failed Documents Script
 * 
 * This script reads the error log to identify documents that failed processing,
 * typically due to rate limits, and attempts to process them again with enhanced
 * rate limiting protections.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { extractMetadata } from '../utils/metadataExtractor';
import { embedText } from '../utils/openaiClient';
import { addToVectorStore } from '../utils/vectorStore';
import { logError } from '../utils/errorHandling';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const CONFIG = {
  // Error log file to read failed documents from
  errorLogFile: path.join(process.cwd(), 'data/processing_errors.json'),
  
  // Original crawl data file
  crawlDataPath: process.argv[2] || path.join(process.cwd(), 'workstream_crawl_data_unlimited_cleaned_NO_ROBOTS_FINAL.json'),
  
  // Number of documents to process in each batch (small to avoid rate limits)
  batchSize: 3,
  
  // Model to use for metadata extraction
  metadataModel: 'gemini',
  
  // Delay between batches in milliseconds (10 seconds)
  batchDelayMs: 10000
};

// Process command line arguments
process.argv.forEach((arg, index) => {
  if (arg === '--batch-size' && process.argv[index + 1]) {
    const size = parseInt(process.argv[index + 1]);
    if (!isNaN(size) && size > 0) {
      CONFIG.batchSize = size;
    }
  }
  if (arg === '--batch-delay' && process.argv[index + 1]) {
    const delay = parseInt(process.argv[index + 1]);
    if (!isNaN(delay) && delay > 0) {
      CONFIG.batchDelayMs = delay;
    }
  }
  if (arg === '--model' && process.argv[index + 1]) {
    CONFIG.metadataModel = process.argv[index + 1];
  }
});

// Interface for crawl data items
interface CrawlDataItem {
  url: string;
  title: string;
  content: string;
  timestamp: string;
  metadata?: any;
}

// Interface for error log items
interface ErrorLogItem {
  documentId: string;
  timestamp: string;
  error: string;
  stack?: string;
}

// Function to load error log
async function loadErrorLog(): Promise<ErrorLogItem[]> {
  if (!fs.existsSync(CONFIG.errorLogFile)) {
    console.log('No error log found. No failed documents to process.');
    return [];
  }
  
  try {
    const errorData = await fs.promises.readFile(CONFIG.errorLogFile, 'utf-8');
    return JSON.parse(errorData);
  } catch (error) {
    console.error('Error loading error log:', error);
    return [];
  }
}

// Function to extract document from crawl data by URL
async function findDocumentById(documentId: string): Promise<CrawlDataItem | null> {
  return new Promise((resolve) => {
    const fileStream = fs.createReadStream(CONFIG.crawlDataPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    rl.on('line', (line) => {
      if (!line.trim()) return;
      
      try {
        const document = JSON.parse(line) as CrawlDataItem;
        if (document.url === documentId) {
          rl.close();
          fileStream.close();
          resolve(document);
        }
      } catch (error) {
        // Ignore parsing errors
      }
    });
    
    rl.on('close', () => {
      resolve(null);
    });
  });
}

// Process a batch of documents
async function processBatch(documents: CrawlDataItem[]): Promise<void> {
  const processingPromises = documents.map(async (doc) => {
    const documentId = doc.url || `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    try {
      // Extract metadata using model with improved rate limit handling
      console.log(`Processing document: ${documentId}`);
      const metadata = await extractMetadata(doc.content, documentId, { model: CONFIG.metadataModel });
      
      // Generate embedding
      console.log(`Generating embedding for: ${documentId}`);
      const embedding = await embedText(doc.content);
      
      // Create vector store item
      const vectorItem = {
        text: doc.content,
        embedding: embedding,
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
      
      return { success: true, id: documentId };
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error);
      return { success: false, id: documentId, error };
    }
  });
  
  const results = await Promise.all(processingPromises);
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Batch completed: ${succeeded} succeeded, ${failed} failed`);
}

// Main function to process failed documents
async function processFailedDocuments(): Promise<void> {
  console.log('===== Processing Failed Documents =====');
  console.log(`Using model: ${CONFIG.metadataModel}`);
  console.log(`Batch size: ${CONFIG.batchSize}`);
  console.log(`Batch delay: ${CONFIG.batchDelayMs}ms`);
  
  try {
    // Load the error log
    const errorLog = await loadErrorLog();
    if (errorLog.length === 0) {
      console.log('No failed documents to process.');
      return;
    }
    
    console.log(`Found ${errorLog.length} failed documents to process.`);
    
    // Extract unique document IDs (URLs)
    const uniqueDocIds = [...new Set(errorLog.map(entry => entry.documentId))];
    console.log(`Processing ${uniqueDocIds.length} unique documents.`);
    
    // Find documents in the crawl data
    const documentsToProcess: CrawlDataItem[] = [];
    let notFound = 0;
    
    for (const docId of uniqueDocIds) {
      const doc = await findDocumentById(docId);
      if (doc) {
        documentsToProcess.push(doc);
      } else {
        notFound++;
        console.log(`Document not found: ${docId}`);
      }
    }
    
    console.log(`Found ${documentsToProcess.length} documents to process. ${notFound} documents not found.`);
    
    // Process in small batches
    const batches: CrawlDataItem[][] = [];
    for (let i = 0; i < documentsToProcess.length; i += CONFIG.batchSize) {
      batches.push(documentsToProcess.slice(i, i + CONFIG.batchSize));
    }
    
    console.log(`Processing in ${batches.length} batches...`);
    
    // Process each batch with delay
    for (let i = 0; i < batches.length; i++) {
      console.log(`Processing batch ${i + 1}/${batches.length}`);
      await processBatch(batches[i]);
      
      // Add delay between batches except for the last one
      if (i < batches.length - 1) {
        console.log(`Waiting for ${CONFIG.batchDelayMs}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.batchDelayMs));
      }
    }
    
    console.log('\nProcessing of failed documents completed!');
    console.log(`Processed ${documentsToProcess.length} previously failed documents.`);
    
    // Optionally clear the error log
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('Do you want to clear the error log? (yes/no): ', (answer) => {
      if (answer.toLowerCase() === 'yes') {
        fs.writeFileSync(CONFIG.errorLogFile, JSON.stringify([], null, 2));
        console.log('Error log cleared.');
      } else {
        console.log('Error log preserved.');
      }
      rl.close();
    });
    
  } catch (error) {
    logError('Failed to process failed documents', error);
  }
}

// Run the function when this script is executed directly
if (require.main === module) {
  processFailedDocuments().catch(error => {
    console.error('Processing failed:', error);
    process.exit(1);
  });
}

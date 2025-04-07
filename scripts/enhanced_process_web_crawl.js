/**
 * Enhanced Web Crawl Processor
 * This script processes ALL the web crawl data with improved chunking and structured information detection
 */
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Import our utility functions from the local utils.js file
const { splitIntoChunks, addToVectorStore } = require('./utils');

// Configuration
const CRAWL_DATA_FILE = path.join(process.cwd(), 'workstream_crawl_data_unlimited_cleaned_NO_ROBOTS_FINAL.json');
const BATCH_SIZE = 8; // Number of embeddings to process in parallel
const PRIORITY_URLS = [
  'careers', 'about', 'investors', 'company', 'team', 'values', 
  'mission', 'vision', 'leadership'
];

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable not set.');
  console.error('Please set your OpenAI API key in the .env file or environment.');
  process.exit(1);
}

// Function to generate embeddings for text
async function embedText(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.replace(/\n/g, ' ')
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

// Function to determine if a URL is high priority
function isPriorityUrl(url) {
  return PRIORITY_URLS.some(keyword => url.toLowerCase().includes(keyword));
}

// Process embeddings in batches to avoid rate limits
async function processBatchEmbeddings(textChunks, sourceUrl, pageTitle) {
  console.log(`Processing ${textChunks.length} chunks in batches of ${BATCH_SIZE}...`);
  const results = [];

  for (let i = 0; i < textChunks.length; i += BATCH_SIZE) {
    const batchChunks = textChunks.slice(i, i + BATCH_SIZE);
    console.log(`  Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(textChunks.length/BATCH_SIZE)}...`);
    
    try {
      // Process this batch in parallel
      const batchPromises = batchChunks.map(async (chunk, index) => {
        try {
          const embedding = await embedText(chunk.text);
          return {
            embedding,
            text: chunk.text,
            metadata: {
              source: sourceUrl,
              title: pageTitle || 'Unknown Title',
              ...(chunk.metadata || {})
            }
          };
        } catch (error) {
          console.error(`    Error processing chunk ${i + index}: ${error.message}`);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(item => item !== null));
      
      // Longer delay for API rate limits
      if (i + BATCH_SIZE < textChunks.length) {
        const delay = isPriorityUrl(sourceUrl) ? 1000 : 2000; // Priority pages get processed faster
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`  Error processing batch: ${error.message}`);
    }
  }

  return results;
}

// Function to sort URLs by priority
function sortUrlsByPriority(urls) {
  return urls.sort((a, b) => {
    const aIsPriority = isPriorityUrl(a);
    const bIsPriority = isPriorityUrl(b);
    
    if (aIsPriority && !bIsPriority) return -1;
    if (!aIsPriority && bIsPriority) return 1;
    return 0;
  });
}

// Main function to process all crawl data
async function processAllWebCrawlData() {
  console.log(`Starting complete web crawl processing from ${CRAWL_DATA_FILE}`);
  
  // Check if crawl data file exists
  if (!fs.existsSync(CRAWL_DATA_FILE)) {
    console.error(`Error: Crawl data file not found: ${CRAWL_DATA_FILE}`);
    return;
  }
  
  try {
    // Read and parse crawl data
    console.log(`Reading crawl data from ${CRAWL_DATA_FILE}...`);
    const crawlData = JSON.parse(fs.readFileSync(CRAWL_DATA_FILE, 'utf-8'));
    
    // Get all valid URLs
    const urls = Object.keys(crawlData).filter(url => 
      crawlData[url].status === 'success' && 
      crawlData[url].text && 
      crawlData[url].text.trim().length > 100
    );
    
    // Sort URLs to process priority pages first
    const sortedUrls = sortUrlsByPriority(urls);
    
    console.log(`Found ${sortedUrls.length} valid URLs to process`);
    console.log(`Processing order: Priority pages first, then regular pages`);
    
    let totalProcessedPages = 0;
    let totalProcessedItems = 0;
    
    // Process each URL
    for (let i = 0; i < sortedUrls.length; i++) {
      const url = sortedUrls[i];
      const pageData = crawlData[url];
      const isPriority = isPriorityUrl(url);
      
      console.log(`\n[${i+1}/${sortedUrls.length}] Processing ${url}${isPriority ? ' (PRIORITY)' : ''}`);
      console.log(`  Title: ${pageData.title || 'Unknown Title'}`);
      console.log(`  Content length: ${pageData.text.length} characters`);
      
      // Split text into chunks with source URL for context-aware processing
      const textChunks = splitIntoChunks(pageData.text, 500, url);
      console.log(`  Split into ${textChunks.length} chunks`);
      
      // Display structured information chunks for debugging
      const structuredChunks = textChunks.filter(chunk => chunk.metadata?.isStructured);
      if (structuredChunks.length > 0) {
        console.log(`  Found ${structuredChunks.length} structured information chunks:`);
        structuredChunks.forEach((chunk, idx) => {
          console.log(`    Structured chunk ${idx+1}: Type=${chunk.metadata?.infoType || 'Unknown'}`);
          console.log(`    Preview: ${chunk.text.substring(0, 100)}...`);
        });
      }
      
      if (textChunks.length === 0) {
        console.log(`  No valid chunks found, skipping`);
        continue;
      }
      
      // Process embeddings
      const embeddingItems = await processBatchEmbeddings(textChunks, url, pageData.title);
      console.log(`  Generated ${embeddingItems.length} embeddings`);
      
      if (embeddingItems.length > 0) {
        // Add to vector store
        addToVectorStore(embeddingItems);
        totalProcessedItems += embeddingItems.length;
        totalProcessedPages++;
      }
    }
    
    console.log(`\nProcessing complete!`);
    console.log(`Processed ${totalProcessedPages} pages`);
    console.log(`Added ${totalProcessedItems} items to vector store`);
    
  } catch (error) {
    console.error('Error processing web crawl data:', error);
  }
}

// Run the main function
console.log('Starting enhanced web crawl processing...');
processAllWebCrawlData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 
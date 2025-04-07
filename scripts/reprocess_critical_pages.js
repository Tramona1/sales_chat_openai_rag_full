/**
 * This script selectively reprocesses critical pages from the crawl data
 * It focuses on the Workstream careers and about pages to ensure
 * that company values, investors, and leadership are properly 
 * processed with structured information detection and metadata tagging.
 */
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Import utility functions
const { 
  splitIntoChunks, 
  addToVectorStore,
  loadVectorStore,
  saveVectorStore
} = require('./utils');

// Configuration
const CRAWL_DATA_FILE = path.join(process.cwd(), 'workstream_crawl_data_unlimited_cleaned_NO_ROBOTS_FINAL.json');
const CRITICAL_URLS = [
  'https://www.workstream.us/careers',
  'https://www.workstream.us/about',
  'https://www.workstream.us/investors',
  'https://www.workstream.us/company'
];

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

// Remove existing embeddings for the specified URLs
function removeExistingEmbeddings(urls) {
  const vectorStore = loadVectorStore();
  
  console.log(`Current vector store size: ${vectorStore.items.length} items`);
  
  // Filter out items from the critical URLs
  const filteredItems = vectorStore.items.filter(item => {
    // Keep items that don't have a source or whose source is not in the URLs list
    return !item.metadata?.source || !urls.some(url => item.metadata.source.includes(url));
  });
  
  console.log(`Removed ${vectorStore.items.length - filteredItems.length} items from critical URLs`);
  
  // Update vector store
  vectorStore.items = filteredItems;
  saveVectorStore(vectorStore);
  
  return vectorStore.items.length;
}

// Process each critical URL
async function processCriticalPages() {
  try {
    console.log('Starting reprocessing of critical pages...');
    
    // Check if crawl data file exists
    if (!fs.existsSync(CRAWL_DATA_FILE)) {
      console.error(`Crawl data file not found: ${CRAWL_DATA_FILE}`);
      return;
    }
    
    // Read and parse crawl data
    console.log(`Reading crawl data from ${CRAWL_DATA_FILE}...`);
    const crawlData = JSON.parse(fs.readFileSync(CRAWL_DATA_FILE, 'utf-8'));
    
    // Find the critical URLs in the crawl data
    const foundUrls = [];
    for (const url of CRITICAL_URLS) {
      if (crawlData[url]) {
        foundUrls.push(url);
      } else {
        // Try to find URLs that contain the critical path
        const matchingUrls = Object.keys(crawlData).filter(dataUrl => 
          dataUrl.includes(url.split('/').pop()) && 
          crawlData[dataUrl].status === 'success'
        );
        foundUrls.push(...matchingUrls);
      }
    }
    
    console.log(`Found ${foundUrls.length} critical URLs to process:`, foundUrls);
    
    // Remove existing embeddings for these URLs
    const remainingItems = removeExistingEmbeddings(foundUrls);
    console.log(`Vector store now has ${remainingItems} items after removal`);
    
    // Process each URL
    for (const url of foundUrls) {
      const pageData = crawlData[url];
      if (!pageData || pageData.status !== 'success' || !pageData.text) {
        console.log(`Skipping ${url}: Invalid content`);
        continue;
      }
      
      console.log(`\nProcessing ${url}`);
      console.log(`Title: ${pageData.title || 'Unknown Title'}`);
      console.log(`Content length: ${pageData.text.length} characters`);
      
      // Split text into chunks with source URL
      const textChunks = splitIntoChunks(pageData.text, 500, url);
      console.log(`Split into ${textChunks.length} chunks`);
      console.log('Chunk details:');
      
      // Display chunk metadata for debugging
      textChunks.forEach((chunk, i) => {
        console.log(`  Chunk ${i+1}: ${chunk.metadata ? 
          `Structured=${chunk.metadata.isStructured}, Type=${chunk.metadata.infoType || 'None'}` : 
          'No metadata'}`);
      });
      
      // Process chunks in sequence to avoid rate limits
      let processedCount = 0;
      for (const chunk of textChunks) {
        try {
          console.log(`  Generating embedding for chunk ${processedCount + 1}/${textChunks.length}...`);
          const embedding = await embedText(chunk.text);
          
          addToVectorStore({
            embedding,
            text: chunk.text,
            metadata: {
              source: url,
              title: pageData.title || 'Unknown Title',
              ...(chunk.metadata || {})
            }
          });
          
          processedCount++;
          
          // Slight delay between embeddings to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`  Error processing chunk: ${error.message}`);
        }
      }
      
      console.log(`Completed processing ${url}: Added ${processedCount} chunks`);
    }
    
    console.log('\nCritical page reprocessing complete!');
    
  } catch (error) {
    console.error('Error in processCriticalPages:', error);
  }
}

// Run the main function
processCriticalPages().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 
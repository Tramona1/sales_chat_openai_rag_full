const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Import our utility functions from the local utils.js file
const { splitIntoChunks, addToVectorStore } = require('./utils');

// Configuration
const CHUNKS_DIR = path.join(process.cwd(), 'data', 'crawl_chunks');
const CHUNK_PATTERN = /^chunk_(\d+)\.json$/;
const BATCH_SIZE = 8; // Number of embeddings to process in parallel
const MAX_CHUNKS_PER_RUN = parseInt(process.argv[2]) || 5; // Process this many chunk files per run, default 5

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
      
      // Slight delay between batches to avoid rate limits
      if (i + BATCH_SIZE < textChunks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`  Error processing batch: ${error.message}`);
    }
  }

  return results;
}

// Main function to process all chunks
async function processWebCrawlChunks() {
  console.log(`Starting web crawl processing from ${CHUNKS_DIR}`);
  
  // Check if chunks directory exists
  if (!fs.existsSync(CHUNKS_DIR)) {
    console.error(`Error: Chunks directory not found: ${CHUNKS_DIR}`);
    console.error('Run splitCrawlData.js first to prepare chunks.');
    return;
  }
  
  // Get all chunk files
  const files = fs.readdirSync(CHUNKS_DIR)
    .filter(file => CHUNK_PATTERN.test(file) && !file.startsWith('processed_'))
    .sort((a, b) => {
      const numA = parseInt(a.match(CHUNK_PATTERN)[1]);
      const numB = parseInt(b.match(CHUNK_PATTERN)[1]);
      return numA - numB;
    });
  
  if (files.length === 0) {
    console.log('No chunk files found to process. All done!');
    return;
  }
  
  console.log(`Found ${files.length} chunk files to process.`);
  
  // Limit processing to max chunks per run
  const filesToProcess = files.slice(0, MAX_CHUNKS_PER_RUN);
  console.log(`Will process ${filesToProcess.length} chunk files in this run.`);
  
  let totalProcessedItems = 0;
  let totalProcessedPages = 0;
  
  // Process each chunk file
  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    console.log(`\n[${i+1}/${filesToProcess.length}] Processing ${file}...`);
    
    try {
      // Read the chunk file
      const chunkData = JSON.parse(fs.readFileSync(path.join(CHUNKS_DIR, file), 'utf-8'));
      const urls = Object.keys(chunkData);
      
      console.log(`Found ${urls.length} URLs in ${file}`);
      
      // Process each URL in the chunk
      for (let j = 0; j < urls.length; j++) {
        const url = urls[j];
        const pageData = chunkData[url];
        
        if (pageData.status !== 'success' || !pageData.text) {
          console.log(`  Skipping ${url}: Invalid content`);
          continue;
        }
        
        console.log(`  [${j+1}/${urls.length}] Processing ${url}`);
        console.log(`    Title: ${pageData.title || 'Unknown Title'}`);
        console.log(`    Content length: ${pageData.text.length} characters`);
        
        // Split text into chunks with source URL for context-aware processing
        const textChunks = splitIntoChunks(pageData.text, 500, url);
        console.log(`    Split into ${textChunks.length} chunks`);
        
        if (textChunks.length === 0) {
          console.log(`    No valid chunks found, skipping`);
          continue;
        }
        
        // Process embeddings
        const embeddingItems = await processBatchEmbeddings(textChunks, url, pageData.title);
        console.log(`    Generated ${embeddingItems.length} embeddings`);
        
        if (embeddingItems.length > 0) {
          // Add to vector store
          addToVectorStore(embeddingItems);
          totalProcessedItems += embeddingItems.length;
          totalProcessedPages++;
        }
      }
      
      // Mark file as processed
      fs.renameSync(
        path.join(CHUNKS_DIR, file),
        path.join(CHUNKS_DIR, `processed_${file}`)
      );
      
    } catch (error) {
      console.error(`Error processing chunk file ${file}:`, error);
    }
  }
  
  console.log(`\nProcessing complete!`);
  console.log(`Processed ${totalProcessedPages} pages`);
  console.log(`Added ${totalProcessedItems} items to vector store`);
  console.log(`${files.length - filesToProcess.length} chunk files remaining to process.`);
}

// Run the main function
processWebCrawlChunks().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 
/**
 * Reset and Process Script
 * 
 * This script combines vector store reset and data processing with enhanced rate limiting.
 * It will:
 * 1. Clear the existing vector store
 * 2. Run the processing script with optimized settings to avoid rate limits
 */

import { clearVectorStore } from '../utils/vectorStore';
import { processCrawlData } from './process_crawl_data';
import * as path from 'path';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function resetAndProcess() {
  console.log('===== Vector Store Reset and Crawl Data Processing =====');
  console.log('\nWARNING: This will delete all existing vector store data and metadata.');
  console.log('All existing trained knowledge will be removed and reprocessed from scratch.');
  
  rl.question('\nDo you want to proceed? (yes/no): ', async (answer) => {
    if (answer.toLowerCase() !== 'yes') {
      console.log('Operation canceled. No changes were made.');
      rl.close();
      return;
    }
    
    try {
      // Step 1: Clear the vector store
      console.log('\n[Step 1] Clearing vector store...');
      clearVectorStore();
      console.log('Vector store has been successfully cleared.');
      
      // Step 2: Process the crawl data with optimized settings
      console.log('\n[Step 2] Processing crawl data with rate limit protection...');
      
      // Configure options based on best practices for rate limiting
      const crawlDataPath = process.argv[2] || path.join(process.cwd(), 'workstream_crawl_data_unlimited_cleaned_NO_ROBOTS_FINAL.json');
      
      // Add these command line args to process.argv
      // We want a small batch size and longer delays between batches
      process.argv.push('--batch-size', '3');
      process.argv.push('--batch-delay', '10000'); // 10 seconds
      process.argv.push('--model', 'gemini'); // Start with Gemini (with OpenAI fallback)
      
      // Pass the crawl data path explicitly
      process.argv[2] = crawlDataPath;
      
      // Pass raw path in case it was provided as a command line argument
      await processCrawlData();
      
      console.log('\nReset and processing completed successfully!');
      console.log('The vector store now contains fresh metadata with rate-limited processing.');
    } catch (error) {
      console.error('An error occurred during reset and processing:', error);
    } finally {
      rl.close();
    }
  });
}

// Run the function when this script is executed directly
if (require.main === module) {
  resetAndProcess().catch(error => {
    console.error('Failed to reset and process:', error);
    process.exit(1);
  });
}

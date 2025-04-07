/**
 * Process All Data Script
 * 
 * This script processes all crawl data files in the system to:
 * 1. Extract metadata using Gemini or OpenAI
 * 2. Update vector store with extracted metadata
 * 3. Update corpus statistics for BM25
 */

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Path to the crawl data directory
const DATA_DIR = path.join(process.cwd(), 'data');
const PRIMARY_CRAWL_DATA = path.join(process.cwd(), 'workstream_crawl_data_unlimited_cleaned_NO_ROBOTS_FINAL.json');

/**
 * Process a crawl data file
 */
function processCrawlData(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Starting to process: ${filePath}`);
    
    const process = spawn('npx', ['ts-node', 'scripts/process_crawl_data.ts', filePath], {
      stdio: 'inherit',
      shell: true
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        console.log(`Successfully processed: ${filePath}`);
        resolve();
      } else {
        console.error(`Failed to process ${filePath} with exit code: ${code}`);
        reject(new Error(`Process failed with exit code ${code}`));
      }
    });
    
    process.on('error', (err) => {
      console.error(`Failed to start process for ${filePath}:`, err);
      reject(err);
    });
  });
}

/**
 * Main function to process all crawl data
 */
async function processAllData(): Promise<void> {
  try {
    // Get all JSON files in the data directory
    const dataFiles = fs.readdirSync(DATA_DIR)
      .filter(file => file.endsWith('.json') && file.includes('crawl_data'))
      .map(file => path.join(DATA_DIR, file));
    
    // Add the primary crawl data file if it exists
    if (fs.existsSync(PRIMARY_CRAWL_DATA)) {
      dataFiles.push(PRIMARY_CRAWL_DATA);
    }
    
    console.log(`Found ${dataFiles.length} crawl data files to process:`);
    dataFiles.forEach(file => console.log(` - ${file}`));
    
    // Process each file sequentially
    for (const file of dataFiles) {
      await processCrawlData(file);
    }
    
    console.log('All data processing completed!');
  } catch (error) {
    console.error('Error processing all data:', error);
    process.exit(1);
  }
}

// Run the main function
processAllData().catch(console.error); 
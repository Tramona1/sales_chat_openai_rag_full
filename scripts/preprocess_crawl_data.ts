/**
 * Crawl Data Preprocessing Script
 * 
 * This script fixes common JSON formatting issues in crawl data files.
 * It handles issues like:
 * - Newlines in content fields
 * - Missing or unescaped quotes
 * - Other JSON syntax errors
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Configuration
const CONFIG = {
  inputFile: process.argv[2] || 'data/crawl_data.json',
  outputFile: '',  // Will be set based on input file
  backupFile: '',  // Will be set based on input file
  fixNewlines: true,
  fixSpecialChars: true,
  fixQuotes: true,
  createBackup: true,
  verbose: true
};

// Set output and backup file paths
CONFIG.outputFile = CONFIG.inputFile.replace('.json', '.fixed.json');
CONFIG.backupFile = CONFIG.inputFile.replace('.json', '.backup.json');

// Stats
const stats = {
  totalLines: 0,
  validLines: 0,
  fixedLines: 0,
  unfixableLines: 0
};

/**
 * Try to fix common JSON parsing issues
 */
function fixJsonLine(line: string): { fixed: boolean; result: string } {
  // Skip empty lines
  if (!line.trim()) {
    return { fixed: true, result: '' };
  }

  // First try parsing as is
  try {
    JSON.parse(line);
    return { fixed: true, result: line }; // Already valid JSON
  } catch (error) {
    // Try fixing common issues
    let fixedLine = line;
    
    // Fix 1: Try to fix unescaped quotes in JSON strings
    if (CONFIG.fixQuotes) {
      // Complex regex to find unescaped quotes within string values
      // This is a simplified approach and may not work for all cases
      fixedLine = fixedLine.replace(/:\s*"([^"]*?)([^\\])"([^"]*?)"/g, ': "$1$2\\"$3"');
    }
    
    // Fix 2: Try to fix newlines in content fields
    if (CONFIG.fixNewlines) {
      // Replace literal newlines in the JSON with escaped newlines
      fixedLine = fixedLine.replace(/\n/g, '\\n');
      fixedLine = fixedLine.replace(/\r/g, '\\r');
    }
    
    // Fix 3: Try to fix unescaped special characters
    if (CONFIG.fixSpecialChars) {
      // Replace common problematic characters
      fixedLine = fixedLine.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    }
    
    // Try parsing the fixed line
    try {
      JSON.parse(fixedLine);
      return { fixed: true, result: fixedLine };
    } catch (finalError) {
      // If still can't parse, create a minimally valid JSON object with error info
      const minimalJson = JSON.stringify({
        url: `ERROR_UNFIXABLE_JSON_LINE_${stats.totalLines + 1}`,
        title: "JSON Parsing Error",
        content: `The original line could not be parsed: ${(finalError as Error).message}`,
        timestamp: new Date().toISOString()
      });
      return { fixed: false, result: minimalJson };
    }
  }
}

/**
 * Process the file line by line
 */
async function preprocessCrawlData(): Promise<void> {
  console.log(`Preprocessing crawl data: ${CONFIG.inputFile}`);
  
  // Create backup if needed
  if (CONFIG.createBackup) {
    fs.copyFileSync(CONFIG.inputFile, CONFIG.backupFile);
    console.log(`Created backup: ${CONFIG.backupFile}`);
  }
  
  // Setup read and write streams
  const fileStream = fs.createReadStream(CONFIG.inputFile);
  const writeStream = fs.createWriteStream(CONFIG.outputFile);
  
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  // Process each line
  for await (const line of rl) {
    stats.totalLines++;
    
    if (!line.trim()) {
      continue;
    }
    
    const { fixed, result } = fixJsonLine(line);
    
    if (result) {
      writeStream.write(result + '\n');
      if (fixed) {
        stats.validLines++;
      } else {
        stats.unfixableLines++;
        console.log(`Unfixable line ${stats.totalLines}: Created placeholder JSON`);
      }
    }
    
    if (CONFIG.verbose && stats.totalLines % 100 === 0) {
      console.log(`Processed ${stats.totalLines} lines...`);
    }
  }
  
  // Close the write stream
  writeStream.end();
  
  // Print summary
  console.log('\nPreprocessing complete!');
  console.log(`Total lines: ${stats.totalLines}`);
  console.log(`Valid/fixed lines: ${stats.validLines}`);
  console.log(`Unfixable lines: ${stats.unfixableLines}`);
  console.log(`Output saved to: ${CONFIG.outputFile}`);
}

// Run the preprocessing if script is executed directly
if (require.main === module) {
  if (!process.argv[2]) {
    console.log('Usage: npm run preprocess:crawl-data -- <crawl_data_file.json>');
    process.exit(1);
  }
  
  preprocessCrawlData()
    .then(() => console.log('Preprocessing completed successfully'))
    .catch(error => {
      console.error('Preprocessing failed:', error);
      process.exit(1);
    });
}

export { preprocessCrawlData }; 
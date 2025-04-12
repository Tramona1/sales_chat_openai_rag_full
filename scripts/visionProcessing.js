#!/usr/bin/env node

/**
 * Vision Document Processing CLI
 * 
 * Command-line utility to process PDF and PowerPoint documents using the 
 * Gemini Vision model for accurate text and visual content extraction.
 * 
 * Usage:
 *   node visionProcessing.js --input="path/to/document.pdf" --output="path/to/output.json"
 * 
 * Options:
 *   --input        Path to the document to process (PDF or PPTX)
 *   --output       Path to save the processed results (optional)
 *   --maxPages     Maximum number of pages to process (default: all)
 *   --chunkSize    Size of text chunks in characters (default: 500)
 *   --overlapSize  Overlap size between chunks (default: 100)
 *   --separate     Whether to separate visuals into distinct chunks (default: true)
 *   --store        Whether to store processed chunks in vector store (default: false)
 *   --verbose      Enable detailed logging (default: false)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Set up ES module path handling
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the vision document analyzer
import { 
  processDocumentToChunks,
  analyzeDocumentWithVision
} from '../utils/visionDocumentAnalyzer.js';

// Import vector store utilities if needed
import { addDocumentToVectorStore } from '../utils/vectorStore.js';

// Set up environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: null,
    output: null,
    maxPages: Infinity,
    chunkSize: 500,
    overlapSize: 100,
    separate: true,
    store: false,
    verbose: false
  };

  for (const arg of args) {
    if (arg.startsWith('--input=')) {
      options.input = arg.substring(8);
    } else if (arg.startsWith('--output=')) {
      options.output = arg.substring(9);
    } else if (arg.startsWith('--maxPages=')) {
      options.maxPages = parseInt(arg.substring(11), 10);
    } else if (arg.startsWith('--chunkSize=')) {
      options.chunkSize = parseInt(arg.substring(12), 10);
    } else if (arg.startsWith('--overlapSize=')) {
      options.overlapSize = parseInt(arg.substring(14), 10);
    } else if (arg === '--separate') {
      options.separate = true;
    } else if (arg === '--no-separate') {
      options.separate = false;
    } else if (arg === '--store') {
      options.store = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

// Print help information
function printHelp() {
  console.log(chalk.bold('\nVision Document Processing CLI'));
  console.log('\nProcess documents using Gemini Vision for accurate text and visual extraction');
  console.log('\nUsage:');
  console.log('  node visionProcessing.js --input="path/to/document.pdf" [options]');
  
  console.log('\nOptions:');
  console.log('  --input=PATH       Path to the document to process (PDF or PPTX)');
  console.log('  --output=PATH      Path to save the processed results (optional)');
  console.log('  --maxPages=NUM     Maximum number of pages to process (default: all)');
  console.log('  --chunkSize=NUM    Size of text chunks in characters (default: 500)');
  console.log('  --overlapSize=NUM  Overlap size between chunks (default: 100)');
  console.log('  --separate         Separate visuals into distinct chunks (default)');
  console.log('  --no-separate      Keep visuals with surrounding text chunks');
  console.log('  --store            Store processed chunks in vector store');
  console.log('  --verbose          Enable detailed logging');
  console.log('  --help             Show this help message\n');
  
  console.log('Examples:');
  console.log('  node visionProcessing.js --input="docs/presentation.pptx" --store --verbose');
  console.log('  node visionProcessing.js --input="data/whitepaper.pdf" --output="data/processed/whitepaper.json" --maxPages=5\n');
}

// Validate input file
function validateInput(filePath) {
  if (!filePath) {
    console.error(chalk.red('❌ Error: No input file specified'));
    console.log('Use --input="path/to/document" to specify the document to process');
    console.log('Run with --help for more information');
    return false;
  }
  
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`❌ Error: File not found: ${filePath}`));
    return false;
  }
  
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.pdf' && ext !== '.pptx' && ext !== '.ppt') {
    console.error(chalk.red(`❌ Error: Unsupported file type: ${ext}`));
    console.log('Supported file types: .pdf, .pptx, .ppt');
    return false;
  }
  
  return true;
}

// Check if Gemini API key is available
function checkApiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    console.error(chalk.red('❌ Error: Gemini API key not found'));
    console.log('Please add GEMINI_API_KEY to your .env.local file');
    return false;
  }
  return true;
}

// Save results to output file
function saveResults(results, outputPath) {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write results to file
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    
    console.log(chalk.green(`✅ Results saved to: ${outputPath}`));
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error saving results: ${error.message}`));
    return false;
  }
}

// Process document and return results
async function processDocument(options) {
  console.log(chalk.bold('\n🔍 Processing document with Gemini Vision'));
  console.log(chalk.gray(`Document: ${options.input}`));
  
  const startTime = Date.now();
  
  try {
    // Process document to chunks
    console.log(chalk.blue('\n📄 Analyzing document...'));
    
    const processingOptions = {
      maxPages: options.maxPages,
      chunkSize: options.chunkSize,
      overlapSize: options.overlapSize,
      separateVisuals: options.separate,
      includePageImages: false,
      verbose: options.verbose
    };
    
    if (options.verbose) {
      console.log(chalk.gray('Processing options:'), processingOptions);
    }
    
    const result = await processDocumentToChunks(options.input, processingOptions);
    
    // Get processing time
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Display results
    console.log(chalk.green(`\n✅ Document processing complete (${processingTime}s)`));
    console.log(chalk.blue(`📊 Document: ${result.documentName}`));
    console.log(chalk.blue(`📚 Type: ${result.documentType}`));
    console.log(chalk.blue(`📝 Pages: ${result.pageCount}`));
    console.log(chalk.blue(`🧩 Chunks: ${result.chunks.length}`));
    
    const textChunks = result.chunks.filter(c => !c.metadata.hasVisualContent).length;
    const visualChunks = result.chunks.filter(c => c.metadata.hasVisualContent).length;
    
    console.log(chalk.blue(`📄 Text-only chunks: ${textChunks}`));
    console.log(chalk.blue(`🖼️ Visual chunks: ${visualChunks}`));
    
    if (options.verbose) {
      // Display sample chunk
      const sampleChunk = result.chunks[0];
      console.log(chalk.yellow('\n📝 Sample chunk:'));
      console.log(chalk.gray('-'.repeat(60)));
      console.log(`Text: ${sampleChunk.text.substring(0, 150)}...`);
      console.log(`Metadata: ${JSON.stringify(sampleChunk.metadata, null, 2)}`);
      console.log(chalk.gray('-'.repeat(60)));
    }
    
    return result;
  } catch (error) {
    console.error(chalk.red(`\n❌ Error processing document: ${error.message}`));
    if (options.verbose) {
      console.error(error);
    }
    return null;
  }
}

// Store chunks in vector store
async function storeChunks(chunks, options) {
  console.log(chalk.blue('\n💾 Storing chunks in vector store...'));
  
  try {
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      if (options.verbose) {
        console.log(chalk.gray(`Processing chunk ${i+1}/${chunks.length}`));
      }
      
      try {
        await addDocumentToVectorStore({
          text: chunk.text,
          metadata: {
            ...chunk.metadata,
            chunkIndex: i,
            totalChunks: chunks.length,
            hasVisualContent: !!chunk.visualContent,
            visualCount: chunk.visualContent ? chunk.visualContent.length : 0
          },
          visualContent: chunk.visualContent
        });
        
        successCount++;
      } catch (error) {
        errorCount++;
        if (options.verbose) {
          console.error(chalk.red(`Error storing chunk ${i+1}: ${error.message}`));
        }
      }
    }
    
    console.log(chalk.green(`✅ Stored ${successCount} chunks in vector store`));
    if (errorCount > 0) {
      console.log(chalk.yellow(`⚠️ Failed to store ${errorCount} chunks`));
    }
    
    return { successCount, errorCount };
  } catch (error) {
    console.error(chalk.red(`❌ Error storing chunks: ${error.message}`));
    return { successCount: 0, errorCount: chunks.length };
  }
}

// Main function
async function main() {
  // Parse command line arguments
  const options = parseArgs();
  
  // Show help and exit if no arguments provided
  if (process.argv.length <= 2) {
    printHelp();
    process.exit(0);
  }
  
  // Validate input file
  if (!validateInput(options.input)) {
    process.exit(1);
  }
  
  // Check API key
  if (!checkApiKey()) {
    process.exit(1);
  }
  
  // Process document
  const result = await processDocument(options);
  if (!result) {
    process.exit(1);
  }
  
  // Save results if output path provided
  if (options.output) {
    saveResults(result, options.output);
  }
  
  // Store chunks if requested
  if (options.store) {
    await storeChunks(result.chunks, options);
  }
  
  console.log(chalk.green.bold('\n🎉 Processing complete!'));
}

// Run the main function
main().catch(error => {
  console.error(chalk.red(`\n❌ Unhandled error: ${error.message}`));
  console.error(error);
  process.exit(1);
}); 
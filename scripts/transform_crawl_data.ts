/**
 * Transform Crawler Data for RAG
 * ------------------------------
 * This script transforms the raw data from the Universal Crawler
 * into the format expected by the RAG system for ingestion.
 * 
 * Usage:
 * npx ts-node scripts/transform_crawl_data.ts [input_dir] [output_file]
 * 
 * Example:
 * npx ts-node scripts/transform_crawl_data.ts ./data/crawl_data ./data/workstream_crawl_data_transformed.json
 */

import * as fs from 'fs';
import * as path from 'path';

// Simple logger implementation
const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  warning: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  }
};

// Default paths
const DEFAULT_INPUT_DIR = path.join(process.cwd(), 'data', 'crawl_data');
const DEFAULT_OUTPUT_FILE = path.join(process.cwd(), 'data', 'crawl_data_transformed.json');

// Get command line arguments
const inputDir = process.argv[2] || DEFAULT_INPUT_DIR;
const outputFile = process.argv[3] || DEFAULT_OUTPUT_FILE;

// Interface for raw crawler data
interface CrawlerData {
  url: string;
  title: string;
  content: string;
  original_content_length: number;
  cleaned_content_length: number;
  content_quality_score: number;
  passed_quality_check: boolean;
  metadata: {
    description: string;
    keywords: string[];
    author: string;
    publishDate: string;
  };
  extraction_date: string;
  images_folder: string | null;
  image_count: number;
}

// Interface for transformed data expected by RAG
interface TransformedData {
  url: string;
  title: string;
  content: string;
  timestamp: string;
  metadata: {
    source: string;
    content_quality_score: number;
    description: string;
    keywords: string[];
    author: string;
    publish_date: string;
    image_count: number;
    has_images: boolean;
  };
}

/**
 * Transform crawler data to RAG format
 */
function transformData(data: CrawlerData): TransformedData {
  return {
    url: data.url,
    title: data.title,
    content: data.content,
    timestamp: data.extraction_date,
    metadata: {
      source: 'web_crawl',
      content_quality_score: data.content_quality_score,
      description: data.metadata.description || '',
      keywords: data.metadata.keywords || [],
      author: data.metadata.author || '',
      publish_date: data.metadata.publishDate || '',
      image_count: data.image_count || 0,
      has_images: data.image_count > 0
    }
  };
}

/**
 * Process all crawler data files in a directory
 */
async function processCrawlData() {
  try {
    logger.info(`Processing crawler data from: ${inputDir}`);
    logger.info(`Output will be saved to: ${outputFile}`);

    // Ensure output directory exists
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get all JSON files (excluding debug, metadata, etc.)
    const files = fs.readdirSync(inputDir)
      .filter(file => file.endsWith('.json') && 
              !file.startsWith('crawl_summary') &&
              !file.startsWith('debug_'));
    
    logger.info(`Found ${files.length} content files to process`);

    // Process each file and transform data
    let transformedCount = 0;
    let skippedCount = 0;
    let transformedData: TransformedData[] = [];

    // Open output file for writing
    const outputStream = fs.createWriteStream(outputFile);
    
    // Process files in batches to avoid memory issues
    for (const file of files) {
      try {
        const filePath = path.join(inputDir, file);
        const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CrawlerData;
        
        // Skip low-quality content
        if (!rawData.passed_quality_check || rawData.content.length < 100) {
          skippedCount++;
          continue;
        }
        
        // Transform and write data
        const transformed = transformData(rawData);
        outputStream.write(JSON.stringify(transformed) + '\n');
        transformedCount++;
        
        // Log progress periodically
        if (transformedCount % 100 === 0) {
          logger.info(`Processed ${transformedCount} files...`);
        }
      } catch (error) {
        logger.error(`Error processing file ${file}:`, error);
        skippedCount++;
      }
    }
    
    // Close the output stream
    outputStream.end();
    
    logger.info(`Transformation complete!`);
    logger.info(`Successfully transformed: ${transformedCount} files`);
    logger.info(`Skipped: ${skippedCount} files`);
    logger.info(`Output saved to: ${outputFile}`);
    
    // Create a summary file
    const summary = {
      input_directory: inputDir,
      output_file: outputFile,
      total_files: files.length,
      transformed_count: transformedCount,
      skipped_count: skippedCount,
      transformation_date: new Date().toISOString()
    };
    
    fs.writeFileSync(
      outputFile.replace('.json', '_summary.json'),
      JSON.stringify(summary, null, 2),
      'utf8'
    );
    
    logger.info(`Summary saved to: ${outputFile.replace('.json', '_summary.json')}`);
  } catch (error) {
    logger.error('Fatal error in processing:', error);
    process.exit(1);
  }
}

// Run the transformation
processCrawlData().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
}); 
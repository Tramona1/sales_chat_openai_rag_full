/**
 * Transform Workstream Crawl Data Format Script
 * 
 * This script transforms the workstream crawl data from its original format (single large JSON object)
 * into the line-by-line JSON format expected by the process_crawl_data.ts script.
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  // Path to the workstream crawl data file
  inputFile: process.argv[2] || path.join(process.cwd(), 'workstream_crawl_data_unlimited_cleaned_NO_ROBOTS_FINAL.json'),
  
  // Output file with transformed data
  outputFile: process.argv[3] || path.join(process.cwd(), 'data/workstream_crawl_data_transformed.json'),
  
  // Whether to filter out failed URLs
  filterFailedUrls: true,
  
  // Minimum text length to consider (to filter out very short or empty pages)
  minTextLength: 100
};

// Transform the data
async function transformWorkstreamData(): Promise<void> {
  console.log(`Starting transformation of workstream crawl data: ${CONFIG.inputFile}`);
  
  try {
    // Read the input file
    const rawData = await fs.promises.readFile(CONFIG.inputFile, 'utf-8');
    console.log('File read successfully, parsing JSON...');
    
    // Parse the JSON
    const crawlData = JSON.parse(rawData);
    console.log(`Parsed JSON with ${Object.keys(crawlData).length} URLs`);
    
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(CONFIG.outputFile);
    await fs.promises.mkdir(outputDir, { recursive: true });
    
    // Create a write stream for the output file
    const writeStream = fs.createWriteStream(CONFIG.outputFile);
    
    // Counter for transformed URLs
    let transformedCount = 0;
    let skippedCount = 0;
    
    // Transform each URL entry
    for (const url of Object.keys(crawlData)) {
      const entry = crawlData[url];
      
      // Skip failed URLs if configured
      if (CONFIG.filterFailedUrls && entry.status !== 'success') {
        skippedCount++;
        continue;
      }
      
      // Skip entries with very short text
      if (entry.text && entry.text.length < CONFIG.minTextLength) {
        skippedCount++;
        continue;
      }
      
      // Create the transformed object
      const transformedEntry = {
        url: url,
        title: entry.title || '',
        content: entry.text || '',
        timestamp: new Date().toISOString()
      };
      
      // Write the transformed entry as a single line JSON
      writeStream.write(JSON.stringify(transformedEntry) + '\n');
      transformedCount++;
      
      // Log progress for every 100 entries
      if (transformedCount % 100 === 0) {
        console.log(`Transformed ${transformedCount} URLs...`);
      }
    }
    
    // Close the write stream
    writeStream.end();
    
    console.log(`\nTransformation complete!`);
    console.log(`Total URLs: ${Object.keys(crawlData).length}`);
    console.log(`Transformed: ${transformedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Output saved to: ${CONFIG.outputFile}`);
    
  } catch (error) {
    console.error('Error transforming workstream data:', error);
    process.exit(1);
  }
}

// Run the transformation if this script is executed directly
if (require.main === module) {
  transformWorkstreamData()
    .then(() => console.log('Data transformation completed successfully'))
    .catch(error => {
      console.error('Data transformation failed:', error);
      process.exit(1);
    });
}

export { transformWorkstreamData }; 
const fs = require('fs');
const path = require('path');

// Configuration
const inputFile = process.argv[2]; // Get input file from command line argument
const outputDir = path.join(process.cwd(), 'data', 'crawl_chunks');
const chunkSize = 50; // pages per file

if (!inputFile) {
  console.error('Error: Please provide an input file path.');
  console.error('Usage: node scripts/splitCrawlData.js workstream_crawl_data_unlimited_cleaned_NO_ROBOTS_FINAL.json');
  process.exit(1);
}

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Created output directory: ${outputDir}`);
}

// Read and parse the crawl data
console.log(`Reading crawl data from ${inputFile}...`);
let crawlData;
try {
  const fileData = fs.readFileSync(inputFile, 'utf-8');
  crawlData = JSON.parse(fileData);
} catch (error) {
  console.error(`Error reading or parsing input file: ${error.message}`);
  process.exit(1);
}

// Get URLs from the crawl data
const urls = Object.keys(crawlData);
const totalUrls = urls.length;
console.log(`Found ${totalUrls} URLs in the input file.`);

// Split data into chunks
let chunkNum = 1;
let processedUrls = 0;
let skippedUrls = 0;

for (let i = 0; i < totalUrls; i += chunkSize) {
  const chunkUrls = urls.slice(i, i + chunkSize);
  const chunkData = {};
  
  // Filter for only successful pages with content
  chunkUrls.forEach(url => {
    const pageData = crawlData[url];
    if (pageData.status === 'success' && pageData.text && pageData.text.trim().length > 100) {
      chunkData[url] = crawlData[url];
      processedUrls++;
    } else {
      skippedUrls++;
    }
  });
  
  // Only write chunk if it contains data
  if (Object.keys(chunkData).length > 0) {
    const outputFile = path.join(outputDir, `chunk_${chunkNum}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(chunkData, null, 2));
    console.log(`Wrote ${Object.keys(chunkData).length} URLs to ${outputFile}`);
    chunkNum++;
  }
}

console.log(`\nProcessing complete!`);
console.log(`Processed: ${processedUrls} valid URLs`);
console.log(`Skipped: ${skippedUrls} URLs (failed, empty, or too short)`);
console.log(`Created ${chunkNum - 1} chunk files in ${outputDir}`); 
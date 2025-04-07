/**
 * Convert JSON to JSONL Script
 * 
 * This script converts the nested JSON structure with URLs as keys
 * to a JSONL (JSON Lines) format where each line represents a document.
 */

const fs = require('fs');
const path = require('path');

// Check if a file path was provided
if (process.argv.length < 3) {
  console.log('Usage: node convert_json_to_jsonl.js <input_file.json> [output_file.jsonl]');
  process.exit(1);
}

// Get the input and output file paths
const inputFilePath = process.argv[2];
const outputFilePath = process.argv[3] || inputFilePath.replace('.json', '.jsonl');

try {
  console.log(`Reading file: ${inputFilePath}`);
  // Read the input JSON file
  const jsonData = fs.readFileSync(inputFilePath, 'utf8');
  
  // Parse the JSON
  const data = JSON.parse(jsonData);
  
  // Open the output file for writing
  const outputStream = fs.createWriteStream(outputFilePath);
  
  console.log('Converting to JSONL format...');
  let count = 0;
  
  // Process each URL entry
  for (const url in data) {
    if (data.hasOwnProperty(url)) {
      const entry = data[url];
      
      // Create a new object in the expected format
      const document = {
        url: url,
        title: entry.title || '',
        content: entry.text || '',
        timestamp: new Date().toISOString()
      };
      
      // Write the document as a JSON line
      outputStream.write(JSON.stringify(document) + '\n');
      count++;
      
      if (count % 100 === 0) {
        console.log(`Processed ${count} entries...`);
      }
    }
  }
  
  // Close the stream
  outputStream.end();
  
  console.log(`Conversion complete! ${count} entries written to ${outputFilePath}`);
} catch (error) {
  console.error('Error converting file:', error.message);
  process.exit(1);
} 
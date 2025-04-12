/**
 * Test script for jsonRepairUtils
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseAndRepairJson } from '../utils/jsonRepairUtils.js';

// Setup dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

// Get API key from environment
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
console.log('API key present:', apiKey ? 'Yes' : 'No');

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(apiKey);
console.log('Successfully imported jsonRepairUtils');

// Test cases
const testCases = [
  {
    name: "Valid JSON",
    input: '{"name":"Test","value":123}'
  },
  {
    name: "JSON with unquoted keys",
    input: '{name:"Test",value:123}'
  },
  {
    name: "JSON with missing commas",
    input: `{"summary":"Sales Guide" "type":"guide" "level":1}`
  }
];

// Run tests
async function runTests() {
  console.log('Starting JSON repair tests...');
  
  // Options for repair
  const options = { genAI };
  
  for (const test of testCases) {
    console.log(`\n--- Testing: ${test.name} ---`);
    console.log('Input:', test.input);
    
    try {
      const result = await parseAndRepairJson(test.input, options);
      console.log('Result:', JSON.stringify(result, null, 2));
      console.log('✅ Success');
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
}

// Run the tests
runTests().then(() => {
  console.log('\nAll tests completed');
}).catch(error => {
  console.error('Test error:', error);
}); 
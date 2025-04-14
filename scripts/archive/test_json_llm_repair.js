/**
 * Test Script for LLM-based JSON Repair
 * 
 * This script tests the ability of our LLM-based JSON repair mechanism to fix various types of malformed JSON.
 */

// Load environment variables
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

// Import the necessary modules
const { generateStructuredGeminiResponse } = require('../dist/utils/geminiClient');

// Sample malformed JSON examples
const malformedExamples = [
  // Example 1: Missing quotes around keys
  `{
    name: "John Doe",
    age: 30,
    skills: ["JavaScript", "Python", "TypeScript"]
  }`,
  
  // Example 2: Trailing commas
  `{
    "products": [
      {"id": 1, "name": "Product A", "price": 19.99,},
      {"id": 2, "name": "Product B", "price": 29.99,},
    ],
    "totalCount": 2,
  }`,
  
  // Example 3: Single quotes instead of double quotes
  `{
    'user': {
      'id': 123,
      'name': 'Alice Smith',
      'isActive': true
    }
  }`,
  
  // Example 4: JSON wrapped in markdown code block
  "```json\n" +
  `[
    {"id": 1, "score": 8.5, "reason": "This result directly answers the query"},
    {"id": 2, "score": 6.2, "reason": "Partially relevant but missing key details"}
  ]` +
  "\n```",
  
  // Example 5: Comments in JSON (not valid JSON but common)
  `{
    "config": {
      // API endpoint
      "endpoint": "https://api.example.com",
      /* Authentication settings */
      "auth": {
        "type": "oauth2",
        "clientId": "client123"  // Client ID
      }
    }
  }`,
  
  // Example 6: Mixed quote styles and unquoted values
  `{
    "users": [
      {"name": "John", status: active, "role": admin},
      {"name": 'Jane', status: "inactive", 'role': "user"}
    ]
  }`,
  
  // Example 7: Extra text around JSON
  `Here is the configuration:
  {
    "server": "production",
    "port": 8080,
    "debug": false
  }
  Hope this helps!`,
  
  // Example 8: Nested malformed JSON
  `{
    "data": {
      items: [
        {"name": "Item 1", price: 10.99},
        {"name": "Item 2", price: 20.99,}
      ],
      metadata: {
        count: 2,
        page: 1,
      }
    }
  }`
];

// Simple schema for testing
const testSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    items: { type: 'array' },
    config: { type: 'object' }
  }
};

/**
 * Test JSON repair on each example
 */
async function runTests() {
  console.log('Starting LLM-based JSON repair tests...\n');
  
  for (let i = 0; i < malformedExamples.length; i++) {
    const example = malformedExamples[i];
    console.log(`\n----- TEST CASE ${i+1} -----`);
    console.log('Malformed JSON:');
    console.log(example.substring(0, 200) + (example.length > 200 ? '...' : ''));
    
    try {
      // Try direct parsing first (should fail)
      try {
        const directParse = JSON.parse(example);
        console.log('⚠️ Unexpected success: Direct parsing worked (no repair needed)');
        console.log(directParse);
      } catch (directError) {
        console.log('✅ Direct parsing failed as expected');
        
        // Now test with our LLM repair function
        console.log('Testing LLM repair...');
        const systemPrompt = "You are a JSON validation assistant. Fix the provided JSON to make it valid.";
        const repaired = await generateStructuredGeminiResponse(systemPrompt, example, testSchema);
        
        console.log('✅ LLM repair successful! Result:');
        console.log(JSON.stringify(repaired, null, 2));
      }
    } catch (error) {
      console.log('❌ TEST FAILED:', error.message);
    }
    
    console.log('-'.repeat(30));
  }
  
  console.log('\nAll tests completed!');
}

// Run the tests
runTests().catch(err => {
  console.error('Test script failed:', err);
  process.exit(1);
}); 
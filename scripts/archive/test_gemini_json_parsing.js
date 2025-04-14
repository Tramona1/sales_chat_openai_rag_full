/**
 * Test script for Gemini JSON parsing function
 * This script tests the JSON parsing capabilities from geminiClient.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import fs from 'fs';

// Load environment variables from both .env and .env.local
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

// Get API key from environment
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(apiKey);

// Import the JSON extraction functions manually since they're not exported
// This is a simplified version for testing purposes
function extractJsonFromText(text) {
  // Try direct parsing first
  try {
    return JSON.parse(text);
  } catch (e) {
    // Check for JSON in code blocks (```json {...} ``` or ```json [...] ```)
    const codeBlockMatch = text.match(/```(?:json)?\s*([\[\{][\s\S]*?[\]\}])\s*```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (innerError) {
        // Try to fix common JSON syntax errors in the matched code block
        try {
          const cleanedText = codeBlockMatch[1]
            .replace(/(\w+):/g, '"$1":')  // Convert unquoted keys to quoted keys
            .replace(/'/g, '"')           // Replace single quotes with double quotes
            .replace(/,\s*}/g, '}')       // Remove trailing commas in objects
            .replace(/,\s*]/g, ']');      // Remove trailing commas in arrays
          return JSON.parse(cleanedText);
        } catch (cleanError) {
          // Continue to other approaches
        }
      }
    }
    
    // Try to extract any JSON object or array with balanced braces/brackets
    const jsonMatch = text.match(/([\[\{][\s\S]*?[\]\}])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        // If still failing, try cleaning the text more aggressively
        try {
          let cleanedText = jsonMatch[0]
            .replace(/(\w+):/g, '"$1":')  // Convert unquoted keys to quoted keys
            .replace(/'/g, '"')           // Replace single quotes with double quotes
            .replace(/,\s*}/g, '}')       // Remove trailing commas in objects
            .replace(/,\s*]/g, ']')       // Remove trailing commas in arrays
            .replace(/\n/g, '')           // Remove newlines
            .replace(/\t/g, '')           // Remove tabs
            .replace(/\\/g, '\\\\')       // Escape backslashes
            .replace(/"\s*:\s*([^"[\]{},\s][^,\s}]*)/g, '":"$1"'); // Quote unquoted string values
            
          // Fix common patterns with missing quotes around values
          cleanedText = cleanedText.replace(/":\s*(\w+)/g, (match, p1) => {
            // Don't add quotes to true, false, null, or numbers
            if (p1 === 'true' || p1 === 'false' || p1 === 'null' || !isNaN(Number(p1))) {
              return match;
            }
            return '":"' + p1 + '"';
          });
          
          return JSON.parse(cleanedText);
        } catch (finalError) {
          // Last resort: try to parse with a custom JSON-like structure repair
          try {
            // Replace consecutive commas with a single comma
            let repairText = jsonMatch[0].replace(/,\s*,+/g, ',');
            
            // Ensure object keys are properly quoted
            repairText = repairText.replace(/(\w+)\s*:/g, '"$1":');
            
            // Replace any comma followed by a closing bracket with just the bracket
            repairText = repairText.replace(/,(\s*[\]}])/g, '$1');
            
            // Quote unquoted values that aren't numbers, booleans or null
            repairText = repairText.replace(/":\s*([^",\{\}\[\]\s]+)([,\}\]])/g, (match, value, delimiter) => {
              if (value === 'true' || value === 'false' || value === 'null' || !isNaN(Number(value))) {
                return '":' + value + delimiter;
              }
              return '":"' + value + '"' + delimiter;
            });
            
            return JSON.parse(repairText);
          } catch (lastError) {
            // All traditional repair methods failed
            // Log the text that we couldn't parse
            console.error('Failed to extract valid JSON. Text sample:', text.substring(0, 200));
            console.log('All traditional JSON parsing methods failed, will try LLM repair');
            
            // Return a rejection object that the calling function can handle
            return {
              needsLLMRepair: true,
              text: text
            };
          }
        }
      }
    }
    
    // Log the text that we couldn't parse
    console.error('Failed to extract valid JSON. Text sample:', text.substring(0, 200));
    console.log('No JSON structure detected, will try LLM repair');
    
    // Return a rejection object that the calling function can handle
    return {
      needsLLMRepair: true,
      text: text
    };
  }
}

/**
 * Last-resort method that uses the LLM itself to repair malformed JSON
 * Only called when all other JSON extraction methods have failed
 */
async function tryLLMJsonRepair(text) {
  console.log('[JSON Repair] Attempting LLM-based JSON repair as last resort');
  
  try {
    // Create a Gemini model instance with minimal settings
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
    });
    
    // Create a simple prompt asking the LLM to fix the JSON
    const repairPrompt = `
I need you to fix the following malformed JSON and return ONLY the corrected, valid JSON with no explanations or additional text.
Don't change the structure or content, just fix the syntax to make it valid JSON.
Do NOT use markdown formatting or code blocks. Just return the raw JSON.

Here's the malformed JSON:
${text}
`;
    
    // Generate the repaired JSON
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: repairPrompt }] }],
      generationConfig: {
        temperature: 0.1, // Very low temperature for deterministic repairs
        maxOutputTokens: 2048,
      },
    });
    
    // Extract the repaired JSON text
    const repairedText = result.response.text();
    console.log('[JSON Repair] LLM generated repair attempt:', repairedText.substring(0, 100) + '...');
    
    // Try parsing the repaired text - first try to handle code blocks
    try {
      // Check if the response includes a code block and extract just the JSON
      const codeBlockMatch = repairedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        console.log('[JSON Repair] Extracted JSON from code block');
        return JSON.parse(codeBlockMatch[1]);
      }
      
      // Try direct parsing
      return JSON.parse(repairedText);
    } catch (parseError) {
      console.log('[JSON Repair] Initial parsing failed, trying alternative extraction');
      
      // If direct parsing fails, try to extract first JSON-like structure
      const jsonMatch = repairedText.match(/([\[\{][\s\S]*?[\]\}])/);
      if (jsonMatch) {
        try {
          console.log('[JSON Repair] Found JSON-like structure');
          return JSON.parse(jsonMatch[0]);
        } catch (jsonMatchError) {
          // Try more aggressive cleaning if even that fails
          try {
            console.log('[JSON Repair] Attempting aggressive cleaning of extracted structure');
            let cleanedText = jsonMatch[0]
              .replace(/(\w+):/g, '"$1":')  // Convert unquoted keys to quoted keys
              .replace(/'/g, '"')           // Replace single quotes with double quotes
              .replace(/,\s*}/g, '}')       // Remove trailing commas in objects
              .replace(/,\s*]/g, ']');      // Remove trailing commas in arrays
              
            return JSON.parse(cleanedText);
          } catch (finalError) {
            console.error('[JSON Repair] All extraction methods failed on repaired text');
            throw finalError;
          }
        }
      }
      
      // For non-JSON responses or completely malformed responses
      if (repairedText.toLowerCase().includes('cannot') || 
          repairedText.toLowerCase().includes('not json') ||
          repairedText.toLowerCase().includes('invalid')) {
        console.log('[JSON Repair] Model indicated input is not repairable as JSON');
        // If model says it can't be repaired, throw a more specific error
        throw new Error('The input text does not contain repairable JSON structure');
      }
      
      // If all else fails
      console.error('[JSON Repair] Failed to parse LLM-repaired JSON:', parseError);
      throw parseError;
    }
  } catch (error) {
    console.error('[JSON Repair] LLM-based repair failed:', error);
    throw new Error('LLM-based JSON repair failed');
  }
}

/**
 * Test function to generate malformed JSON and test repair
 */
async function testJsonParsing() {
  console.log('Starting JSON parsing tests...');

  // Test cases for JSON parsing
  const tests = [
    {
      name: "Valid JSON",
      input: '{"name":"Test","value":123,"items":["a","b","c"]}',
      expectSuccess: true
    },
    {
      name: "JSON with markdown code block",
      input: '```json\n{"name":"Test","value":123}\n```',
      expectSuccess: true
    },
    {
      name: "JSON with unquoted keys",
      input: '{name:"Test",value:123}',
      expectSuccess: true
    },
    {
      name: "JSON with trailing commas",
      input: '{"name":"Test","value":123,}',
      expectSuccess: true
    },
    {
      name: "JSON with single quotes",
      input: "{'name':'Test','value':123}",
      expectSuccess: true
    },
    {
      name: "JSON with unquoted values",
      input: '{"name":Test,"value":123}',
      expectSuccess: true
    },
    {
      name: "Severely malformed JSON",
      input: '{ name: Test, "items": [1, 2, 3,], description: "This is a test with missing quotes and trailing commas, }',
      expectSuccess: false // Should require LLM repair
    },
    {
      name: "JSON with text before and after",
      input: 'Here is the data: {"name":"Test","value":123} And that is all.',
      expectSuccess: true
    },
    {
      name: "Empty object with text",
      input: 'Result: {}',
      expectSuccess: true
    },
    {
      name: "Completely malformed input",
      input: 'This is not JSON at all, just some regular text without any braces or brackets.',
      expectSuccess: false // Should require LLM repair
    }
  ];

  // Run tests
  for (const test of tests) {
    console.log(`\n--- Running test: ${test.name} ---`);
    
    try {
      console.log('Input:', test.input);
      const result = extractJsonFromText(test.input);
      
      if (result && result.needsLLMRepair) {
        console.log('Standard parsing failed, needs LLM repair');
        
        if (!test.expectSuccess) {
          console.log('✅ Test passed: Correctly identified as needing LLM repair');
        } else {
          console.log('❌ Test failed: Expected standard parsing to succeed');
        }
        
        // Try LLM repair
        try {
          console.log('Attempting LLM repair...');
          const repairedResult = await tryLLMJsonRepair(result.text);
          console.log('LLM repair succeeded:', JSON.stringify(repairedResult).substring(0, 100));
          console.log('✅ LLM repair test passed');
        } catch (repairError) {
          console.error('LLM repair failed:', repairError);
          console.log('❌ LLM repair test failed');
        }
      } else {
        console.log('Parsed result:', JSON.stringify(result));
        
        if (test.expectSuccess) {
          console.log('✅ Test passed: Successfully parsed without LLM repair');
        } else {
          console.log('❓ Unexpected success: Standard parsing succeeded when expected to fail');
        }
      }
    } catch (error) {
      console.error('Error during test:', error);
      console.log('❌ Test failed with unexpected error');
    }
  }

  // Test LLM repair directly with some custom malformed content
  console.log('\n--- Testing direct LLM repair with custom malformed content ---');
  
  const customMalformedJson = `
  {
    summary: "This is a document about sales strategies",
    mainTopics: ["lead generation", "conversion optimization" "customer retention"],
    "entities": ["Sales Team", CRM Software, Marketing Department],
    documentType: 'sales training',
    technicalLevel: 2,
    audienceType: [sales representatives, "marketing team", "managers"]
  }
  `;
  
  // Add another test case with missing commas
  const customMalformedJson2 = `
  {
    "summary": "Sales Enablement Guide"
    "documentType": "guide"
    "technicalLevel": 1
    "mainTopics": ["sales enablement", "CRM", "content management", "training"]
    "entities": ["Sales Team", "Marketing", "Customer Success"]
    "audienceType": ["sales representatives", "sales managers", "executives"]
  }
  `;
  
  try {
    console.log('Test case 1:');
    const result = extractJsonFromText(customMalformedJson);
    if (result && result.needsLLMRepair) {
      console.log('Attempting LLM repair on custom malformed JSON...');
      const repairedResult = await tryLLMJsonRepair(result.text);
      console.log('Repaired JSON:', JSON.stringify(repairedResult, null, 2));
      console.log('✅ Custom LLM repair test 1 passed');
    } else {
      console.log('Standard parsing unexpectedly succeeded on malformed input:', JSON.stringify(result, null, 2));
    }
    
    console.log('\nTest case 2:');
    const result2 = extractJsonFromText(customMalformedJson2);
    if (result2 && result2.needsLLMRepair) {
      console.log('Attempting LLM repair on second custom malformed JSON...');
      const repairedResult2 = await tryLLMJsonRepair(result2.text);
      console.log('Repaired JSON 2:', JSON.stringify(repairedResult2, null, 2));
      console.log('✅ Custom LLM repair test 2 passed');
    } else {
      console.log('Standard parsing unexpectedly succeeded on malformed input 2:', JSON.stringify(result2, null, 2));
    }
  } catch (error) {
    console.error('Error during custom test:', error);
    console.log('❌ Custom test failed with unexpected error');
  }
}

// Run the tests
testJsonParsing().then(() => {
  console.log('All tests completed');
}).catch(error => {
  console.error('Error running tests:', error);
}); 
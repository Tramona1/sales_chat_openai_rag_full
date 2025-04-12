/**
 * JSON Repair Utilities
 * 
 * This module provides robust functions for parsing potentially malformed JSON
 * and repairing it using various strategies, including LLM-based repair as a last resort.
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Default model config to use if imports fail
const DEFAULT_MODEL_CONFIG = {
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  settings: {
    temperature: 0.2,
    maxTokens: 4000
  }
};

/**
 * Robustly extract a JSON object from text that may contain markdown, code blocks, or other formatting
 * @param {string} text - Text that potentially contains JSON
 * @returns {object|{needsLLMRepair: boolean, text: string}} - Parsed JSON object or an object indicating LLM repair is needed
 */
export function extractJsonFromText(text) {
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
 * @param {string} text - The malformed JSON text to repair
 * @param {object} options - Optional configuration
 * @param {string} options.apiKey - API key to use (defaults to using the genAI instance)
 * @param {object} options.genAI - GoogleGenerativeAI instance to use
 * @returns {Promise<object>} - The repaired JSON object
 */
export async function tryLLMJsonRepair(text, options = {}) {
  console.log('[JSON Repair] Attempting LLM-based JSON repair as last resort');
  
  try {
    // Use provided genAI instance or create a new one if API key is provided
    let genAI = options.genAI;
    if (!genAI && options.apiKey) {
      genAI = new GoogleGenerativeAI(options.apiKey);
    }
    
    if (!genAI) {
      throw new Error('No GoogleGenerativeAI instance or API key provided for LLM repair');
    }
    
    // Use default model config
    const modelConfig = DEFAULT_MODEL_CONFIG;
    
    // Create a Gemini model instance with minimal settings
    const model = genAI.getGenerativeModel({
      model: modelConfig.model,
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
        temperature: modelConfig.settings.temperature,
        maxOutputTokens: modelConfig.settings.maxTokens,
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
 * Helper function to handle JSON extraction and repair in one call
 * @param {string} text - Text potentially containing JSON
 * @param {object} options - Optional configuration for LLM repair
 * @returns {Promise<object>} - The extracted or repaired JSON
 */
export async function parseAndRepairJson(text, options = {}) {
  // First try standard extraction
  const result = extractJsonFromText(text);
  
  // If we got a regular object back, return it
  if (!result || !result.needsLLMRepair) {
    return result;
  }
  
  // If we need LLM repair, try it
  console.log('[JSON Repair] Standard extraction failed, attempting LLM repair');
  return await tryLLMJsonRepair(result.text, options);
} 
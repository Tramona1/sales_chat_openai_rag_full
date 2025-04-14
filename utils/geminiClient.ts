/**
 * Gemini Client
 * 
 * This module provides functions for interacting with Google's Gemini API
 * to generate structured responses at a lower cost than GPT-4.
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { logError, logDebug } from './logger';
import dotenv from 'dotenv';
import { parseAndRepairJson } from './jsonRepairUtils.js';

// Load environment variables
dotenv.config();

// Use dynamic import for modelConfig
let getModelForTask: any = async (config?: any, task?: string) => {
  // Default implementation in case imports fail
  return {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    settings: {
      temperature: 0.2,
      maxTokens: 4000
    }
  };
};

// Initialize getModelForTask asynchronously
(async () => {
  try {
    // Try to import from modelConfig
    const modelConfig = await import('./modelConfig');
    getModelForTask = modelConfig.getModelForTask;
  } catch (error) {
    console.warn('Error importing from modelConfig, using fallback', error);
    try {
      // Try to import from fallback
      const fallbackConfig = await import('./modelConfigFallback');
      getModelForTask = fallbackConfig.getModelForTask;
    } catch (fallbackError) {
      console.error('Failed to import from modelConfigFallback too', fallbackError);
      // Will use the default implementation defined above
    }
  }
})();

// Get API key from environment
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

// Initialize the Google Generative AI client
let genAI: GoogleGenerativeAI;
try {
  genAI = new GoogleGenerativeAI(apiKey || '');
} catch (error) {
  console.error('Error initializing Google Generative AI client:', error);
}

// Available Gemini models:
// - gemini-2.0-flash: Latest model, faster and more efficient
// - gemini-2.0-pro: High capability model for complex tasks
// - gemini-1.0-pro: Earlier generation model

/**
 * Robustly extract a JSON object from text that may contain markdown, code blocks, or other formatting
 * @returns parsed JSON object or a Promise that will resolve to the parsed JSON if LLM repair is needed
 */
function extractJsonFromText(text: string): any {
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
async function tryLLMJsonRepair(text: string): Promise<any> {
  console.log('[JSON Repair] Attempting LLM-based JSON repair as last resort');
  
  try {
    // Get model configuration
    const modelConfig = await getModelForTask(undefined, 'context');
    
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

${text}
`;
    
    // Generate the repaired JSON
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: repairPrompt }] }],
      generationConfig: {
        temperature: 0.1, // Very low temperature for deterministic repairs
        maxOutputTokens: modelConfig.settings.maxTokens || 2048,
      },
    });
    
    // Extract the repaired JSON text
    const repairedText = result.response.text();
    console.log('[JSON Repair] LLM generated repair:', repairedText.substring(0, 100) + '...');
    
    // Try parsing the repaired text
    try {
      return JSON.parse(repairedText);
    } catch (parseError) {
      // If direct parsing fails, try to extract JSON from the response
      const jsonMatch = repairedText.match(/([\[\{][\s\S]*?[\]\}])/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If that fails too, give up and throw the error
      console.error('[JSON Repair] Failed to parse LLM-repaired JSON:', parseError);
      throw parseError;
    }
  } catch (error) {
    console.error('[JSON Repair] LLM-based repair failed:', error);
    throw new Error('LLM-based JSON repair failed');
  }
}

/**
 * Generate a structured response using Gemini API
 * @param systemPrompt The system instructions
 * @param userPrompt The user query or content to analyze
 * @param responseSchema JSON schema for the response structure
 * @returns Structured response object
 */
export async function generateStructuredGeminiResponse(
  systemPrompt: string,
  userPrompt: string,
  responseSchema: any
): Promise<any> {
  if (!apiKey || apiKey === 'your_google_ai_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured in environment');
  }

  try {
    // Combine system prompt with schema instructions
    const combinedPrompt = `${systemPrompt}
    
You MUST return a JSON object that matches the following schema:

${JSON.stringify(responseSchema, null, 2)}

IMPORTANT: Return ONLY the raw JSON data with NO markdown formatting, no code blocks, and no extra text.
DO NOT wrap the JSON in \`\`\`json or any other formatting.
The response should begin with either { or [ and end with } or ], with no text before or after.
Ensure all JSON keys and string values are in double quotes.
Do not use trailing commas in objects or arrays.`;

    // Get model configuration from the central config
    const modelConfig = await getModelForTask(undefined, 'context');

    // Create a Gemini model instance
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

    // Generate content
    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: combinedPrompt }] },
        { role: 'model', parts: [{ text: 'I understand. I will provide a properly formatted JSON object that matches the schema, with no additional text or formatting.' }] },
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      generationConfig: {
        temperature: modelConfig.settings.temperature,
        maxOutputTokens: modelConfig.settings.maxTokens || 4000,
      },
    });

    const response = result.response;
    const text = response.text();

    // Use the robust JSON parser and repair function instead of the previous implementation
    try {
      return await parseAndRepairJson(text, { genAI });
    } catch (error) {
      // If even our robust parsing/repair failed, return an error object
      logError('Failed to parse Gemini response as JSON even with repair', error);
      return {
        error: true,
        message: "Failed to parse Gemini response as JSON",
        rawResponse: text.substring(0, 500) // Include a sample of the raw response for debugging
      };
    }
  } catch (error) {
    logError('Error in generateStructuredGeminiResponse', error);
    throw error;
  }
}

/**
 * Generate a chat completion using Gemini API
 * @param systemPrompt System instructions
 * @param userPrompt User query or content
 * @returns Generated text response
 */
export async function generateGeminiChatCompletion(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (!apiKey || apiKey === 'your_google_ai_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured in environment');
  }

  try {
    // Get model configuration from the central config
    const modelConfig = await getModelForTask(undefined, 'chat');

    // <<< ADDED LOGGING >>>
    logDebug(`[generateGeminiChatCompletion] Using model name from config: ${modelConfig.model}`);

    // Create a Gemini model instance
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

    // Generate content
    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'I understand and will follow these instructions.' }] },
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      generationConfig: {
        temperature: modelConfig.settings.temperature,
        maxOutputTokens: modelConfig.settings.maxTokens || 2048,
      },
    });

    return result.response.text();
  } catch (error) {
    logError('Error in generateGeminiChatCompletion', error);
    return 'I apologize, but I encountered an issue processing your request. Please try again later.';
  }
}

/**
 * Extract document context using Gemini to understand the document content
 * @param documentText The text content of the document to analyze
 * @param metadata Optional existing metadata to enhance the analysis
 * @returns Structured document context including summary, topics, and more
 */
export async function extractDocumentContext(
  documentText: string,
  metadata?: Record<string, any>
): Promise<{
  summary: string;
  mainTopics: string[];
  entities: string[];
  documentType: string;
  technicalLevel: number;
  audienceType: string[];
}> {
  // Get a limited version of the text to avoid token limits
  const truncatedText = documentText.substring(0, 12000);
  
  // Create a descriptive prompt that includes any existing metadata
  let metadataHint = '';
  if (metadata) {
    metadataHint = `\nExisting metadata: ${JSON.stringify(metadata)}`;
  }
  
  const prompt = `
Analyze the following document and extract key information.
${metadataHint}

DOCUMENT:
${truncatedText}

Provide your analysis in JSON format with the following fields:
- summary: A concise 1-2 sentence summary of the document
- mainTopics: An array of 3-5 main topics covered
- entities: An array of key entities (people, companies, products) mentioned
- documentType: The type of document (e.g., "technical documentation", "marketing material", "educational content", "product documentation", "case study", "white paper", "tutorial", "guide", "API reference")
- technicalLevel: A number from 0-3 indicating technical complexity (0=non-technical, 3=highly technical)
- audienceType: An array of specific target audiences. Consider multiple dimensions:
  * Role types: developers, data scientists, executives, sales reps, marketing team, product managers, support staff, IT admins, DevOps, designers, architects, consultants, etc.
  * Seniority: junior, mid-level, senior, executive, C-suite
  * Industries: healthcare, finance, education, retail, manufacturing, tech, telecom, media, government, etc.
  * Technical knowledge: technical, semi-technical, non-technical
  * Buying stage: prospect, evaluating, customer, partner
  * Department: engineering, marketing, sales, operations, HR, finance, legal, customer success
Be specific and comprehensive with audience tags.
`;

  try {
    // Define the expected schema
    const responseSchema = {
      summary: "string",
      mainTopics: "string[]",
      entities: "string[]",
      documentType: "string",
      technicalLevel: "number",
      audienceType: "string[]"
    };
    
    // Get model configuration from the central config
    const modelConfig = await getModelForTask(undefined, 'context');
    
    // Create the model instance
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
    
    // Generate content
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: modelConfig.settings.temperature,
        maxOutputTokens: modelConfig.settings.maxTokens || 4000,
      },
    });
    
    const response = result.response;
    const text = response.text();

    // Use the robust JSON parsing/repair utility
    try {
      const parsedResult = await parseAndRepairJson(text, { genAI });
      return parsedResult as {
        summary: string;
        mainTopics: string[];
        entities: string[];
        documentType: string;
        technicalLevel: number;
        audienceType: string[];
      };
    } catch (error) {
      console.error("Error parsing JSON response:", error);
      
      // Fallback to extracting information using regex patterns
      try {
        const extractedContext = extractBasicContext(text, metadata);
        
        // If we got something meaningful, return it
        if (extractedContext.summary && extractedContext.mainTopics.length > 0) {
          return extractedContext;
        }
      } catch (fallbackError) {
        console.error("Error in fallback extraction:", fallbackError);
      }
      
      // If all else fails, use rule-based extraction from the original text
      return {
        summary: documentText.substring(0, 200) + "...",
        mainTopics: extractTopicsFromText(documentText, metadata?.title || ''),
        entities: extractEntitiesFromText(documentText, metadata?.title || ''),
        documentType: inferDocumentType(documentText),
        technicalLevel: inferTechnicalLevel(documentText),
        audienceType: inferAudienceType(documentText, metadata?.title || '')
      };
    }
  } catch (error) {
    console.error("Error generating document context:", error);
    
    // Return a basic fallback in case of error
    return {
      summary: documentText.substring(0, 200) + "...",
      mainTopics: extractTopicsFromText(documentText, metadata?.title || ''),
      entities: extractEntitiesFromText(documentText, metadata?.title || ''),
      documentType: inferDocumentType(documentText),
      technicalLevel: inferTechnicalLevel(documentText),
      audienceType: inferAudienceType(documentText, metadata?.title || '')
    };
  }
}

/**
 * Extract basic context using regex patterns from LLM response text
 */
function extractBasicContext(responseText: string, metadata?: Record<string, any>): {
  summary: string;
  mainTopics: string[];
  entities: string[];
  documentType: string;
  technicalLevel: number;
  audienceType: string[];
} {
  // Try to extract data using regex patterns
  const summaryMatch = responseText.match(/summary["\s:]+([^"]+)/i) ||
                       responseText.match(/summary["\s:]+(.+?)(?=\n|main)/is);
  const summary = summaryMatch ? summaryMatch[1].trim() : (metadata?.title || '');
  
  // Extract topics using various patterns
  const topicsPattern = /main\s*topics["\s:]+\[(.*?)\]/is; 
  const topicsListPattern = /main\s*topics["\s:]+\s*(?:\n\s*[-*]\s*(.+))+/im;
  
  let mainTopics: string[] = [];
  const topicsMatch = responseText.match(topicsPattern);
  if (topicsMatch && topicsMatch[1]) {
    // Handle JSON-style array
    mainTopics = topicsMatch[1].split(',')
      .map(topic => topic.replace(/"/g, '').trim())
      .filter(Boolean);
  } else {
    // Try to handle bullet-point style
    const topicsListMatch = responseText.match(topicsListPattern);
    if (topicsListMatch) {
      const bulletMatches = responseText.matchAll(/[-*]\s*(.+)/g);
      mainTopics = Array.from(bulletMatches, m => m[1].trim());
    } else {
      // Fallback: just look for any mentions of topics
      const topicsMentionMatch = responseText.match(/topics[^:]*:(.+?)(?=\n\n|\n[a-z]+:)/is);
      if (topicsMentionMatch) {
        mainTopics = topicsMentionMatch[1].split(',')
          .map(topic => topic.trim())
          .filter(Boolean);
      }
    }
  }
  
  // Extract entities using similar approach
  const entitiesPattern = /entities["\s:]+\[(.*?)\]/is;
  const entitiesListPattern = /entities["\s:]+\s*(?:\n\s*[-*]\s*(.+))+/im;
  
  let entities: string[] = [];
  const entitiesMatch = responseText.match(entitiesPattern);
  if (entitiesMatch && entitiesMatch[1]) {
    entities = entitiesMatch[1].split(',')
      .map(entity => entity.replace(/"/g, '').trim())
      .filter(Boolean);
  } else {
    const entitiesListMatch = responseText.match(entitiesListPattern);
    if (entitiesListMatch) {
      const bulletMatches = responseText.matchAll(/[-*]\s*(.+)/g);
      entities = Array.from(bulletMatches, m => m[1].trim())
                 .filter(entity => !mainTopics.includes(entity)); // Avoid duplicates
    } else {
      const entitiesMentionMatch = responseText.match(/entities[^:]*:(.+?)(?=\n\n|\n[a-z]+:)/is);
      if (entitiesMentionMatch) {
        entities = entitiesMentionMatch[1].split(',')
          .map(entity => entity.trim())
          .filter(Boolean);
      }
    }
  }
  
  // Extract document type
  const documentTypeMatch = responseText.match(/document\s*type["\s:]+([^"\n,]+)/i);
  const documentType = documentTypeMatch ? documentTypeMatch[1].trim() : inferDocumentType(responseText);
  
  // Extract technical level
  const technicalLevelMatch = responseText.match(/technical\s*level["\s:]+(\d)/i);
  let technicalLevel = 0;
  if (technicalLevelMatch) {
    technicalLevel = parseInt(technicalLevelMatch[1], 10);
    if (isNaN(technicalLevel) || technicalLevel < 0 || technicalLevel > 3) {
      technicalLevel = inferTechnicalLevel(responseText);
    }
  } else {
    technicalLevel = inferTechnicalLevel(responseText);
  }
  
  // Extract audience types
  const audiencePattern = /audience\s*type["\s:]+\[(.*?)\]/is;
  const audienceListPattern = /audience\s*type["\s:]+\s*(?:\n\s*[-*]\s*(.+))+/im;
  
  let audienceType: string[] = [];
  const audienceMatch = responseText.match(audiencePattern);
  if (audienceMatch && audienceMatch[1]) {
    audienceType = audienceMatch[1].split(',')
      .map(audience => audience.replace(/"/g, '').trim())
      .filter(Boolean);
  } else {
    const audienceListMatch = responseText.match(audienceListPattern);
    if (audienceListMatch) {
      const bulletMatches = responseText.matchAll(/[-*]\s*(.+)/g);
      audienceType = Array.from(bulletMatches, m => m[1].trim());
    } else {
      const audienceMentionMatch = responseText.match(/audience[^:]*:(.+?)(?=\n\n|\n[a-z]+:|\Z)/is);
      if (audienceMentionMatch) {
        audienceType = audienceMentionMatch[1].split(',')
          .map(audience => audience.trim())
          .filter(Boolean);
      }
    }
  }
  
  // If audience type is empty, infer it from the text
  if (!audienceType.length) {
    audienceType = inferAudienceType(responseText, metadata?.title || '');
  }
  
  return {
    summary,
    mainTopics: mainTopics.length ? mainTopics : extractTopicsFromText(responseText, metadata?.title || ''),
    entities: entities.length ? entities : extractEntitiesFromText(responseText, metadata?.title || ''),
    documentType,
    technicalLevel,
    audienceType
  };
}

/**
 * Extract potential topics from document text
 */
function extractTopicsFromText(text: string, title: string): string[] {
  // Extract potential topics based on frequency and position
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const titleWords = title ? title.toLowerCase().split(/\W+/).filter(w => w.length > 3) : [];
  
  // Count word frequency, giving more weight to words in the title
  const wordCount: Record<string, number> = {};
  for (const word of words) {
    wordCount[word] = (wordCount[word] || 0) + 1;
  }
  
  for (const word of titleWords) {
    wordCount[word] = (wordCount[word] || 0) + 5; // Title words get extra weight
  }
  
  // Remove common stop words
  const stopWords = ['this', 'that', 'these', 'those', 'with', 'from', 'about', 'which', 'their', 'have', 'will'];
  for (const word of stopWords) {
    delete wordCount[word];
  }
  
  // Get top words by frequency
  const sortedWords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(entry => entry[0]);
  
  // Try to combine adjacent common words to form phrases
  const phrases = new Set<string>();
  const textLower = text.toLowerCase();
  
  for (let i = 0; i < sortedWords.length; i++) {
    const word = sortedWords[i];
    for (let j = i + 1; j < sortedWords.length; j++) {
      const nextWord = sortedWords[j];
      const phrase = `${word} ${nextWord}`;
      if (textLower.includes(phrase)) {
        phrases.add(phrase);
      }
    }
    // Add single words as fallback
    if (phrases.size < 3) {
      phrases.add(word);
    }
  }
  
  // If we have title words, ensure they're included in topics
  for (const titleWord of titleWords) {
    if (phrases.size < 5) {
      phrases.add(titleWord);
    }
  }
  
  return Array.from(phrases).slice(0, 5);
}

/**
 * Extract potential entities from document text
 */
function extractEntitiesFromText(text: string, title: string): string[] {
  const entities = new Set<string>();
  
  // Look for potential company/product names (capitalized phrases)
  const capitalizedPhrases = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) || [];
  for (const phrase of capitalizedPhrases) {
    if (phrase.length > 4 && !phrase.match(/^(The|This|That|These|Those|When|Where|Why|How)/)) {
      entities.add(phrase);
    }
  }
  
  // Look for words that are all caps (potential acronyms/product names)
  const allCapsWords = text.match(/\b[A-Z]{2,}\b/g) || [];
  for (const word of allCapsWords) {
    if (word.length >= 2 && word !== 'IT' && word !== 'API') {
      entities.add(word);
    }
  }
  
  // Add title as a potential entity if it looks like a proper noun
  if (title && title.match(/^[A-Z]/)) {
    entities.add(title);
  }
  
  return Array.from(entities).slice(0, 10);
}

/**
 * Infer document type from content
 */
function inferDocumentType(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Check for patterns that suggest document types
  if (lowerText.includes('api') && (lowerText.includes('reference') || lowerText.includes('endpoint'))) {
    return 'API reference';
  } else if (lowerText.includes('tutorial') || lowerText.includes('step by step') || lowerText.includes('how to')) {
    return 'tutorial';
  } else if (lowerText.includes('guide') || lowerText.includes('best practices')) {
    return 'guide';
  } else if (lowerText.includes('white paper') || lowerText.includes('research')) {
    return 'white paper';
  } else if (lowerText.includes('case study') || lowerText.includes('success story')) {
    return 'case study';
  } else if (lowerText.includes('product') && (lowerText.includes('specification') || lowerText.includes('features'))) {
    return 'product documentation';
  } else if (lowerText.includes('marketing') || lowerText.includes('promotion') || lowerText.includes('advertisement')) {
    return 'marketing material';
  } else {
    return 'documentation';
  }
}

/**
 * Infer technical level from document content
 */
function inferTechnicalLevel(text: string): number {
  // Simple heuristic based on presence of technical terms
  const technicalTerms = [
    'api', 'code', 'function', 'method', 'class', 'object', 'variable', 'algorithm',
    'database', 'query', 'schema', 'authentication', 'encryption', 'protocol',
    'implementation', 'architecture', 'framework', 'library', 'dependency',
    'deployment', 'infrastructure', 'configuration', 'parameters'
  ];
  
  const lowerText = text.toLowerCase();
  let technicalTermCount = 0;
  
  technicalTerms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'g');
    const matches = lowerText.match(regex);
    if (matches) {
      technicalTermCount += matches.length;
    }
  });
  
  // Calculate density (terms per 1000 words)
  const wordCount = text.split(/\s+/).length;
  const termDensity = (technicalTermCount * 1000) / wordCount;
  
  // Assign technical level based on density
  if (termDensity > 15) return 3;
  if (termDensity > 8) return 2;
  if (termDensity > 3) return 1;
  return 0;
}

/**
 * Infer audience types from document content
 */
function inferAudienceType(text: string, title: string): string[] {
  const audiences = new Set<string>();
  const lowerText = text.toLowerCase();
  const lowerTitle = title ? title.toLowerCase() : '';
  
  // Check for role indicators
  const roleIndicators: [string, string][] = [
    ['develop', 'developers'],
    ['code', 'developers'],
    ['programming', 'developers'],
    ['enginee', 'engineers'],
    ['architect', 'architects'],
    ['design', 'designers'],
    ['product manag', 'product managers'],
    ['user experience', 'UX designers'],
    ['data scien', 'data scientists'],
    ['analytics', 'analysts'],
    ['market', 'marketing team'],
    ['sales', 'sales representatives'],
    ['executive', 'executives'],
    ['leadership', 'executives'],
    ['c-suite', 'C-suite executives'],
    ['ceo', 'C-suite executives'],
    ['cto', 'C-suite executives'],
    ['operation', 'operations team'],
    ['support', 'support staff'],
    ['customer service', 'customer service'],
    ['legal', 'legal team'],
    ['compliance', 'compliance officers'],
    ['IT', 'IT administrators'],
    ['sysadmin', 'system administrators'],
    ['devops', 'DevOps engineers']
  ];
  
  // Check for technical level indicators
  const technicalLevel = inferTechnicalLevel(text);
  if (technicalLevel >= 3) {
    audiences.add('technical');
  } else if (technicalLevel >= 1) {
    audiences.add('semi-technical');
  } else {
    audiences.add('non-technical');
  }
  
  // Check for role indicators in the text
  for (const [indicator, audience] of roleIndicators) {
    if (lowerText.includes(indicator) || lowerTitle.includes(indicator)) {
      audiences.add(audience);
    }
  }
  
  // Check for industry indicators
  const industryIndicators: [string, string][] = [
    ['healthcare', 'healthcare'],
    ['medical', 'healthcare'],
    ['finance', 'finance'],
    ['banking', 'finance'],
    ['investment', 'finance'],
    ['education', 'education'],
    ['learning', 'education'],
    ['retail', 'retail'],
    ['commerce', 'retail'],
    ['manufactur', 'manufacturing'],
    ['industr', 'manufacturing'],
    ['tech', 'technology'],
    ['software', 'technology'],
    ['hardware', 'technology'],
    ['telecom', 'telecommunications'],
    ['media', 'media'],
    ['entertainment', 'media'],
    ['government', 'government'],
    ['public sector', 'government']
  ];
  
  // Check for industry indicators
  for (const [indicator, industry] of industryIndicators) {
    if (lowerText.includes(indicator) || lowerTitle.includes(indicator)) {
      audiences.add(industry + ' industry');
    }
  }
  
  // Ensure we have at least some audiences
  if (audiences.size < 2) {
    // Add general roles based on technical level
    if (technicalLevel >= 2) {
      audiences.add('developers');
      audiences.add('engineers');
    } else if (technicalLevel >= 1) {
      audiences.add('product managers');
      audiences.add('technical managers');
    } else {
      audiences.add('business users');
      audiences.add('general audience');
    }
  }
  
  return Array.from(audiences);
}

/**
 * Generate context for an individual text chunk using Gemini
 * @param chunkText The text content of the chunk to analyze
 * @param metadata Optional metadata to enhance the analysis
 * @returns Structured chunk context including summary and key points
 */
export async function generateChunkContext(
  chunkText: string,
  metadata?: Record<string, any>
): Promise<{ summary: string; keyPoints: string[] }> {
  // Get a limited version of the text to avoid token limits
  const truncatedText = chunkText.substring(0, 6000);
  
  // Create a descriptive prompt that includes any existing metadata
  let metadataHint = '';
  if (metadata) {
    metadataHint = `\nDocument metadata: ${JSON.stringify(metadata)}`;
  }
  
  const prompt = `
Analyze the following text chunk and extract key information.
${metadataHint}

TEXT CHUNK:
${truncatedText}

Provide your analysis in JSON format with the following fields:
- summary: A concise 1-2 sentence summary of the key information in this chunk
- keyPoints: An array of 3-5 main points or facts covered in this text chunk
`;

  try {
    // Define the expected schema
    const responseSchema = {
      summary: "string",
      keyPoints: "string[]"
    };
    
    // Get model configuration from the central config
    const modelConfig = await getModelForTask(undefined, 'context');
    
    // Create the model instance
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
    
    // Generate content
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: modelConfig.settings.temperature,
        maxOutputTokens: modelConfig.settings.maxTokens || 4000,
      },
    });
    
    const response = result.response;
    const text = response.text();

    // Use the robust JSON parsing/repair utility
    try {
      const parsedResult = await parseAndRepairJson(text, { genAI });
      return parsedResult as { summary: string; keyPoints: string[] };
    } catch (error) {
      console.error("Error parsing JSON response:", error);
      
      // Simple fallback extraction using regex if JSON parsing fails
      const summaryMatch = text.match(/summary["\s:]+([^"]+)/i);
      const keyPointsMatch = text.match(/keyPoints["\s:]+\[(.*?)\]/is);
      
      const summary = summaryMatch ? summaryMatch[1].trim() : truncatedText.substring(0, 100) + "...";
      let keyPoints: string[] = [];
      
      if (keyPointsMatch) {
        const keyPointsText = keyPointsMatch[1];
        // Extract items from array format
        keyPoints = keyPointsText
          .split(/",\s*"/)
          .map(point => point.replace(/^["'\s]+|["'\s]+$/g, ''))
          .filter(Boolean);
      }
      
      if (keyPoints.length === 0) {
        // Split the text into sentences and take first few as key points
        keyPoints = truncatedText
          .split(/[.!?]+/)
          .filter(s => s.trim().length > 20)
          .slice(0, 3)
          .map(s => s.trim());
      }
      
      return {
        summary,
        keyPoints: keyPoints.length > 0 ? keyPoints : [truncatedText.substring(0, 100) + "..."]
      };
    }
  } catch (error) {
    console.error("Error generating chunk context:", error);
    
    // Return a basic fallback in case of error
    return {
      summary: truncatedText.substring(0, 100) + "...",
      keyPoints: [
        truncatedText.substring(0, 100) + "...",
        truncatedText.substring(100, 200) + "...",
        truncatedText.substring(200, 300) + "..."
      ].filter(Boolean)
    };
  }
}

/**
 * Generate embeddings for text using Google's Gemini text-embedding-004 model
 * This function should be used for consistency with the Supabase migration
 * @param text The text to embed
 * @returns An embedding vector
 */
export async function embedTextWithGemini(text: string): Promise<number[]> {
  console.warn('embedTextWithGemini is deprecated. Please use embedText from embeddingClient.ts instead.');
  
  try {
    // Import and redirect to the new embedding client
    const { embedText } = await import('./embeddingClient');
    return embedText(text);
  } catch (error) {
    logError('Error in embedTextWithGemini redirection', error);
    throw error;
  }
} 
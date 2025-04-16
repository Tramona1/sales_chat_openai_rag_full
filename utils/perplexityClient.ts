/**
 * Perplexity API Client
 * 
 * A lightweight client for the Perplexity API that provides real-time web search
 * capability to fetch information about companies.
 */

import axios from 'axios';
import { logError, logWarning, logInfo } from './logger';
import { cacheWithExpiry, getFromCache, logPerplexityUsage } from './perplexityUtils';
import { createServiceClient } from './supabaseClient';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Debug mode - Enable with PERPLEXITY_DEBUG=true environment variable
const DEBUG_MODE = process.env.PERPLEXITY_DEBUG === 'true';

// API constants - Load from environment variables
const API_KEY = process.env.PERPLEXITY_API_KEY || '';
const API_URL = 'https://api.perplexity.ai/chat/completions';
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || '';

// Cache settings
const CACHE_HOURS = parseInt(process.env.PERPLEXITY_CACHE_HOURS || '24', 10);
const COMPANY_INFO_CACHE_TIMEOUT = CACHE_HOURS * 60 * 60 * 1000; // Convert hours to milliseconds
const SUPABASE_CACHE_TABLE = 'company_information_cache';

// Common major companies for direct matching
const COMMON_COMPANIES: Record<string, string> = {
  'ford': 'Ford Motor Company',
  'apple': 'Apple Inc.',
  'google': 'Google LLC',
  'amazon': 'Amazon.com, Inc.',
  'microsoft': 'Microsoft Corporation',
  'ibm': 'IBM Corporation',
  'meta': 'Meta Platforms, Inc.',
  'facebook': 'Meta Platforms, Inc. (Facebook)',
  'walmart': 'Walmart Inc.',
  'target': 'Target Corporation',
  'nike': 'Nike, Inc.',
  'adidas': 'Adidas AG',
  'coca-cola': 'The Coca-Cola Company',
  'pepsi': 'PepsiCo, Inc.',
  'starbucks': 'Starbucks Corporation',
  'mcdonalds': 'McDonald\'s Corporation',
  'tesla': 'Tesla, Inc.',
  'toyota': 'Toyota Motor Corporation',
  'honda': 'Honda Motor Co., Ltd.',
  'bmw': 'BMW Group',
  'netflix': 'Netflix, Inc.',
  'spotify': 'Spotify Technology S.A.',
  'intel': 'Intel Corporation',
  'amd': 'Advanced Micro Devices, Inc.',
  'nvidia': 'NVIDIA Corporation',
  'samsung': 'Samsung Electronics Co., Ltd.',
  'sony': 'Sony Group Corporation',
  'disney': 'The Walt Disney Company',
  'at&t': 'AT&T Inc.',
  'verizon': 'Verizon Communications Inc.',
  'comcast': 'Comcast Corporation',
  'uber': 'Uber Technologies, Inc.',
  'lyft': 'Lyft, Inc.',
  'airbnb': 'Airbnb, Inc.',
  'oracle': 'Oracle Corporation',
  'salesforce': 'Salesforce, Inc.',
  'adobe': 'Adobe Inc.',
  'twitter': 'Twitter, Inc. (X Corp)',
  'linkedin': 'LinkedIn Corporation',
  'wells fargo': 'Wells Fargo & Company',
  'bank of america': 'Bank of America Corporation',
  'jp morgan': 'JPMorgan Chase & Co.',
  'visa': 'Visa Inc.',
  'mastercard': 'Mastercard Incorporated',
  'paypal': 'PayPal Holdings, Inc.',
  'ge': 'General Electric Company',
  'general electric': 'General Electric Company',
  'gm': 'General Motors Company',
  'general motors': 'General Motors Company',
  'pfizer': 'Pfizer Inc.',
  'johnson & johnson': 'Johnson & Johnson',
  'ups': 'United Parcel Service, Inc.',
  'fedex': 'FedEx Corporation',
  'costco': 'Costco Wholesale Corporation',
  'home depot': 'The Home Depot, Inc.',
  'lowes': 'Lowe\'s Companies, Inc.',
  'american express': 'American Express Company',
  'boeing': 'The Boeing Company',
  'airbus': 'Airbus SE',
  'siemens': 'Siemens AG',
};

// Logging utility for debugging
function debugLog(message: string, data?: any) {
  if (DEBUG_MODE) {
    console.log(`[PERPLEXITY DEBUG] ${message}`, data ? data : '');
    
    // Also log to a more permanent location if needed
    logInfo(`PERPLEXITY_DEBUG: ${message}`, data);
  }
}

/**
 * Sanitize company name to ensure it doesn't contain formatting instructions
 * 
 * @param companyName The company name to sanitize
 * @returns A cleaned company name
 */
function sanitizeCompanyName(companyName: string): string {
  if (!companyName) return '';
  
  // Check if the name contains numbering or markdown formatting
  const formattingPattern = /^\d+\.\s*\*\*.*\*\*|^\d+\.\s+|^\*\*.*\*\*$/;
  
  // If it matches a formatting pattern, extract the actual name
  if (formattingPattern.test(companyName)) {
    // Remove numbering like "1. " and markdown formatting "**"
    const cleanedName = companyName
      .replace(/^\d+\.\s*/, '')  // Remove numbering
      .replace(/\*\*/g, '')      // Remove markdown bold formatting
      .trim();
    
    logWarning(`Sanitized company name from "${companyName}" to "${cleanedName}"`);
    return cleanedName;
  }
  
  return companyName.trim();
}

/**
 * Properly capitalize a company name for display
 * 
 * @param companyName The company name to capitalize
 * @returns Properly capitalized company name
 */
export function capitalizeCompanyName(companyName: string): string {
  if (!companyName) return '';
  
  // Check if it's already properly capitalized (contains at least one uppercase letter)
  if (/[A-Z]/.test(companyName)) {
    return companyName;
  }
  
  // Check if it's a common company that should be returned with proper capitalization
  const normalizedName = companyName.toLowerCase().trim();
  if (COMMON_COMPANIES[normalizedName]) {
    return COMMON_COMPANIES[normalizedName];
  }
  
  // Otherwise capitalize the first letter of each word
  return companyName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Feature flag check functions
function isPerplexityEnabled(): boolean {
  return process.env.USE_PERPLEXITY === 'true';
}

function isCompanyResearchOnly(): boolean {
  return process.env.PERPLEXITY_COMPANY_RESEARCH_ONLY === 'true';
}

// Type definitions for better type safety
export interface CompanyInformation {
  companyInfo: string;
  industry?: string;
  size?: string;
  location?: string;
  website?: string;
  founded?: string;
  citations: string[];
  lastUpdated: Date;
  isRateLimited: boolean;
}

export interface CompanySuggestion {
  name: string;
  confidence: number; // 0-1 score of how confident we are in this suggestion
}

/**
 * Generate company name suggestions for potential misspellings
 * 
 * @param misspelledName The potentially misspelled company name
 * @returns Array of company name suggestions or empty array if none found
 */
export async function generateCompanySuggestions(misspelledName: string): Promise<CompanySuggestion[]> {
  try {
    // Log that we're attempting to generate suggestions
    logInfo(`Generating suggestions for potentially misspelled company name: "${misspelledName}"`);
    
    // If no API key is available, use local fallback matching
    if (!GOOGLE_AI_API_KEY) {
      logError('Google AI API key is missing for company suggestions');
      // Instead of just returning an empty array, try a local fallback approach
      return generateLocalSuggestions(misspelledName);
    }

    // Initialize Google AI with proper error handling
    const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Create a prompt that asks for suggestions with more specific guidance
    const prompt = `
The user has entered "${misspelledName}" as a company name, but this might be misspelled or incorrect.
Your task is to provide the most accurate corrections or alternatives.

IMPORTANT INSTRUCTIONS:
1. If this looks like a misspelling of a known company, correct it (e.g., "Appel" → "Apple Inc.")
2. Focus on well-known, real companies that match the general pattern or industry
3. Consider common typos, phonetic similarities, and spelling variations
4. ALWAYS provide at least one suggestion unless the input is completely unintelligible
5. For airlines, tech companies, retail, and other major industries, be especially thorough

Return your response in this exact JSON format, with 1-3 suggestions:
[
  {"name": "Correct Company Name 1", "confidence": 0.9},
  {"name": "Correct Company Name 2", "confidence": 0.7},
  {"name": "Correct Company Name 3", "confidence": 0.5}
]

Use confidence scores between 0 and 1, where 1 means extremely confident and 0 means not confident.
`;

    // Call Gemini API with error handling and timeout
    try {
      const result = await Promise.race([
        model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 250,
          },
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Gemini API timeout')), 10000)
        )
      ]) as any;
      
      const response = result.response;
      const responseText = response.text();
      
      // Log the raw response for debugging
      logInfo(`Raw Gemini suggestion response for "${misspelledName}": ${responseText.substring(0, 300)}`);
      
      // Parse JSON from the response
      try {
        // Find and extract JSON from the response
        const jsonMatch = responseText.match(/\[\s*\{.*\}\s*\]/);
        if (!jsonMatch) {
          logWarning(`Failed to extract JSON from Gemini suggestion response: ${responseText.substring(0, 100)}`);
          // Fall back to local suggestions if Gemini doesn't return valid JSON
          return generateLocalSuggestions(misspelledName);
        }
        
        const jsonData = JSON.parse(jsonMatch[0]);
        logInfo(`Generated company suggestions for "${misspelledName}": ${JSON.stringify(jsonData)}`);
        
        // Validate the array structure and filter out invalid entries
        const validSuggestions = jsonData
          .filter((suggestion: any) => {
            return suggestion && 
                   typeof suggestion.name === 'string' && 
                   typeof suggestion.confidence === 'number' &&
                   suggestion.confidence > 0;
          })
          .slice(0, 3); // Limit to 3 suggestions
          
        // If we got valid suggestions, return them
        if (validSuggestions.length > 0) {
          return validSuggestions;
        }
        
        // If no valid suggestions were found, try local fallback
        return generateLocalSuggestions(misspelledName);
      } catch (parseError) {
        logError(`Error parsing JSON from Gemini response for "${misspelledName}":`, parseError);
        logInfo(`Raw response: ${responseText.substring(0, 200)}`);
        // Fall back to local suggestions if JSON parsing fails
        return generateLocalSuggestions(misspelledName);
      }
    } catch (geminiError) {
      logError(`Error calling Gemini API for company suggestions for "${misspelledName}":`, geminiError);
      // Fall back to local suggestions if Gemini API call fails
      return generateLocalSuggestions(misspelledName);
    }
  } catch (error) {
    logError(`Unexpected error in generateCompanySuggestions for "${misspelledName}":`, error);
    // Fall back to local suggestions for any other errors
    return generateLocalSuggestions(misspelledName);
  }
}

/**
 * Generate local suggestions for company names without using external APIs
 * This is a fallback mechanism when the Gemini API is unavailable or fails
 * 
 * @param companyName The company name to find suggestions for
 * @returns Array of company name suggestions
 */
function generateLocalSuggestions(companyName: string): CompanySuggestion[] {
  logInfo(`Generating local suggestions for: "${companyName}"`);
  
  // Convert to lowercase for easier matching
  const normalizedName = companyName.toLowerCase().trim();
  
  // Common misspellings and their corrections
  const commonMisspellings: Record<string, string[]> = {
    // Airlines
    'air': ['American Airlines', 'Air France', 'Air Canada'],
    'airlo': ['Alaska Airlines', 'American Airlines', 'Air France'],
    'alaska': ['Alaska Airlines'],
    'alaska air': ['Alaska Airlines'],
    'alaska airline': ['Alaska Airlines'],
    'alaska airlone': ['Alaska Airlines'],
    'alaska airlones': ['Alaska Airlines'],
    'american': ['American Airlines', 'American Express'],
    'delta': ['Delta Air Lines'],
    'united': ['United Airlines', 'United Parcel Service'],
    
    // Tech companies
    'amazo': ['Amazon.com, Inc.'],
    'apple': ['Apple Inc.'],
    'face': ['Facebook', 'Meta Platforms, Inc.'],
    'fb': ['Meta Platforms, Inc.', 'Facebook'],
    'goog': ['Google LLC', 'Alphabet Inc.'],
    'googl': ['Google LLC', 'Alphabet Inc.'],
    'micro': ['Microsoft Corporation'],
    'tesla': ['Tesla, Inc.'],
    
    // Retail
    'walm': ['Walmart Inc.'],
    'target': ['Target Corporation'],
    'costc': ['Costco Wholesale Corporation'],
    
    // Food & Beverage
    'coca': ['The Coca-Cola Company'],
    'coke': ['The Coca-Cola Company'],
    'mcd': ['McDonald\'s Corporation'],
    'mcdo': ['McDonald\'s Corporation'],
    'starbuc': ['Starbucks Corporation'],
  };
  
  // Check for direct partial matches in our common misspellings dictionary
  for (const [key, suggestions] of Object.entries(commonMisspellings)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      // Return these suggestions with varying confidence levels
      return suggestions.map((name, index) => ({
        name,
        confidence: Math.max(0.95 - (index * 0.15), 0.5) // Decrease confidence for later items
      }));
    }
  }
  
  // Try fuzzy matching with common company names
  const fuzzyMatches: {name: string, score: number}[] = [];
  
  for (const [key, fullName] of Object.entries(COMMON_COMPANIES)) {
    // Simple character-based similarity score (Levenshtein would be better but this is simpler)
    const similarity = calculateSimilarity(normalizedName, key);
    
    if (similarity > 0.5) { // Only include reasonably good matches
      fuzzyMatches.push({
        name: fullName,
        score: similarity
      });
    }
  }
  
  // Sort by similarity score and take top 3
  const topMatches = fuzzyMatches
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  
  if (topMatches.length > 0) {
    return topMatches.map(match => ({
      name: match.name,
      confidence: match.score
    }));
  }
  
  // If all else fails, provide a generic suggestion based on industry clues in the name
  if (normalizedName.includes('air') || normalizedName.includes('airline') || normalizedName.includes('flight')) {
    return [
      { name: 'Alaska Airlines', confidence: 0.7 },
      { name: 'American Airlines', confidence: 0.6 },
      { name: 'United Airlines', confidence: 0.5 }
    ];
  }
  
  if (normalizedName.includes('tech') || normalizedName.includes('soft') || normalizedName.includes('comp')) {
    return [
      { name: 'Microsoft Corporation', confidence: 0.7 },
      { name: 'Apple Inc.', confidence: 0.6 },
      { name: 'Google LLC', confidence: 0.5 }
    ];
  }
  
  // Absolute last resort - just offer some major companies as suggestions
  return [
    { name: 'Apple Inc.', confidence: 0.4 },
    { name: 'Microsoft Corporation', confidence: 0.4 },
    { name: 'Amazon.com, Inc.', confidence: 0.4 }
  ];
}

/**
 * Calculate a simple similarity score between two strings
 * 
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score between 0 and 1
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  // If the shorter string is empty, there's no similarity
  if (shorter.length === 0) return 0;
  
  // Count matching characters (simplistic approach)
  let matchCount = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      matchCount++;
    }
  }
  
  // Return similarity as a ratio of matching characters to the shorter string's length
  return matchCount / shorter.length;
}

// Type definitions for Supabase cache
interface CompanyCache {
  id: string; // company name (URL encoded)
  data: CompanyInformation;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

// Add check for Supabase table at initialization
// Add near the top of the file, after constants

// Check if the required Supabase table exists
async function ensureSupabaseTableExists(client: any): Promise<boolean> {
  try {
    if (!client) return false;
    
    console.log('[VERCEL DEBUG] Checking if Supabase cache table exists...');
    
    // Try to query the table
    const { data, error } = await client
      .from(SUPABASE_CACHE_TABLE)
      .select('id')
      .limit(1);
    
    if (error) {
      // Check if the error indicates the table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.error(`[VERCEL DEBUG] Table ${SUPABASE_CACHE_TABLE} does not exist. Creating table...`);
        
        // Table doesn't exist, try to create it
        try {
          const createTableResult = await client.rpc('create_company_cache_table');
          console.log('[VERCEL DEBUG] Table creation result:', createTableResult);
          return true;
        } catch (createError) {
          console.error('[VERCEL DEBUG] Failed to create table:', createError);
          return false;
        }
      }
      
      console.error('[VERCEL DEBUG] Error checking Supabase table:', error);
      return false;
    }
    
    console.log(`[VERCEL DEBUG] Supabase table ${SUPABASE_CACHE_TABLE} exists.`);
    return true;
  } catch (error) {
    console.error('[VERCEL DEBUG] Error in ensureSupabaseTableExists:', error);
    return false;
  }
}

/**
 * Verify if a company exists and get the correct company name
 * 
 * @param companyName Name of the company to verify
 * @returns Verification result with company details
 */
export async function verifyCompanyIdentity(
  companyName: string,
  options: {
    forceRefresh?: boolean;
    useInMemoryCacheOnly?: boolean;
  } = {}
): Promise<{
  exists: boolean;
  fullName?: string;
  description?: string;
  industry?: string;
  isRateLimited: boolean;
  suggestions?: CompanySuggestion[];
}> {
  try {
    // Honor cache overrides from options
    let useInMemoryCacheOnly = options.useInMemoryCacheOnly || false;
    
    // Clean the input company name
    const sanitizedCompanyName = sanitizeCompanyName(companyName);
    
    // Check for well-known companies first (direct match)
    const normalizedName = sanitizedCompanyName.toLowerCase().trim();
    if (COMMON_COMPANIES[normalizedName]) {
      const commonCompany = COMMON_COMPANIES[normalizedName];
      logInfo(`Direct match found for "${sanitizedCompanyName}" -> "${commonCompany}"`);
      
      // Return verified information for the common company
      return {
        exists: true,
        fullName: commonCompany,
        description: `A well-known company in its industry.`,
        isRateLimited: false
      };
    }
    
    // Check if Perplexity is enabled
    if (!isPerplexityEnabled()) {
      logError('Perplexity API is disabled by configuration', new Error('USE_PERPLEXITY is not set to true'));
      return { 
        exists: false, 
        isRateLimited: true,
        description: 'Perplexity API is disabled. Please enable it in the configuration.'
      };
    }

    // First check if we have a valid API key
    if (!API_KEY) {
      logError('Perplexity API key is missing', new Error('PERPLEXITY_API_KEY environment variable is not set'));
      return { 
        exists: false, 
        isRateLimited: true,
        description: 'API key configuration error. Please contact support.'
      };
    }

    // Generate cache key using sanitized name
    const cacheKey = `company_verify_${encodeURIComponent(sanitizedCompanyName.toLowerCase().trim())}`;
    
    console.log(`[VERCEL DEBUG] In-memory cache only mode: ${useInMemoryCacheOnly}`);

    // Then update the /pages/api/company/verify.ts endpoint to provide the option:
    // const result = await verifyCompanyIdentity(companyName, {
    //   useInMemoryCacheOnly: !cacheTableExists
    // });

    // Check the in-memory cache first (most efficient)
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      logPerplexityUsage('verifyCompanyIdentity.cacheHit', { companyName });
      return cachedResult as {
        exists: boolean;
        fullName?: string;
        description?: string;
        industry?: string;
        isRateLimited: boolean;
        suggestions?: CompanySuggestion[];
      };
    }
    
    // Next, check the Supabase cache (with better error handling)
    let supabaseClient = null;
    try {
      // Try to get Vercel-specific client first if in Vercel environment
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        // Import vercelSupabaseClient dynamically to avoid circular dependencies
        try {
          console.log('[VERCEL DEBUG] Attempting to load Vercel Supabase client...');
          const vercelModule = await import('./vercelSupabaseClient');
          supabaseClient = vercelModule.getVercelSupabaseAdmin();
          
          if (supabaseClient) {
            console.log('[VERCEL DEBUG] Successfully loaded Vercel Supabase client');
            
            // Check if the table exists
            const tableExists = await ensureSupabaseTableExists(supabaseClient);
            if (!tableExists) {
              console.log('[VERCEL DEBUG] Using in-memory cache only as table does not exist');
              useInMemoryCacheOnly = true;
            }
          } else {
            console.log('[VERCEL DEBUG] Vercel Supabase client is null');
          }
        } catch (vercelClientError) {
          console.error('[VERCEL DEBUG] Error importing Vercel Supabase client:', vercelClientError);
          
          // Fall back to standard client
          console.log('[VERCEL DEBUG] Falling back to standard Supabase client');
          supabaseClient = createServiceClient();
        }
      } else {
        // Use standard client for non-Vercel environments
        supabaseClient = createServiceClient();
      }
      
      // Skip Supabase cache check if we've determined it's not working
      if (!useInMemoryCacheOnly && supabaseClient) {
        console.log('[VERCEL DEBUG] Checking Supabase cache for key:', cacheKey);
        
        try {
          const { data, error } = await supabaseClient
            .from(SUPABASE_CACHE_TABLE)
            .select('*')
            .eq('id', cacheKey)
            .single();
          
          if (error) {
            console.error('[VERCEL DEBUG] Supabase cache error:', error);
            // Continue without using cache
          } else if (data && new Date(data.expires_at) > new Date()) {
            // Cache hit - store in memory cache too
            console.log('[VERCEL DEBUG] Supabase cache hit for company:', companyName);
            
            // Verify data structure
            if (data.data && typeof data.data === 'object') {
              const cachedResult = data.data as {
                exists: boolean;
                fullName?: string;
                description?: string;
                industry?: string;
                isRateLimited: boolean;
                suggestions?: CompanySuggestion[];
              };
              
              console.log('[VERCEL DEBUG] Cache data validation successful');
              
              cacheWithExpiry(cacheKey, cachedResult, 
                new Date(data.expires_at).getTime() - Date.now());
              
              logPerplexityUsage('verifyCompanyIdentity.supabaseCacheHit', { companyName });
              return cachedResult;
            } else {
              console.error('[VERCEL DEBUG] Invalid cache data structure:', data.data);
            }
          } else {
            console.log('[VERCEL DEBUG] No valid cache entry found');
          }
        } catch (queryError) {
          console.error('[VERCEL DEBUG] Error querying Supabase cache:', queryError);
          // Continue without using cache
        }
      }
    } catch (cacheError) {
      // Just log the error and continue - we'll try the API call
      console.error('[VERCEL DEBUG] Error in Supabase cache lookup:', cacheError);
    }
    
    console.log('[VERCEL DEBUG] Proceeding with Perplexity API call for company:', companyName);

    // Not in cache, perform verification via direct check or API
    // Create an improved verification prompt that emphasizes the exact company name
    const prompt = `My search query is exactly "${sanitizedCompanyName}". Verify if this specific company exists.

If it is a real company, respond in this exact format (keep the headings):
Company Name: [Full official company name]
Description: [1-2 sentence description]
Industry: [Primary industry]

If this exact company doesn't exist or you're thinking of a different company, respond with EXACTLY "Company not found."

Important: I'm specifically looking for "${sanitizedCompanyName}" and not another company with a similar name.`;

    // Prepare API request - using 'low' search mode to minimize costs
    const response = await axios.post(
      API_URL,
      {
        model: "sonar",
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: 200,
        search_context_size: "low"
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Track API usage
    logPerplexityUsage('verifyCompanyIdentity.apiCall', { 
      companyName,
      promptTokens: response.data.usage?.prompt_tokens,
      completionTokens: response.data.usage?.completion_tokens
    });
    
    // Extract company verification information
    const responseContent = response.data.choices[0].message.content;
    
    // Log the raw response for debugging
    logInfo(`Perplexity raw response for "${sanitizedCompanyName}": ${responseContent.substring(0, 200)}`);
    
    // Check if company was found
    const notFoundPattern = /company not found|couldn't find|unable to find|no specific information|not enough information/i;
    if (notFoundPattern.test(responseContent)) {
      // Generate suggestions for misspelled or incorrect company names
      const suggestions = await generateCompanySuggestions(sanitizedCompanyName);
      
      const result = {
        exists: false,
        isRateLimited: false,
        suggestions: suggestions.length > 0 ? suggestions : undefined
      };
      
      // Cache the result
      cacheWithExpiry(cacheKey, result, COMPANY_INFO_CACHE_TIMEOUT);
      
      // Store in Supabase cache only if we have a client and the table exists
      if (!useInMemoryCacheOnly && supabaseClient) {
        try {
          console.log('[VERCEL DEBUG] Attempting to store in Supabase cache');
          const expiresAt = new Date(Date.now() + COMPANY_INFO_CACHE_TIMEOUT);
          
          const { data: upsertData, error: upsertError } = await supabaseClient
            .from(SUPABASE_CACHE_TABLE)
            .upsert({
              id: cacheKey,
              data: result,
              expires_at: expiresAt.toISOString()
            }, { onConflict: 'id' });
          
          if (upsertError) {
            console.error('[VERCEL DEBUG] Error storing in Supabase cache:', upsertError);
          } else {
            console.log('[VERCEL DEBUG] Successfully stored in Supabase cache');
          }
        } catch (storageError) {
          console.error('[VERCEL DEBUG] Exception storing in Supabase cache:', storageError);
          // Continue since we have the result even if caching fails
        }
      }
      
      return result;
    }
    
    // Improved extraction with clearer patterns
    // First try to extract based on the format we requested
    const nameMatch = responseContent.match(/Company Name:\s*([^\n]+)/i);
    const descriptionMatch = responseContent.match(/Description:\s*([^\n]+)/i);
    const industryMatch = responseContent.match(/Industry:\s*([^\n]+)/i);
    
    // Fallback to more general patterns if the specific format wasn't followed
    const fallbackNameMatch = !nameMatch ? responseContent.match(/^(.+?)(?:is|:|\n)/i) : null;
    const fallbackDescriptionMatch = !descriptionMatch ? responseContent.match(/(\b[A-Z][^\.]+?\.)/) : null;
    
    // Use the original search query if no match is found
    let extractedName = nameMatch?.[1]?.trim() || fallbackNameMatch?.[1]?.trim() || sanitizedCompanyName;
    
    // Apply proper capitalization to the company name if needed
    if (extractedName.toLowerCase() === extractedName) {
      extractedName = capitalizeCompanyName(extractedName);
    }
    
    // Construct result with fallbacks
    const result = {
      exists: true,
      fullName: extractedName,
      description: descriptionMatch?.[1]?.trim() || fallbackDescriptionMatch?.[1]?.trim(),
      industry: industryMatch?.[1]?.trim(),
      isRateLimited: false
    };
    
    // Cache the result
    cacheWithExpiry(cacheKey, result, COMPANY_INFO_CACHE_TIMEOUT);
    
    // Store in Supabase cache only if we have a client and the table exists
    if (!useInMemoryCacheOnly && supabaseClient) {
      try {
        console.log('[VERCEL DEBUG] Attempting to store in Supabase cache');
        const expiresAt = new Date(Date.now() + COMPANY_INFO_CACHE_TIMEOUT);
        
        const { data: upsertData, error: upsertError } = await supabaseClient
          .from(SUPABASE_CACHE_TABLE)
          .upsert({
            id: cacheKey,
            data: result,
            expires_at: expiresAt.toISOString()
          }, { onConflict: 'id' });
        
        if (upsertError) {
          console.error('[VERCEL DEBUG] Error storing in Supabase cache:', upsertError);
        } else {
          console.log('[VERCEL DEBUG] Successfully stored in Supabase cache');
        }
      } catch (storageError) {
        console.error('[VERCEL DEBUG] Exception storing in Supabase cache:', storageError);
        // Continue since we have the result even if caching fails
      }
    }
    
    return result;
    
  } catch (error) {
    logError('Error verifying company identity', error);
    
    // Return an error result
    return {
      exists: false,
      isRateLimited: false,
      description: 'Error verifying company. Please try again later.'
    };
  }
}

/**
 * Get company information from Perplexity API
 * 
 * This function fetches information about a company using real-time web search
 * via the Perplexity API, with caching to minimize API calls.
 * 
 * @param companyName Name of the company
 * @param options Optional settings
 * @returns Company information object
 */
export async function getCompanyInformation(
  companyName: string,
  options: {
    forceRefresh?: boolean;
    searchMode?: 'low' | 'medium' | 'high';
  } = {}
): Promise<CompanyInformation> {
  try {
    // Clean the input company name and properly capitalize
    const sanitizedCompanyName = sanitizeCompanyName(companyName);
    const displayName = capitalizeCompanyName(sanitizedCompanyName);
    
    // Log the company name transformation
    if (displayName !== sanitizedCompanyName) {
      logInfo(`Company name standardized from "${sanitizedCompanyName}" to "${displayName}"`);
    }
    
    // Check if Perplexity is enabled
    if (!isPerplexityEnabled()) {
      logError('Perplexity API is disabled by configuration', new Error('USE_PERPLEXITY is not set to true'));
      return { 
        companyInfo: 'Perplexity API is disabled. Please enable it in the configuration.',
        citations: [],
        lastUpdated: new Date(),
        isRateLimited: true
      };
    }

    // Check if we should only allow company research
    if (isCompanyResearchOnly() && !displayName.trim()) {
      return {
        companyInfo: 'Company name is required for research.',
        citations: [],
        lastUpdated: new Date(),
        isRateLimited: false
      };
    }

    // First check if we have a valid API key
    if (!API_KEY) {
      logError('Perplexity API key is missing', new Error('PERPLEXITY_API_KEY environment variable is not set'));
      return { 
        companyInfo: 'API key configuration error. Please contact support.',
        citations: [],
        lastUpdated: new Date(),
        isRateLimited: true
      };
    }

    // Generate cache key using display name to ensure proper caching
    const cacheKey = `company_info_${encodeURIComponent(displayName.toLowerCase().trim())}`;
    
    // Skip cache if forceRefresh is true
    if (!options.forceRefresh) {
      // Try to get from in-memory cache first
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        logPerplexityUsage('getCompanyInformation.cacheHit', { companyName: displayName });
        return cachedData as CompanyInformation;
      }
      
      // Try to get from Supabase cache
      const supabaseForRetrieval = createServiceClient();
      if (!supabaseForRetrieval) {
        logError('Failed to create Supabase client for retrieving company cache');
        // Return a minimal result that indicates we couldn't fetch
        return {
          companyInfo: 'Database connection error',
          citations: [],
          lastUpdated: new Date(),
          isRateLimited: true
        };
      }
      const { data: supabaseCache, error: supabaseError } = await supabaseForRetrieval
        .from(SUPABASE_CACHE_TABLE)
        .select('*')
        .eq('id', cacheKey)
        .single();
      
      if (!supabaseError && supabaseCache && new Date(supabaseCache.expires_at) > new Date()) {
        // Cache the data in memory too
        cacheWithExpiry(cacheKey, supabaseCache.data, 
          new Date(supabaseCache.expires_at).getTime() - Date.now());
        
        logPerplexityUsage('getCompanyInformation.supabaseCacheHit', { companyName: displayName });
        return supabaseCache.data as CompanyInformation;
      }
    }

    // Create an improved prompt for company information that emphasizes getting information
    // specifically about the requested company
    const prompt = `I need a comprehensive business profile specifically about ${displayName}. Please provide information ONLY about ${displayName} and no other company. Include:

1. What they do and what industry they're in
2. Company size and employee count
3. Location and where they operate
4. Their target customers or market
5. Any recent news or developments
6. Any challenges or pain points they might have in HR, hiring, or staff management

Format the information in clear sections and be factual. If you can't find reliable information about ${displayName} specifically, please state that clearly rather than providing information about a different company.`;

    // Prepare API request
    const searchMode = options.searchMode || 'low';  // Default to low to minimize costs
    const response = await axios.post(
      API_URL,
      {
        model: "sonar",
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        search_context_size: searchMode
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Track API usage
    logPerplexityUsage('getCompanyInformation.apiCall', { 
      companyName: displayName, 
      searchMode,
      promptTokens: response.data.usage?.prompt_tokens,
      completionTokens: response.data.usage?.completion_tokens
    });
    
    // Extract company information
    const companyInfo = response.data.choices[0].message.content;
    const citations = response.data.citations || [];
    
    // Extract structured data 
    // This is a simple regex-based extraction - could be enhanced with more robust parsing
    const industryMatch = companyInfo.match(/industry:?\s*([^\.]+)/i);
    const sizeMatch = companyInfo.match(/size:?\s*([^\.]+)/i) || companyInfo.match(/employees:?\s*([^\.]+)/i);
    const locationMatch = companyInfo.match(/location:?\s*([^\.]+)/i) || companyInfo.match(/headquarters:?\s*([^\.]+)/i);
    const websiteMatch = companyInfo.match(/website:?\s*([^\.]+)/i) || companyInfo.match(/URL:?\s*([^\.]+)/i);
    const foundedMatch = companyInfo.match(/founded:?\s*([^\.]+)/i) || companyInfo.match(/established:?\s*([^\.]+)/i);
    
    // Construct result object
    const result: CompanyInformation = {
      companyInfo,
      industry: industryMatch?.[1]?.trim(),
      size: sizeMatch?.[1]?.trim(),
      location: locationMatch?.[1]?.trim(),
      website: websiteMatch?.[1]?.trim(),
      founded: foundedMatch?.[1]?.trim(),
      citations,
      lastUpdated: new Date(),
      isRateLimited: false
    };
    
    // Cache the result
    cacheWithExpiry(cacheKey, result, COMPANY_INFO_CACHE_TIMEOUT);
    
    // Store in Supabase cache only if we have a client and the table exists
    const supabaseClient = createServiceClient();
    if (supabaseClient) {
      try {
        console.log('[VERCEL DEBUG] Attempting to store in Supabase cache');
        const expiresAt = new Date(Date.now() + COMPANY_INFO_CACHE_TIMEOUT);
        
        const { data: upsertData, error: upsertError } = await supabaseClient
          .from(SUPABASE_CACHE_TABLE)
          .upsert({
            id: cacheKey,
            data: result,
            expires_at: expiresAt.toISOString()
          }, { onConflict: 'id' });
        
        if (upsertError) {
          console.error('[VERCEL DEBUG] Error storing in Supabase cache:', upsertError);
        } else {
          console.log('[VERCEL DEBUG] Successfully stored in Supabase cache');
        }
      } catch (storageError) {
        console.error('[VERCEL DEBUG] Exception storing in Supabase cache:', storageError);
        // Continue since we have the result even if caching fails
      }
    }
    
    return result;
    
  } catch (error) {
    logError('Error fetching company information', error);
    
    // Return a minimal result with the error
    return {
      companyInfo: `Error: Unable to fetch information about ${companyName}. Please try again later.`,
      citations: [],
      lastUpdated: new Date(),
      isRateLimited: false
    };
  }
} 
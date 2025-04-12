/**
 * Perplexity API Client
 * 
 * A lightweight client for the Perplexity API that provides real-time web search
 * capability to fetch information about companies.
 */

import axios from 'axios';
import { logError } from './logger';
import { cacheWithExpiry, getFromCache, logPerplexityUsage } from './perplexityUtils';
import { createServiceClient } from './supabaseClient';

// API constants - Load from environment variables
const API_KEY = process.env.PERPLEXITY_API_KEY || '';
const API_URL = 'https://api.perplexity.ai/chat/completions';

// Cache settings
const CACHE_HOURS = parseInt(process.env.PERPLEXITY_CACHE_HOURS || '24', 10);
const COMPANY_INFO_CACHE_TIMEOUT = CACHE_HOURS * 60 * 60 * 1000; // Convert hours to milliseconds
const SUPABASE_CACHE_TABLE = 'company_information_cache';

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

// Type definitions for Supabase cache
interface CompanyCache {
  id: string; // company name (URL encoded)
  data: CompanyInformation;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

/**
 * Verify if a company exists and get the correct company name
 * 
 * @param companyName Name of the company to verify
 * @returns Verification result with company details
 */
export async function verifyCompanyIdentity(
  companyName: string
): Promise<{
  exists: boolean;
  fullName?: string;
  description?: string;
  industry?: string;
  isRateLimited: boolean;
}> {
  try {
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

    // Generate cache key
    const cacheKey = `company_verify_${encodeURIComponent(companyName.toLowerCase().trim())}`;
    
    // Try to get from in-memory cache first
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      logPerplexityUsage('verifyCompanyIdentity.cacheHit', { companyName });
      return cachedData as {
        exists: boolean;
        fullName?: string;
        description?: string;
        industry?: string;
        isRateLimited: boolean;
      };
    }
    
    // Try to get from Supabase cache
    const supabase = createServiceClient();
    const { data: supabaseCache, error: supabaseError } = await supabase
      .from(SUPABASE_CACHE_TABLE)
      .select('*')
      .eq('id', cacheKey)
      .single();
    
    if (!supabaseError && supabaseCache && new Date(supabaseCache.expires_at) > new Date()) {
      // Cache the data in memory too
      cacheWithExpiry(cacheKey, supabaseCache.data, 
        new Date(supabaseCache.expires_at).getTime() - Date.now());
      
      logPerplexityUsage('verifyCompanyIdentity.supabaseCacheHit', { companyName });
      return supabaseCache.data as {
        exists: boolean;
        fullName?: string;
        description?: string;
        industry?: string;
        isRateLimited: boolean;
      };
    }

    // Create a verification prompt
    const prompt = `Verify if the company "${companyName}" exists. If it does, provide this exact information in a concise format:
1. The full and correct company name
2. A one-sentence description
3. Industry/sector

If the company doesn't exist or is not a real business, respond with "Company not found."
Keep your response brief and factual.`;

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
    
    // Check if company was found
    const notFoundPattern = /company not found|couldn't find|unable to find|no specific information|not enough information/i;
    if (notFoundPattern.test(responseContent)) {
      const result = {
        exists: false,
        isRateLimited: false
      };
      
      // Cache the result
      cacheWithExpiry(cacheKey, result, COMPANY_INFO_CACHE_TIMEOUT);
      
      // Store in Supabase cache
      const expiresAt = new Date(Date.now() + COMPANY_INFO_CACHE_TIMEOUT);
      await supabase
        .from(SUPABASE_CACHE_TABLE)
        .upsert({
          id: cacheKey,
          data: result,
          expires_at: expiresAt.toISOString()
        }, { onConflict: 'id' });
      
      return result;
    }
    
    // Extract structured data (simple regex extraction)
    const nameMatch = responseContent.match(/^(.+?)(?:is|:|\n)/i);
    const descriptionMatch = responseContent.match(/description:?\s*([^\.]+)/i) || 
      responseContent.match(/(\b[A-Z][^\.]+?\.)/);
    const industryMatch = responseContent.match(/industry:?\s*([^\.]+)/i) || 
      responseContent.match(/sector:?\s*([^\.]+)/i);
    
    // Construct result
    const result = {
      exists: true,
      fullName: nameMatch?.[1]?.trim() || companyName,
      description: descriptionMatch?.[1]?.trim(),
      industry: industryMatch?.[1]?.trim(),
      isRateLimited: false
    };
    
    // Cache the result
    cacheWithExpiry(cacheKey, result, COMPANY_INFO_CACHE_TIMEOUT);
    
    // Store in Supabase cache
    const expiresAt = new Date(Date.now() + COMPANY_INFO_CACHE_TIMEOUT);
    await supabase
      .from(SUPABASE_CACHE_TABLE)
      .upsert({
        id: cacheKey,
        data: result,
        expires_at: expiresAt.toISOString()
      }, { onConflict: 'id' });
    
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
    if (isCompanyResearchOnly() && !companyName.trim()) {
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

    // Generate cache key
    const cacheKey = `company_info_${encodeURIComponent(companyName.toLowerCase().trim())}`;
    
    // Skip cache if forceRefresh is true
    if (!options.forceRefresh) {
      // Try to get from in-memory cache first
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        logPerplexityUsage('getCompanyInformation.cacheHit', { companyName });
        return cachedData as CompanyInformation;
      }
      
      // Try to get from Supabase cache
      const supabase = createServiceClient();
      const { data: supabaseCache, error: supabaseError } = await supabase
        .from(SUPABASE_CACHE_TABLE)
        .select('*')
        .eq('id', cacheKey)
        .single();
      
      if (!supabaseError && supabaseCache && new Date(supabaseCache.expires_at) > new Date()) {
        // Cache the data in memory too
        cacheWithExpiry(cacheKey, supabaseCache.data, 
          new Date(supabaseCache.expires_at).getTime() - Date.now());
        
        logPerplexityUsage('getCompanyInformation.supabaseCacheHit', { companyName });
        return supabaseCache.data as CompanyInformation;
      }
    }

    // Create a comprehensive prompt to get company information
    const prompt = `I need a comprehensive business profile about the company "${companyName}". Please include:
1. What they do and what industry they're in
2. Company size and employee count
3. Location and where they operate
4. Their target customers or market
5. Any recent news or developments
6. Any challenges or pain points they might have in HR, hiring, or staff management

Format the information in clear sections and be factual. If you can't find reliable information, please state that clearly rather than speculating.`;

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
      companyName, 
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
    
    // Store in Supabase cache
    const supabase = createServiceClient();
    const expiresAt = new Date(Date.now() + COMPANY_INFO_CACHE_TIMEOUT);
    await supabase
      .from(SUPABASE_CACHE_TABLE)
      .upsert({
        id: cacheKey,
        data: result,
        expires_at: expiresAt.toISOString()
      }, { onConflict: 'id' });
    
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
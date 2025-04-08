/**
 * Perplexity API Client
 * 
 * A lightweight client for the Perplexity API that provides real-time web search
 * capability to fetch information about companies.
 */

import axios from 'axios';
import { logError } from './errorHandling';
import { cacheWithExpiry, getFromCache, logPerplexityUsage } from './perplexityUtils';

// API constants
const API_KEY = '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';
const API_URL = 'https://api.perplexity.ai/chat/completions';

// Cache settings
const COMPANY_INFO_CACHE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_CALLS_PER_WINDOW = 10; // Maximum API calls per window

// Rate limiting state
let apiCallsInWindow = 0;
let windowStartTime = Date.now();

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

export interface CompanyIdentity {
  exists: boolean;
  fullName?: string;
  description?: string;
  industry?: string;
  isRateLimited: boolean;
}

// Reset rate limit counter
function checkAndResetRateLimit() {
  const now = Date.now();
  if (now - windowStartTime > RATE_LIMIT_WINDOW) {
    apiCallsInWindow = 0;
    windowStartTime = now;
    return true;
  }
  return apiCallsInWindow < MAX_CALLS_PER_WINDOW;
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
    const cacheKey = `company_info_${companyName.toLowerCase().trim().replace(/\s+/g, '_')}`;
    
    // Check cache first unless force refresh is requested
    if (!options.forceRefresh) {
      const cachedInfo = getFromCache<CompanyInformation>(cacheKey);
      if (cachedInfo) {
        logPerplexityUsage('getCompanyInformation.cache', { companyName, fromCache: true });
        return {
          ...cachedInfo,
          isRateLimited: false
        };
      }
    }
    
    // Check rate limiting
    if (!checkAndResetRateLimit()) {
      logPerplexityUsage('getCompanyInformation.rateLimit', { 
        companyName, 
        apiCallsInWindow,
        windowStartTime
      });
      
      return {
        companyInfo: `Rate limit reached. Unable to fetch fresh information about ${companyName} at this time.`,
        citations: [],
        lastUpdated: new Date(),
        isRateLimited: true
      };
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
    
    // Increment API call counter
    apiCallsInWindow++;
    logPerplexityUsage('getCompanyInformation.apiCall', { 
      companyName, 
      searchMode,
      apiCallsInWindow,
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
    
    const result: CompanyInformation = {
      companyInfo,
      industry: industryMatch ? industryMatch[1].trim() : undefined,
      size: sizeMatch ? sizeMatch[1].trim() : undefined,
      location: locationMatch ? locationMatch[1].trim() : undefined,
      website: websiteMatch ? websiteMatch[1].trim() : undefined,
      founded: foundedMatch ? foundedMatch[1].trim() : undefined,
      citations,
      lastUpdated: new Date(),
      isRateLimited: false
    };
    
    // Cache the result
    cacheWithExpiry(cacheKey, result, COMPANY_INFO_CACHE_TIMEOUT);
    
    return result;
  } catch (error) {
    logPerplexityUsage('getCompanyInformation.error', { companyName }, error);
    
    return {
      companyInfo: `Unable to fetch information about ${companyName}. Please try again later.`,
      citations: [],
      lastUpdated: new Date(),
      isRateLimited: false
    };
  }
}

/**
 * Verify if a company exists and get basic identification
 * 
 * This provides a lighter-weight API call to confirm company identity
 * before fetching full details.
 * 
 * @param companyName Name to verify
 * @returns Company verification object
 */
export async function verifyCompanyIdentity(
  companyName: string
): Promise<CompanyIdentity> {
  try {
    const cacheKey = `company_verify_${companyName.toLowerCase().trim().replace(/\s+/g, '_')}`;
    
    // Check cache first
    const cachedInfo = getFromCache<CompanyIdentity>(cacheKey);
    if (cachedInfo) {
      logPerplexityUsage('verifyCompanyIdentity.cache', { companyName, fromCache: true });
      return {
        ...cachedInfo,
        isRateLimited: false
      };
    }
    
    // Check rate limiting
    if (!checkAndResetRateLimit()) {
      logPerplexityUsage('verifyCompanyIdentity.rateLimit', { 
        companyName, 
        apiCallsInWindow,
        windowStartTime
      });
      
      return {
        exists: false,
        isRateLimited: true
      };
    }
    
    // Create a focused prompt just to verify existence and basic info
    const prompt = `I need to verify if a company named "${companyName}" exists. If it does, provide only:
1. The company's full official name
2. A one-sentence description of what they do
3. Their primary industry
Do not provide any other information. If you can't find specific information about this company, respond with "Company not found" or if you find multiple distinct companies with this name, list the top 2-3 options.`;

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
    
    // Increment API call counter
    apiCallsInWindow++;
    logPerplexityUsage('verifyCompanyIdentity.apiCall', { 
      companyName,
      apiCallsInWindow,
      promptTokens: response.data.usage?.prompt_tokens,
      completionTokens: response.data.usage?.completion_tokens
    });
    
    // Extract company verification information
    const responseContent = response.data.choices[0].message.content;
    
    // Check if company was found
    const notFoundPattern = /company not found|couldn't find|unable to find|no specific information|not enough information/i;
    if (notFoundPattern.test(responseContent)) {
      const result: CompanyIdentity = {
        exists: false,
        isRateLimited: false
      };
      cacheWithExpiry(cacheKey, result, COMPANY_INFO_CACHE_TIMEOUT);
      return result;
    }
    
    // Extract structured data (simple regex extraction)
    const nameMatch = responseContent.match(/^(.+?)(?:is|:|\n)/i);
    const descriptionMatch = responseContent.match(/description:?\s*([^\.]+)/i) || 
                           responseContent.match(/(\b[A-Z][^\.]+?\.)/);
    const industryMatch = responseContent.match(/industry:?\s*([^\.]+)/i) || 
                         responseContent.match(/sector:?\s*([^\.]+)/i);
    
    const result: CompanyIdentity = {
      exists: true,
      fullName: nameMatch ? nameMatch[1].trim() : companyName,
      description: descriptionMatch ? descriptionMatch[1].trim() : undefined,
      industry: industryMatch ? industryMatch[1].trim() : undefined,
      isRateLimited: false
    };
    
    // Cache the result
    cacheWithExpiry(cacheKey, result, COMPANY_INFO_CACHE_TIMEOUT);
    
    return result;
  } catch (error) {
    logPerplexityUsage('verifyCompanyIdentity.error', { companyName }, error);
    
    return {
      exists: false,
      isRateLimited: false
    };
  }
} 
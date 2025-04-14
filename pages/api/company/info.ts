import type { NextApiRequest, NextApiResponse } from 'next';
import { getCompanyInformation } from '@/utils/perplexityClient';
import { logInfo, logWarning } from '@/utils/logger';

// Feature flag check functions
function isPerplexityEnabled(): boolean {
  return process.env.USE_PERPLEXITY === 'true';
}

function isCompanyResearchOnly(): boolean {
  return process.env.PERPLEXITY_COMPANY_RESEARCH_ONLY === 'true';
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
 * API endpoint to get detailed company information
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are allowed' });
  }

  try {
    // Check if Perplexity is enabled
    if (!isPerplexityEnabled()) {
      return res.status(400).json({ 
        error: 'Perplexity API is disabled',
        message: 'The Perplexity API is currently disabled in the configuration'
      });
    }

    const { companyName, options = {} } = req.body;
    
    if (!companyName || typeof companyName !== 'string') {
      return res.status(400).json({ error: 'Company name is required' });
    }
    
    // Clean the company name before using it
    const sanitizedCompanyName = sanitizeCompanyName(companyName);
    
    if (sanitizedCompanyName !== companyName) {
      logInfo(`Company name sanitized from "${companyName}" to "${sanitizedCompanyName}"`);
    }
    
    // Check if we should only allow this API for company chat
    if (isCompanyResearchOnly()) {
      // Check if the request is coming from the company chat
      const referer = req.headers.referer || '';
      if (!referer.includes('/company-chat')) {
        // Only log this as a warning but still allow the request for now
        console.warn(`Company info API accessed from non-company page: ${referer}`);
      }
    }
    
    // Get detailed company information
    const companyInfo = await getCompanyInformation(sanitizedCompanyName, options);
    
    // Handle rate limiting
    if (companyInfo.isRateLimited) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.',
        isRateLimited: true 
      });
    }
    
    return res.status(200).json(companyInfo);
    
  } catch (error) {
    console.error('Error fetching company information:', error);
    return res.status(500).json({ error: 'Failed to fetch company information' });
  }
} 
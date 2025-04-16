import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyCompanyIdentity } from '@/utils/perplexityClient';
import { logInfo, logError } from '@/utils/logger';
import { testVercelSupabaseConnection, checkCacheTableExists } from '@/utils/vercelSupabaseClient';

// Feature flag check functions
function isPerplexityEnabled(): boolean {
  const enabled = process.env.USE_PERPLEXITY === 'true';
  console.log(`[VERCEL DEBUG] Perplexity enabled: ${enabled} (USE_PERPLEXITY=${process.env.USE_PERPLEXITY})`);
  return enabled;
}

function isCompanyResearchOnly(): boolean {
  const researchOnly = process.env.PERPLEXITY_COMPANY_RESEARCH_ONLY === 'true';
  console.log(`[VERCEL DEBUG] Company research only: ${researchOnly}`);
  return researchOnly;
}

type VerifyResponse = {
  exists: boolean;
  fullName?: string;
  suggestions?: Array<{name: string, confidence: number}>;
  error?: string;
  message?: string;
  isRateLimited?: boolean;
};

/**
 * API endpoint to verify a company's existence and get basic details
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VerifyResponse>
) {
  // Log every request for debugging
  console.log(`[VERCEL DEBUG] Company verify API called: ${new Date().toISOString()}`);
  console.log(`[VERCEL DEBUG] Request method: ${req.method}`);
  console.log(`[VERCEL DEBUG] Request headers: ${JSON.stringify(req.headers)}`);
  console.log(`[VERCEL DEBUG] Environment: VERCEL=${process.env.VERCEL}, NODE_ENV=${process.env.NODE_ENV}`);
  
  // Check API key for debugging (masking most of it)
  const apiKey = process.env.PERPLEXITY_API_KEY || '';
  console.log(`[VERCEL DEBUG] Perplexity API key set: ${!!apiKey} (starts with: ${apiKey.substring(0, 5)}...)`);

  // Test Supabase connectivity
  console.log(`[VERCEL DEBUG] Testing Supabase connectivity...`);
  const supabaseConnected = await testVercelSupabaseConnection();
  console.log(`[VERCEL DEBUG] Supabase connection test result: ${supabaseConnected}`);
  
  // Check if cache table exists
  console.log(`[VERCEL DEBUG] Checking if cache table exists...`);
  const cacheTableExists = await checkCacheTableExists();
  console.log(`[VERCEL DEBUG] Cache table exists: ${cacheTableExists}`);
  
  // Check if method is POST
  if (req.method !== 'POST') {
    console.log(`[VERCEL DEBUG] Method not allowed: ${req.method}`);
    return res.status(405).json({ 
      exists: false,
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    // Check if Perplexity is enabled
    if (!isPerplexityEnabled()) {
      console.log('[VERCEL DEBUG] Perplexity API is disabled');
      return res.status(400).json({ 
        exists: false,
        error: 'Perplexity API is disabled',
        message: 'The Perplexity API is currently disabled in the configuration'
      });
    }

    console.log(`[VERCEL DEBUG] Request body: ${JSON.stringify(req.body)}`);
    const { companyName } = req.body;
    
    // Check if company name is valid
    if (!companyName || typeof companyName !== 'string' || companyName.trim() === '') {
      console.log(`[VERCEL DEBUG] Invalid company name: ${companyName}`);
      return res.status(400).json({ 
        exists: false,
        error: 'Bad request',
        message: 'Company name is required'
      });
    }
    
    console.log(`[VERCEL DEBUG] Company name: "${companyName}"`);
    
    // Check if we should only allow this API for company chat
    if (isCompanyResearchOnly()) {
      // Check if the request is coming from the company chat
      const referer = req.headers.referer || '';
      console.log(`[VERCEL DEBUG] Request referer: ${referer}`);
      if (!referer.includes('/company-chat')) {
        // Only log this as a warning but still allow the request for now
        console.warn(`Company verify API accessed from non-company page: ${referer}`);
      }
    }
    
    // Before verification attempt
    console.log(`[VERCEL DEBUG] About to verify company: "${companyName}"`);
    
    try {
      // Use the Supabase connection info to set a config flag
      // This will make the perplexityClient use in-memory caching only if table doesn't exist
      // @ts-ignore - We're adding a property to the request object for internal use
      req.supabaseInfo = {
        connected: supabaseConnected,
        cacheTableExists: cacheTableExists
      };
      
      // Verify the company exists with additional error handling
      const result = await verifyCompanyIdentity(companyName, {
        useInMemoryCacheOnly: !cacheTableExists
      });
      
      console.log(`[VERCEL DEBUG] Verification result: ${JSON.stringify(result)}`);
      
      // Handle rate limiting
      if (result.isRateLimited) {
        console.log('[VERCEL DEBUG] Rate limit exceeded');
        return res.status(429).json({ 
          exists: false,
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          isRateLimited: true
        });
      }
      
      if (result.exists) {
        console.log(`[VERCEL DEBUG] Company exists: ${result.fullName}`);
        return res.status(200).json({
          exists: true,
          fullName: result.fullName
        });
      } else {
        // Return suggestions if available
        console.log(`[VERCEL DEBUG] Company does not exist. Suggestions: ${JSON.stringify(result.suggestions)}`);
        return res.status(200).json({
          exists: false,
          suggestions: result.suggestions || []
        });
      }
    } catch (verifyError) {
      console.error('[VERCEL DEBUG] Error in verifyCompanyIdentity:', verifyError);
      throw verifyError; // Rethrow to be caught by outer catch
    }
  } catch (error) {
    console.error('[VERCEL DEBUG] Error verifying company:', error);
    if (error instanceof Error) {
      console.error('[VERCEL DEBUG] Error message:', error.message);
      console.error('[VERCEL DEBUG] Error stack:', error.stack);
    }
    return res.status(500).json({ 
      exists: false, 
      error: 'Failed to verify company',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
} 
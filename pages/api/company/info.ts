import type { NextApiRequest, NextApiResponse } from 'next';
import { getCompanyInformation } from '@/utils/perplexityClient';

/**
 * API endpoint to get detailed company information
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are allowed' });
  }

  try {
    const { companyName, options = {} } = req.body;
    
    if (!companyName || typeof companyName !== 'string') {
      return res.status(400).json({ error: 'Company name is required' });
    }
    
    // Get detailed company information
    const companyInfo = await getCompanyInformation(companyName, options);
    
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
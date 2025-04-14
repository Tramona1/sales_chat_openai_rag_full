import { verifyCompanyIdentity } from '@/utils/perplexityClient';
// Feature flag check functions
function isPerplexityEnabled() {
    return process.env.USE_PERPLEXITY === 'true';
}
function isCompanyResearchOnly() {
    return process.env.PERPLEXITY_COMPANY_RESEARCH_ONLY === 'true';
}
/**
 * API endpoint to verify a company's existence and get basic details
 */
export default async function handler(req, res) {
    // Check if method is POST
    if (req.method !== 'POST') {
        return res.status(405).json({
            exists: false,
            error: 'Method not allowed',
            message: 'Only POST requests are allowed'
        });
    }
    try {
        // Check if Perplexity is enabled
        if (!isPerplexityEnabled()) {
            return res.status(400).json({
                exists: false,
                error: 'Perplexity API is disabled',
                message: 'The Perplexity API is currently disabled in the configuration'
            });
        }
        const { companyName } = req.body;
        // Check if company name is valid
        if (!companyName || typeof companyName !== 'string' || companyName.trim() === '') {
            return res.status(400).json({
                exists: false,
                error: 'Bad request',
                message: 'Company name is required'
            });
        }
        // Check if we should only allow this API for company chat
        if (isCompanyResearchOnly()) {
            // Check if the request is coming from the company chat
            const referer = req.headers.referer || '';
            if (!referer.includes('/company-chat')) {
                // Only log this as a warning but still allow the request for now
                console.warn(`Company verify API accessed from non-company page: ${referer}`);
            }
        }
        // Verify the company exists
        const result = await verifyCompanyIdentity(companyName);
        // Handle rate limiting
        if (result.isRateLimited) {
            return res.status(429).json({
                exists: false,
                error: 'Too Many Requests',
                message: 'Rate limit exceeded',
                isRateLimited: true
            });
        }
        if (result.exists) {
            return res.status(200).json({
                exists: true,
                fullName: result.fullName
            });
        }
        else {
            // Return suggestions if available
            return res.status(200).json({
                exists: false,
                suggestions: result.suggestions || []
            });
        }
    }
    catch (error) {
        console.error('Error verifying company:', error);
        return res.status(500).json({ exists: false, error: 'Failed to verify company' });
    }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const perplexityClient_1 = require("@/utils/perplexityClient");
/**
 * API endpoint to get detailed company information
 */
async function handler(req, res) {
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
        const companyInfo = await (0, perplexityClient_1.getCompanyInformation)(companyName, options);
        // Handle rate limiting
        if (companyInfo.isRateLimited) {
            return res.status(429).json({
                error: 'Rate limit exceeded. Please try again later.',
                isRateLimited: true
            });
        }
        return res.status(200).json(companyInfo);
    }
    catch (error) {
        console.error('Error fetching company information:', error);
        return res.status(500).json({ error: 'Failed to fetch company information' });
    }
}

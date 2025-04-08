"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const perplexityClient_1 = require("@/utils/perplexityClient");
/**
 * API endpoint to verify a company's existence and get basic details
 */
async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are allowed' });
    }
    try {
        const { companyName } = req.body;
        if (!companyName || typeof companyName !== 'string') {
            return res.status(400).json({ error: 'Company name is required' });
        }
        // Verify the company exists
        const companyIdentity = await (0, perplexityClient_1.verifyCompanyIdentity)(companyName);
        // Handle rate limiting
        if (companyIdentity.isRateLimited) {
            return res.status(429).json({
                error: 'Rate limit exceeded. Please try again later.',
                isRateLimited: true
            });
        }
        return res.status(200).json(companyIdentity);
    }
    catch (error) {
        console.error('Error verifying company:', error);
        return res.status(500).json({ error: 'Failed to verify company' });
    }
}

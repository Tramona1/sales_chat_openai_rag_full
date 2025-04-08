"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const feedbackManager_1 = require("@/utils/feedbackManager");
const errorHandling_1 = require("@/utils/errorHandling");
const axios_1 = __importDefault(require("axios"));
/**
 * API endpoint to record user feedback on assistant responses
 */
async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are allowed' });
    }
    try {
        const body = req.body;
        // Validate required fields
        if (!body.query || !body.response || !body.feedback || body.messageIndex === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Validate feedback type
        if (body.feedback !== 'positive' && body.feedback !== 'negative') {
            return res.status(400).json({ error: 'Invalid feedback type. Must be "positive" or "negative"' });
        }
        // Extract topics from the query
        const queryTopics = (0, feedbackManager_1.extractTopics)(body.query);
        // Process metadata
        const metadata = {
            ...(body.metadata || {}),
            sessionType: body.sessionId ? 'company' : 'general',
            timestamp: new Date().toISOString(),
        };
        // Add sessionId to metadata if available
        if (body.sessionId) {
            metadata.sessionId = body.sessionId;
        }
        // Prepare the feedback payload
        const feedbackPayload = {
            query: body.query,
            response: body.response,
            feedback: body.feedback,
            messageIndex: body.messageIndex,
            queryTopics,
            sessionId: body.sessionId,
            userId: body.userId,
            metadata
        };
        // Use our admin API to store the feedback
        // In production you'd want to use a more secure method than accessing another API route directly
        const adminKey = process.env.ADMIN_API_KEY || 'dev-key';
        // Fix URL formation - use server-side URL construction since this is an API route
        // Get host from request headers
        const host = req.headers.host || 'localhost:3000';
        const protocol = host.startsWith('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;
        const response = await axios_1.default.post(`${baseUrl}/api/admin/feedback`, feedbackPayload, {
            headers: {
                'x-admin-key': adminKey
            }
        });
        return res.status(200).json({
            success: true,
            id: response.data.id
        });
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error recording feedback', error);
        return res.status(500).json({ error: 'Failed to record feedback' });
    }
}

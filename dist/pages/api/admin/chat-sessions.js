"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const chatStorage_1 = require("@/utils/chatStorage");
const errorHandling_1 = require("@/utils/errorHandling");
// Simple authorization check for admin routes
// In a production app, this would use proper authentication
function isAuthorized(req) {
    // For now, we'll just check for an admin key in the header
    // In a real app, this would use a proper auth system
    const adminKey = req.headers['x-admin-key'];
    return adminKey === process.env.ADMIN_API_KEY || process.env.NODE_ENV === 'development';
}
async function handler(req, res) {
    // Handle different HTTP methods
    switch (req.method) {
        case 'GET':
            return handleGetRequest(req, res);
        case 'POST':
            return handlePostRequest(req, res);
        case 'PUT':
            return handlePutRequest(req, res);
        case 'DELETE':
            return handleDeleteRequest(req, res);
        default:
            return res.status(405).json({ error: 'Method Not Allowed' });
    }
}
async function handleGetRequest(req, res) {
    try {
        // Check authorization
        if (!isAuthorized(req)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id, search, type, content } = req.query;
        // If session ID is provided, get that specific session
        if (id) {
            const session = await (0, chatStorage_1.getChatSession)(id);
            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }
            return res.status(200).json(session);
        }
        // If content search is provided, search sessions by content
        if (content) {
            const sessions = await (0, chatStorage_1.searchChatSessionsByContent)(content);
            return res.status(200).json({ sessions });
        }
        // If search query is provided, search sessions
        if (search) {
            const sessions = await (0, chatStorage_1.searchChatSessions)(search);
            // Filter by session type if provided
            if (type) {
                const filteredSessions = sessions.filter(s => s.sessionType === type);
                return res.status(200).json({ sessions: filteredSessions });
            }
            return res.status(200).json({ sessions });
        }
        // Otherwise, list all sessions, possibly filtered by type
        let sessions = await (0, chatStorage_1.listChatSessions)();
        // Filter by session type if provided
        if (type) {
            sessions = sessions.filter(s => s.sessionType === type);
        }
        return res.status(200).json({ sessions });
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error in chat sessions API', error);
        return res.status(500).json({ error: 'Failed to process request' });
    }
}
async function handlePostRequest(req, res) {
    try {
        // Check authorization
        if (!isAuthorized(req)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const body = req.body;
        // Validate required fields
        if (!body.messages || !Array.isArray(body.messages)) {
            return res.status(400).json({
                error: 'Missing required fields: messages'
            });
        }
        // In company mode, companyName and companyInfo are required
        if (body.sessionType === 'company' && (!body.companyName || !body.companyInfo)) {
            return res.status(400).json({
                error: 'For company sessions, companyName and companyInfo are required'
            });
        }
        // For general sessions, title is required
        if (body.sessionType === 'general' && !body.title) {
            return res.status(400).json({
                error: 'For general sessions, title is required'
            });
        }
        // Save the session
        const sessionId = await (0, chatStorage_1.saveChatSession)({
            sessionType: body.sessionType,
            title: body.title || body.companyName || 'Untitled Session',
            companyName: body.companyName,
            companyInfo: body.companyInfo,
            salesNotes: body.salesNotes || '',
            messages: body.messages,
            salesRepId: body.salesRepId,
            salesRepName: body.salesRepName,
            tags: body.tags,
            keywords: body.keywords
        });
        return res.status(200).json({ success: true, sessionId });
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error in chat sessions API', error);
        return res.status(500).json({ error: 'Failed to save chat session' });
    }
}
/**
 * Handle PUT requests to update chat sessions
 */
async function handlePutRequest(req, res) {
    try {
        // Check authorization
        if (!isAuthorized(req)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Extract the session ID from the URL path
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ error: 'Session ID is required' });
        }
        const body = req.body;
        // Validate required fields
        if (!body.companyName || !body.companyInfo || !Array.isArray(body.messages)) {
            return res.status(400).json({
                error: 'Missing required fields: companyName, companyInfo, messages'
            });
        }
        // Update the session
        const success = await (0, chatStorage_1.updateChatSession)(id, {
            companyName: body.companyName,
            companyInfo: body.companyInfo,
            salesNotes: body.salesNotes || '',
            messages: body.messages,
            salesRepId: body.salesRepId,
            salesRepName: body.salesRepName,
            tags: body.tags
        });
        if (!success) {
            return res.status(404).json({ error: 'Session not found or update failed' });
        }
        return res.status(200).json({ success: true });
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error updating chat session', error);
        return res.status(500).json({ error: 'Failed to update chat session' });
    }
}
async function handleDeleteRequest(req, res) {
    try {
        // Check authorization
        if (!isAuthorized(req)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ error: 'Session ID is required' });
        }
        const success = await (0, chatStorage_1.deleteChatSession)(id);
        if (!success) {
            return res.status(404).json({ error: 'Failed to delete session' });
        }
        return res.status(200).json({ success: true });
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error in chat sessions API', error);
        return res.status(500).json({ error: 'Failed to delete chat session' });
    }
}

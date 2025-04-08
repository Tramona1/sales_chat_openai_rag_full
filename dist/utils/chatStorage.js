"use strict";
/**
 * Chat Storage Utility
 *
 * Manages persistent storage of chat sessions, including:
 * - Company information (for company chat)
 * - General chat sessions
 * - Sales rep notes
 * - Chat history
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveChatSession = saveChatSession;
exports.listChatSessions = listChatSessions;
exports.getSessionsByType = getSessionsByType;
exports.searchChatSessions = searchChatSessions;
exports.searchChatSessionsByContent = searchChatSessionsByContent;
exports.getChatSession = getChatSession;
exports.updateChatSession = updateChatSession;
exports.deleteChatSession = deleteChatSession;
exports.extractKeywords = extractKeywords;
exports.generateSessionTitle = generateSessionTitle;
const axios_1 = __importDefault(require("axios"));
const errorHandling_1 = require("./errorHandling");
// Helper function to get the base URL
const getBaseUrl = () => {
    // In the browser, use window.location as the base
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol;
        const host = window.location.host;
        return `${protocol}//${host}`;
    }
    // In server environment, construct URL from environment variables
    // For Vercel deployments
    if (process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL) {
        const host = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
        return `https://${host}`;
    }
    // For custom domain deployments
    if (process.env.NEXT_PUBLIC_BASE_URL) {
        return process.env.NEXT_PUBLIC_BASE_URL;
    }
    // Local development fallback
    return 'http://localhost:3000';
};
/**
 * Save a new chat session
 */
async function saveChatSession(session) {
    try {
        const baseUrl = getBaseUrl();
        const response = await axios_1.default.post(`${baseUrl}/api/storage/chat-operations?method=POST&action=save`, session);
        return response.data.sessionId;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to save chat session', error);
        throw new Error('Failed to save chat session');
    }
}
/**
 * List all chat sessions
 */
async function listChatSessions() {
    try {
        const baseUrl = getBaseUrl();
        const response = await axios_1.default.get(`${baseUrl}/api/storage/chat-operations?method=GET&action=list`);
        return response.data;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to list chat sessions', error);
        return [];
    }
}
/**
 * Get sessions by type
 */
async function getSessionsByType(sessionType) {
    try {
        const baseUrl = getBaseUrl();
        const response = await axios_1.default.get(`${baseUrl}/api/storage/chat-operations?method=GET&action=list&type=${sessionType}`);
        return response.data;
    }
    catch (error) {
        (0, errorHandling_1.logError)(`Failed to get ${sessionType} sessions`, error);
        return [];
    }
}
/**
 * Search chat sessions by query text
 */
async function searchChatSessions(query) {
    try {
        const baseUrl = getBaseUrl();
        const response = await axios_1.default.get(`${baseUrl}/api/admin/chat-sessions?search=${encodeURIComponent(query)}`);
        return response.data;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to search chat sessions', error);
        return [];
    }
}
/**
 * Search chat sessions by content
 */
async function searchChatSessionsByContent(query) {
    try {
        const baseUrl = getBaseUrl();
        const response = await axios_1.default.get(`${baseUrl}/api/admin/chat-sessions?content=${encodeURIComponent(query)}`);
        return response.data;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to search chat sessions by content', error);
        return [];
    }
}
/**
 * Get a chat session by ID
 */
async function getChatSession(sessionId) {
    var _a;
    try {
        const baseUrl = getBaseUrl();
        const response = await axios_1.default.get(`${baseUrl}/api/storage/chat-operations?method=GET&action=get&id=${sessionId}`);
        return response.data;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error) && ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 404) {
            // Session not found
            return null;
        }
        (0, errorHandling_1.logError)('Failed to get chat session', error);
        return null;
    }
}
/**
 * Update an existing chat session
 */
async function updateChatSession(sessionId, updates) {
    try {
        const baseUrl = getBaseUrl();
        const response = await axios_1.default.put(`${baseUrl}/api/storage/chat-operations?method=PUT&action=update&id=${sessionId}`, updates);
        return response.data.success;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to update chat session', error);
        return false;
    }
}
/**
 * Delete a chat session
 */
async function deleteChatSession(sessionId) {
    try {
        const baseUrl = getBaseUrl();
        const response = await axios_1.default.delete(`${baseUrl}/api/admin/chat-sessions?id=${sessionId}`);
        return response.data.success;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to delete chat session', error);
        return false;
    }
}
/**
 * Extract keywords from messages for better searching
 */
function extractKeywords(messages) {
    // Simple keyword extraction - in production, you'd use a more sophisticated NLP approach
    const allText = messages
        .map(msg => msg.content)
        .join(' ')
        .toLowerCase();
    // Remove common words and symbols
    const cleanText = allText.replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    // Split into words and filter out short words and common stopwords
    const stopwords = ['the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'am', 'was', 'were'];
    const words = cleanText.split(' ')
        .filter(word => word.length > 3 && !stopwords.includes(word));
    // Count word frequency
    const wordCount = {};
    words.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
    });
    // Sort by frequency and return top 10 keywords
    return Object.entries(wordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word]) => word);
}
/**
 * Generate a title for a chat session based on messages
 */
function generateSessionTitle(messages) {
    // Default title
    const defaultTitle = `Chat Session ${new Date().toLocaleDateString()}`;
    // Find first user message
    const firstUserMessage = messages.find(msg => msg.role === 'user');
    if (!firstUserMessage)
        return defaultTitle;
    // Clean and truncate message
    const content = firstUserMessage.content.trim();
    if (content.length < 5)
        return defaultTitle;
    if (content.length <= 30) {
        return content.charAt(0).toUpperCase() + content.slice(1);
    }
    // Truncate longer messages
    return content.substring(0, 30).trim() + '...';
}

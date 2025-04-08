"use strict";
/**
 * Feedback Management Utility
 *
 * Handles storage and retrieval of user feedback on assistant responses,
 * and provides analytics for improving content and training.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordFeedback = recordFeedback;
exports.getAnalytics = getAnalytics;
exports.getAllFeedback = getAllFeedback;
exports.getSessionFeedback = getSessionFeedback;
exports.extractTopics = extractTopics;
exports.getFeedbackBySessionType = getFeedbackBySessionType;
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
 * Record user feedback for a response
 */
async function recordFeedback(feedback) {
    try {
        const baseUrl = getBaseUrl();
        const response = await axios_1.default.post(`${baseUrl}/api/feedback`, feedback);
        return response.data.id;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to record feedback', error);
        throw new Error('Failed to save feedback');
    }
}
/**
 * Get analytics data
 */
async function getAnalytics() {
    try {
        const baseUrl = getBaseUrl();
        const response = await axios_1.default.get(`${baseUrl}/api/admin/analytics`);
        return response.data;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to get analytics data', error);
        throw new Error('Failed to retrieve analytics data');
    }
}
/**
 * Get all feedback entries
 */
async function getAllFeedback() {
    try {
        const baseUrl = getBaseUrl();
        const response = await axios_1.default.get(`${baseUrl}/api/admin/feedback`);
        return response.data;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to get feedback', error);
        throw new Error('Failed to retrieve feedback data');
    }
}
/**
 * Get feedback for a specific session
 */
async function getSessionFeedback(sessionId) {
    try {
        const baseUrl = getBaseUrl();
        const response = await axios_1.default.get(`${baseUrl}/api/admin/feedback?sessionId=${sessionId}`);
        return response.data;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to get session feedback', error);
        throw new Error('Failed to retrieve session feedback');
    }
}
/**
 * Extract common topics from a query
 */
function extractTopics(query) {
    // Client-side implementation - simple version
    const words = query.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3);
    return [...new Set(words)].slice(0, 5);
}
/**
 * Get feedback by session type
 */
async function getFeedbackBySessionType(sessionType) {
    try {
        const baseUrl = getBaseUrl();
        const response = await axios_1.default.get(`${baseUrl}/api/admin/feedback?type=${sessionType}`);
        return response.data;
    }
    catch (error) {
        (0, errorHandling_1.logError)(`Failed to get ${sessionType} feedback`, error);
        throw new Error(`Failed to retrieve ${sessionType} feedback data`);
    }
}

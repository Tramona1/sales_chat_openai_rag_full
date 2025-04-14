/**
 * Chat Storage Utility
 *
 * Manages persistent storage of chat sessions, including:
 * - Company information (for company chat)
 * - General chat sessions
 * - Sales rep notes
 * - Chat history
 *
 * This module automatically selects the appropriate storage backend based on
 * the USE_SUPABASE environment variable.
 */
import axios from 'axios';
import { logError } from './logger';
import * as supabaseChatStorage from './supabaseChatStorage';
// Check if we should use Supabase for chat storage specifically
const useSupabase = process.env.USE_SUPABASE_CHAT === 'true' || (process.env.USE_SUPABASE === 'true' && process.env.USE_SUPABASE_CHAT !== 'false');
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
export async function saveChatSession(session) {
    try {
        // If Supabase is enabled, use that
        if (useSupabase) {
            return await supabaseChatStorage.saveChatSession(session);
        }
        // Otherwise use file-based storage via API
        const baseUrl = getBaseUrl();
        const response = await axios.post(`${baseUrl}/api/storage/chat-operations?method=POST&action=save`, session);
        return response.data.sessionId;
    }
    catch (error) {
        logError('Failed to save chat session', error);
        throw new Error('Failed to save chat session');
    }
}
/**
 * List all chat sessions
 */
export async function listChatSessions() {
    try {
        // If Supabase is enabled, use that
        if (useSupabase) {
            return await supabaseChatStorage.listChatSessions();
        }
        // Otherwise use file-based storage via API
        const baseUrl = getBaseUrl();
        const response = await axios.get(`${baseUrl}/api/storage/chat-operations?method=GET&action=list`);
        return response.data;
    }
    catch (error) {
        logError('Failed to list chat sessions', error);
        return [];
    }
}
/**
 * Get sessions by type
 */
export async function getSessionsByType(sessionType) {
    try {
        // If Supabase is enabled, use that
        if (useSupabase) {
            return await supabaseChatStorage.getSessionsByType(sessionType);
        }
        // Otherwise use file-based storage via API
        const baseUrl = getBaseUrl();
        const response = await axios.get(`${baseUrl}/api/storage/chat-operations?method=GET&action=list&type=${sessionType}`);
        return response.data;
    }
    catch (error) {
        logError(`Failed to get ${sessionType} sessions`, error);
        return [];
    }
}
/**
 * Search chat sessions by query text
 */
export async function searchChatSessions(query) {
    try {
        // If Supabase is enabled, use that
        if (useSupabase) {
            return await supabaseChatStorage.searchChatSessions(query);
        }
        // Otherwise use file-based storage via API
        const baseUrl = getBaseUrl();
        const response = await axios.get(`${baseUrl}/api/admin/chat-sessions?search=${encodeURIComponent(query)}`);
        return response.data;
    }
    catch (error) {
        logError('Failed to search chat sessions', error);
        return [];
    }
}
/**
 * Search chat sessions by content
 */
export async function searchChatSessionsByContent(query) {
    try {
        // If Supabase is enabled, use that
        if (useSupabase) {
            return await supabaseChatStorage.searchChatSessionsByContent(query);
        }
        // Otherwise use file-based storage via API
        const baseUrl = getBaseUrl();
        const response = await axios.get(`${baseUrl}/api/admin/chat-sessions?content=${encodeURIComponent(query)}`);
        return response.data;
    }
    catch (error) {
        logError('Failed to search chat sessions by content', error);
        return [];
    }
}
/**
 * Get a chat session by ID
 */
export async function getChatSession(sessionId) {
    try {
        // If Supabase is enabled, use that
        if (useSupabase) {
            return await supabaseChatStorage.getChatSession(sessionId);
        }
        // Otherwise use file-based storage via API
        const baseUrl = getBaseUrl();
        const response = await axios.get(`${baseUrl}/api/storage/chat-operations?method=GET&action=get&id=${sessionId}`);
        return response.data;
    }
    catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            // Session not found
            return null;
        }
        logError('Failed to get chat session', error);
        return null;
    }
}
/**
 * Update an existing chat session
 */
export async function updateChatSession(sessionId, updates) {
    try {
        // If Supabase is enabled, use that
        if (useSupabase) {
            return await supabaseChatStorage.updateChatSession(sessionId, updates);
        }
        // Otherwise use file-based storage via API
        const baseUrl = getBaseUrl();
        // Include the sessionId in the request body
        const response = await axios.put(`${baseUrl}/api/storage/chat-operations?method=PUT&action=update`, { id: sessionId, ...updates });
        return response.data.success;
    }
    catch (error) {
        logError('Failed to update chat session', error);
        return false;
    }
}
/**
 * Delete a chat session
 */
export async function deleteChatSession(sessionId) {
    try {
        // If Supabase is enabled, use that
        if (useSupabase) {
            return await supabaseChatStorage.deleteChatSession(sessionId);
        }
        // Otherwise use file-based storage via API
        const baseUrl = getBaseUrl();
        const response = await axios.delete(`${baseUrl}/api/storage/chat-operations?method=DELETE&id=${sessionId}`);
        return response.data.success;
    }
    catch (error) {
        logError('Failed to delete chat session', error);
        return false;
    }
}
// Reexport utility functions from supabaseChatStorage
export const { extractKeywords, generateSessionTitle } = useSupabase
    ? supabaseChatStorage
    : require('./chatStorageUtils');

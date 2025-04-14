/**
 * Supabase Chat Storage Module
 *
 * This module provides functions for storing and retrieving chat sessions using Supabase.
 */
import { logError, logInfo } from './logger';
import { getSupabaseAdmin } from './supabaseClient';
/**
 * Save a new chat session in Supabase
 */
export async function saveChatSession(session) {
    try {
        // Generate timestamps
        const now = new Date().toISOString();
        // Ensure sessionType is always set to a valid value
        const sessionType = session.sessionType || 'general'; // Default to 'general' if not provided
        // Prepare the session data with snake_case keys for Supabase
        const sessionData = {
            session_type: sessionType,
            company_name: session.companyName,
            company_info: session.companyInfo ? JSON.stringify(session.companyInfo) : null,
            title: session.title,
            sales_notes: session.salesNotes,
            messages: JSON.stringify(session.messages),
            sales_rep_id: session.salesRepId,
            sales_rep_name: session.salesRepName,
            tags: session.tags,
            keywords: session.keywords,
            created_at: now,
            updated_at: now
        };
        const { data, error } = await getSupabaseAdmin()
            .from('chat_sessions')
            .insert(sessionData)
            .select('id')
            .single();
        if (error) {
            logError('Failed to save chat session to Supabase', error);
            throw error;
        }
        logInfo(`Chat session saved successfully with ID: ${data.id}`);
        return data.id;
    }
    catch (error) {
        logError('Error saving chat session', error);
        throw new Error('Failed to save chat session');
    }
}
/**
 * List all chat sessions
 */
export async function listChatSessions() {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('chat_sessions')
            .select('id, title, session_type, updated_at, company_name')
            .order('updated_at', { ascending: false });
        if (error) {
            logError('Failed to list chat sessions', error);
            throw error;
        }
        // Transform from Supabase snake_case to our camelCase
        return data.map(session => ({
            id: session.id,
            title: session.title,
            sessionType: session.session_type,
            updatedAt: session.updated_at,
            companyName: session.company_name || undefined
        }));
    }
    catch (error) {
        logError('Error listing chat sessions', error);
        return [];
    }
}
/**
 * Get sessions by type
 */
export async function getSessionsByType(sessionType) {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('chat_sessions')
            .select('id, title, session_type, updated_at, company_name')
            .eq('session_type', sessionType)
            .order('updated_at', { ascending: false });
        if (error) {
            logError(`Failed to get ${sessionType} sessions`, error);
            throw error;
        }
        // Transform from Supabase snake_case to our camelCase
        return data.map(session => ({
            id: session.id,
            title: session.title,
            sessionType: session.session_type,
            updatedAt: session.updated_at,
            companyName: session.company_name || undefined
        }));
    }
    catch (error) {
        logError(`Error getting ${sessionType} sessions`, error);
        return [];
    }
}
/**
 * Search chat sessions by query text
 */
export async function searchChatSessions(query) {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('chat_sessions')
            .select('id, title, session_type, updated_at, company_name')
            .or(`title.ilike.%${query}%, company_name.ilike.%${query}%`)
            .order('updated_at', { ascending: false });
        if (error) {
            logError('Failed to search chat sessions', error);
            throw error;
        }
        // Transform from Supabase snake_case to our camelCase
        return data.map(session => ({
            id: session.id,
            title: session.title,
            sessionType: session.session_type,
            updatedAt: session.updated_at,
            companyName: session.company_name || undefined
        }));
    }
    catch (error) {
        logError('Error searching chat sessions', error);
        return [];
    }
}
/**
 * Search chat sessions by content
 */
export async function searchChatSessionsByContent(query) {
    try {
        // Note: This assumes messages are stored as jsonb and the content is searchable
        // This may need to be adjusted based on the actual Supabase schema
        const { data, error } = await getSupabaseAdmin()
            .from('chat_sessions')
            .select('id, title, session_type, updated_at, company_name')
            .textSearch('messages', query)
            .order('updated_at', { ascending: false });
        if (error) {
            logError('Failed to search chat sessions by content', error);
            throw error;
        }
        // Transform from Supabase snake_case to our camelCase
        return data.map(session => ({
            id: session.id,
            title: session.title,
            sessionType: session.session_type,
            updatedAt: session.updated_at,
            companyName: session.company_name || undefined
        }));
    }
    catch (error) {
        logError('Error searching chat sessions by content', error);
        return [];
    }
}
/**
 * Get a chat session by ID
 */
export async function getChatSession(sessionId) {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('chat_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                // No data found
                return null;
            }
            logError(`Failed to get chat session with ID ${sessionId}`, error);
            throw error;
        }
        // Transform from Supabase snake_case to our camelCase
        return {
            id: data.id,
            sessionType: data.session_type,
            companyName: data.company_name || undefined,
            companyInfo: data.company_info ? JSON.parse(data.company_info) : undefined,
            title: data.title,
            salesNotes: data.sales_notes || undefined,
            messages: typeof data.messages === 'string' ? JSON.parse(data.messages) : data.messages,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            salesRepId: data.sales_rep_id || undefined,
            salesRepName: data.sales_rep_name || undefined,
            tags: data.tags || undefined,
            keywords: data.keywords || undefined
        };
    }
    catch (error) {
        logError(`Error getting chat session with ID ${sessionId}`, error);
        return null;
    }
}
/**
 * Update an existing chat session
 */
export async function updateChatSession(sessionId, updates) {
    try {
        // Prepare update data with snake_case keys for Supabase
        const updateData = {
            updated_at: new Date().toISOString()
        };
        // Add fields to update if present (using snake_case keys)
        if (updates.title)
            updateData.title = updates.title;
        if (updates.sessionType)
            updateData.session_type = updates.sessionType;
        if (updates.companyName)
            updateData.company_name = updates.companyName;
        if (updates.companyInfo)
            updateData.company_info = JSON.stringify(updates.companyInfo);
        if (updates.salesNotes !== undefined)
            updateData.sales_notes = updates.salesNotes;
        if (updates.salesRepId)
            updateData.sales_rep_id = updates.salesRepId;
        if (updates.salesRepName)
            updateData.sales_rep_name = updates.salesRepName;
        if (updates.tags)
            updateData.tags = updates.tags;
        if (updates.keywords)
            updateData.keywords = updates.keywords;
        if (updates.messages)
            updateData.messages = JSON.stringify(updates.messages);
        const { error } = await getSupabaseAdmin()
            .from('chat_sessions')
            .update(updateData)
            .eq('id', sessionId);
        if (error) {
            logError(`Failed to update chat session with ID ${sessionId}`, error);
            throw error;
        }
        return true;
    }
    catch (error) {
        logError(`Error updating chat session with ID ${sessionId}`, error);
        return false;
    }
}
/**
 * Delete a chat session
 */
export async function deleteChatSession(sessionId) {
    try {
        const { error } = await getSupabaseAdmin()
            .from('chat_sessions')
            .delete()
            .eq('id', sessionId);
        if (error) {
            logError(`Failed to delete chat session with ID ${sessionId}`, error);
            throw error;
        }
        return true;
    }
    catch (error) {
        logError(`Error deleting chat session with ID ${sessionId}`, error);
        return false;
    }
}
/**
 * Extract keywords from messages for better searching
 */
export function extractKeywords(messages) {
    // Return empty array if no messages
    if (!messages || messages.length === 0) {
        return [];
    }
    // Simple keyword extraction - in production, you'd use NLP techniques
    const allText = messages
        .filter(msg => msg && typeof msg.content === 'string') // Add null checks
        .map(msg => msg.content)
        .join(' ')
        .toLowerCase();
    // Return empty array if the combined text is too short
    if (allText.length < 10) {
        return [];
    }
    // More thorough cleaning of text
    const cleanText = allText
        .replace(/[^\w\s]/g, ' ') // Replace non-alphanumeric with spaces
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
    // Expanded stopword list for better filtering
    const stopwords = [
        'the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
        'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
        'had', 'do', 'does', 'did', 'but', 'if', 'or', 'because', 'as', 'until',
        'while', 'that', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
        'then', 'than', 'so', 'can', 'could', 'will', 'would', 'should', 'ought',
        'now', 'about', 'each', 'both'
    ];
    // Split into words and filter more intelligently
    const words = cleanText.split(' ')
        .filter(word => {
        // Filter out empty strings, short words, numbers, and stopwords
        return word &&
            word.length > 3 && // Longer than 3 characters
            !stopwords.includes(word) && // Not a stopword
            isNaN(Number(word)) && // Not just a number
            !/^\d+$/.test(word); // Not just a numeric string
    });
    // Return empty array if no words left after filtering
    if (words.length === 0) {
        return [];
    }
    // Count word frequency
    const wordCount = {};
    words.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
    });
    // Sort by frequency and return top 15 keywords (increased from 10)
    return Object.entries(wordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([word]) => word);
}
/**
 * Generate a title for a chat session based on messages
 */
export function generateSessionTitle(messages) {
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

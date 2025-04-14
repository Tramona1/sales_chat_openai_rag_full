import { logError, logInfo } from '@/utils/logger';
import { createServiceClient } from '@/utils/supabaseClient';
// Save chat session
async function saveChatSession(session) {
    try {
        // Generate timestamps
        const now = new Date().toISOString();
        // Check if this is a duplicate of a recent company session
        if (session.sessionType === 'company' && session.companyName) {
            const supabase = createServiceClient();
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            // Find recent session for same company
            const { data: recentSessions, error: queryError } = await supabase
                .from('chat_sessions')
                .select('id')
                .eq('session_type', 'company')
                .eq('company_name', session.companyName)
                .gt('updated_at', oneHourAgo)
                .limit(1);
            if (queryError) {
                logError('Error checking for recent company sessions', queryError);
            }
            else if (recentSessions && recentSessions.length > 0) {
                // Return existing session ID instead of creating a new one
                return recentSessions[0].id;
            }
        }
        // Create session data formatted for Supabase
        const sessionData = {
            session_type: session.sessionType,
            company_name: session.companyName || null,
            company_info: session.companyInfo || null,
            title: session.title,
            sales_notes: session.salesNotes || null,
            messages: session.messages,
            sales_rep_id: session.salesRepId || null,
            sales_rep_name: session.salesRepName || null,
            tags: session.tags || null,
            keywords: session.keywords || null,
        };
        // Insert into Supabase
        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from('chat_sessions')
            .insert(sessionData)
            .select('id')
            .single();
        if (error) {
            logError('Failed to save chat session to Supabase', error);
            throw new Error('Failed to save chat session');
        }
        logInfo(`Chat session saved to Supabase with ID: ${data.id}`);
        return data.id;
    }
    catch (error) {
        logError('Failed to save chat session', error);
        throw new Error('Failed to save chat session');
    }
}
// Get chat session by ID
async function getChatSession(sessionId) {
    try {
        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
        if (error) {
            logError('Failed to get chat session from Supabase', error);
            return null;
        }
        if (!data) {
            return null;
        }
        // Transform from Supabase snake_case to camelCase
        const session = {
            id: data.id,
            sessionType: data.session_type,
            companyName: data.company_name || undefined,
            companyInfo: data.company_info || undefined,
            title: data.title,
            salesNotes: data.sales_notes || undefined,
            messages: data.messages,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            salesRepId: data.sales_rep_id || undefined,
            salesRepName: data.sales_rep_name || undefined,
            tags: data.tags || undefined,
            keywords: data.keywords || undefined
        };
        return session;
    }
    catch (error) {
        logError('Failed to get chat session', error);
        return null;
    }
}
// Update chat session
async function updateChatSession(sessionId, updates) {
    try {
        // Transform updates to Supabase format (snake_case)
        const updateData = {};
        if (updates.sessionType)
            updateData.session_type = updates.sessionType;
        if (updates.companyName !== undefined)
            updateData.company_name = updates.companyName;
        if (updates.companyInfo !== undefined)
            updateData.company_info = updates.companyInfo;
        if (updates.title)
            updateData.title = updates.title;
        if (updates.salesNotes !== undefined)
            updateData.sales_notes = updates.salesNotes;
        if (updates.messages)
            updateData.messages = updates.messages;
        if (updates.salesRepId !== undefined)
            updateData.sales_rep_id = updates.salesRepId;
        if (updates.salesRepName !== undefined)
            updateData.sales_rep_name = updates.salesRepName;
        if (updates.tags !== undefined)
            updateData.tags = updates.tags;
        if (updates.keywords !== undefined)
            updateData.keywords = updates.keywords;
        // Update in Supabase
        const supabase = createServiceClient();
        const { error } = await supabase
            .from('chat_sessions')
            .update(updateData)
            .eq('id', sessionId);
        if (error) {
            logError('Failed to update chat session in Supabase', error);
            return false;
        }
        return true;
    }
    catch (error) {
        logError('Failed to update chat session', error);
        return false;
    }
}
// List all chat sessions
async function listChatSessions() {
    try {
        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from('chat_sessions')
            .select('id, title, session_type, updated_at, company_name')
            .order('updated_at', { ascending: false });
        if (error) {
            logError('Failed to list chat sessions from Supabase', error);
            return [];
        }
        // Transform from Supabase format to our format
        return data.map(session => ({
            id: session.id,
            title: session.title,
            sessionType: session.session_type,
            updatedAt: session.updated_at,
            companyName: session.company_name || undefined
        }));
    }
    catch (error) {
        logError('Failed to list chat sessions', error);
        return [];
    }
}
// Get sessions by type
async function getSessionsByType(sessionType) {
    try {
        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from('chat_sessions')
            .select('id, title, session_type, updated_at, company_name')
            .eq('session_type', sessionType)
            .order('updated_at', { ascending: false });
        if (error) {
            logError('Failed to get sessions by type from Supabase', error);
            return [];
        }
        // Transform from Supabase format to our format
        return data.map(session => ({
            id: session.id,
            title: session.title,
            sessionType: session.session_type,
            updatedAt: session.updated_at,
            companyName: session.company_name || undefined
        }));
    }
    catch (error) {
        logError('Failed to get sessions by type', error);
        return [];
    }
}
// Delete a chat session
async function deleteChatSession(sessionId) {
    try {
        const supabase = createServiceClient();
        const { error } = await supabase
            .from('chat_sessions')
            .delete()
            .eq('id', sessionId);
        if (error) {
            logError('Failed to delete chat session from Supabase', error);
            return false;
        }
        return true;
    }
    catch (error) {
        logError('Failed to delete chat session', error);
        return false;
    }
}
export default async function handler(req, res) {
    try {
        // GET requests for retrieving sessions
        if (req.method === 'GET') {
            const { id, type } = req.query;
            // Get a specific session by ID
            if (id && typeof id === 'string') {
                const session = await getChatSession(id);
                if (!session) {
                    return res.status(404).json({ error: 'Session not found' });
                }
                return res.status(200).json(session);
            }
            // Get sessions by type
            if (type && (type === 'company' || type === 'general')) {
                const sessions = await getSessionsByType(type);
                return res.status(200).json({ sessions });
            }
            // List all sessions
            const sessions = await listChatSessions();
            return res.status(200).json({ sessions });
        }
        // POST request for creating new session
        if (req.method === 'POST') {
            const sessionData = req.body;
            // Validate required fields
            if (!sessionData.title || !sessionData.sessionType || !sessionData.messages) {
                return res.status(400).json({ error: 'Missing required fields: title, sessionType, or messages' });
            }
            const id = await saveChatSession(sessionData);
            return res.status(201).json({ id, success: true });
        }
        // PUT request for updating session
        if (req.method === 'PUT') {
            const { id, ...updates } = req.body;
            if (!id) {
                return res.status(400).json({ error: 'Missing session ID' });
            }
            const success = await updateChatSession(id, updates);
            if (!success) {
                return res.status(404).json({ error: 'Session not found or update failed' });
            }
            return res.status(200).json({ success: true });
        }
        // DELETE request for removing a session
        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id || typeof id !== 'string') {
                return res.status(400).json({ error: 'Missing session ID' });
            }
            const success = await deleteChatSession(id);
            if (!success) {
                return res.status(404).json({ error: 'Session not found or delete failed' });
            }
            return res.status(200).json({ success: true });
        }
        // Method not allowed
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
    catch (error) {
        logError('Error in chat operations API handler', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

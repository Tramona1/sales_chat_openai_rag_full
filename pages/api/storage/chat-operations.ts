/**
 * UNAUTHENTICATED Chat Storage API Endpoint
 * 
 * This endpoint provides direct access to chat storage operations without authentication.
 * It's used for essential chat functionality and should have appropriate rate limiting
 * in a production environment.
 * 
 * IMPORTANT: This API has no authentication by design to avoid Vercel SSO issues.
 * In a production environment, this should be secured.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { logError, logInfo, logDebug, logWarning } from '@/utils/logger';
import { CompanyInformation } from '@/utils/perplexityClient';
import { createServiceClient } from '@/utils/supabaseClient';

// Types
interface StoredChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface StoredChatSession {
  id: string;
  sessionType: 'company' | 'general';
  companyName?: string;
  companyInfo?: Partial<CompanyInformation>;
  title: string;
  salesNotes?: string;
  messages: StoredChatMessage[];
  createdAt: string;
  updatedAt: string;
  salesRepId?: string;
  salesRepName?: string;
  tags?: string[];
  keywords?: string[];
}

interface SessionIndex {
  sessions: {
    id: string;
    title: string;
    sessionType: 'company' | 'general';
    updatedAt: string;
    companyName?: string;
  }[];
}

// Save chat session
async function saveChatSession(session: Omit<StoredChatSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    // Generate timestamps
    const now = new Date().toISOString();
    
    // Check if this is a duplicate of a recent company session
    if (session.sessionType === 'company' && session.companyName) {
      const supabase = createServiceClient();
      if (!supabase) { throw new Error('Failed to create Supabase client for duplicate check'); }
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
      } else if (recentSessions && recentSessions.length > 0) {
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
    if (!supabase) { throw new Error('Failed to create Supabase client for insert'); }
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
  } catch (error) {
    logError('Failed to save chat session', error);
    throw new Error('Failed to save chat session');
  }
}

// Get chat session by ID
async function getChatSession(sessionId: string): Promise<StoredChatSession | null> {
  try {
    const supabase = createServiceClient();
    if (!supabase) { logError('Failed to create Supabase client in getChatSession'); return null; }
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
    const session: StoredChatSession = {
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
  } catch (error) {
    logError('Failed to get chat session', error);
    return null;
  }
}

// Update chat session
async function updateChatSession(
  sessionId: string,
  updates: Partial<Omit<StoredChatSession, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> {
  try {
    // Transform updates to Supabase format (snake_case)
    const updateData: any = {};
    
    if (updates.sessionType) updateData.session_type = updates.sessionType;
    if (updates.companyName !== undefined) updateData.company_name = updates.companyName;
    if (updates.companyInfo !== undefined) updateData.company_info = updates.companyInfo;
    if (updates.title) updateData.title = updates.title;
    if (updates.salesNotes !== undefined) updateData.sales_notes = updates.salesNotes;
    if (updates.messages) updateData.messages = updates.messages;
    if (updates.salesRepId !== undefined) updateData.sales_rep_id = updates.salesRepId;
    if (updates.salesRepName !== undefined) updateData.sales_rep_name = updates.salesRepName;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.keywords !== undefined) updateData.keywords = updates.keywords;
    
    // Update in Supabase
    const supabase = createServiceClient();
    if (!supabase) { logError('Failed to create Supabase client in updateChatSession'); return false; }
    const { error } = await supabase
      .from('chat_sessions')
      .update(updateData)
      .eq('id', sessionId);
    
    if (error) {
      logError('Failed to update chat session in Supabase', error);
      return false;
    }
    
    return true;
  } catch (error) {
    logError('Failed to update chat session', error);
    return false;
  }
}

// List all chat sessions
async function listChatSessions(): Promise<SessionIndex['sessions']> {
  logDebug('[listChatSessions] Function called.'); // Log start
  try {
    const supabase = createServiceClient();
    // Check if client creation failed before using it
    if (!supabase) {
      logError('[listChatSessions] Failed to create Supabase client.');
      return []; // Return empty array if client is null
    }
    logDebug('[listChatSessions] Supabase client created successfully.');
    
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id, title, session_type, updated_at, company_name')
      .order('updated_at', { ascending: false });
    
    logDebug(`[listChatSessions] Supabase query completed. Error: ${JSON.stringify(error)}, Data received: ${data ? 'Yes' : 'No'}`);

    if (error) {
      logError('[listChatSessions] Failed to list chat sessions from Supabase', error);
      return [];
    }
    
    // Explicitly check if data is null or not an array
    if (!data) {
        logWarning('[listChatSessions] Supabase returned null/undefined data without an error.');
        return [];
    }
    if (!Array.isArray(data)) {
        logError(`[listChatSessions] Supabase returned non-array data without an error. Type: ${typeof data}, Value: ${JSON.stringify(data)}`);
        return []; // Return empty array to prevent .map error
    }
    
    // Transform from Supabase format to our format
    const result = data.map(session => ({
      id: session.id,
      title: session.title,
      sessionType: session.session_type,
      updatedAt: session.updated_at,
      companyName: session.company_name || undefined
    }));
    
    logDebug(`[listChatSessions] Successfully processed ${result.length} sessions. Returning array.`);
    return result;

  } catch (error) {
    logError('[listChatSessions] Error caught in listChatSessions', error);
    return [];
  }
}

// Get sessions by type
async function getSessionsByType(sessionType: 'company' | 'general'): Promise<SessionIndex['sessions']> {
  try {
    const supabase = createServiceClient();
    if (!supabase) { logError('Failed to create Supabase client in getSessionsByType'); return []; }
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
  } catch (error) {
    logError('Failed to get sessions by type', error);
    return [];
  }
}

// Delete a chat session
async function deleteChatSession(sessionId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    if (!supabase) { logError('Failed to create Supabase client in deleteChatSession'); return false; }
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);
    
    if (error) {
      logError('Failed to delete chat session from Supabase', error);
      return false;
    }
    
    return true;
  } catch (error) {
    logError('Failed to delete chat session', error);
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Add CORS headers - expanded for better compatibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // NO AUTHENTICATION: This endpoint deliberately does not use authentication
  // to avoid 401/404 errors in the Vercel environment
  
  try {
    // Extract operation type and parameters from the request
    const { operation } = req.query;
    
    switch (operation) {
      case 'save':
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method Not Allowed' });
        }
        
        const sessionData = req.body;
        logInfo('[ChatOps API] Received save request. Body:', sessionData); // Log the received body
        const sessionId = await saveChatSession(sessionData);
        return res.status(200).json({ id: sessionId });
        
      case 'get':
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method Not Allowed' });
        }
        
        const { id } = req.query;
        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Session ID is required' });
        }
        
        const session = await getChatSession(id);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }
        
        return res.status(200).json(session);
        
      case 'update':
        if (req.method !== 'PUT') {
          return res.status(405).json({ error: 'Method Not Allowed' });
        }
        
        const updateId = req.query.id as string;
        if (!updateId) {
          return res.status(400).json({ error: 'Session ID is required' });
        }
        
        const updates = req.body;
        const success = await updateChatSession(updateId, updates);
        
        if (!success) {
          return res.status(404).json({ error: 'Session not found or update failed' });
        }
        
        return res.status(200).json({ success: true });
        
      case 'list':
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method Not Allowed' });
        }
        
        const sessions = await listChatSessions();
        return res.status(200).json({ sessions });
        
      case 'list-by-type':
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method Not Allowed' });
        }
        
        const { type } = req.query;
        if (!type || (type !== 'company' && type !== 'general')) {
          return res.status(400).json({ error: 'Valid session type (company or general) is required' });
        }
        
        const typedSessions = await getSessionsByType(type as 'company' | 'general');
        return res.status(200).json({ sessions: typedSessions });
        
      case 'delete':
        if (req.method !== 'DELETE') {
          return res.status(405).json({ error: 'Method Not Allowed' });
        }
        
        const deleteId = req.query.id as string;
        if (!deleteId) {
          return res.status(400).json({ error: 'Session ID is required' });
        }
        
        const deleteSuccess = await deleteChatSession(deleteId);
        
        if (!deleteSuccess) {
          return res.status(404).json({ error: 'Session not found or delete failed' });
        }
        
        return res.status(200).json({ success: true });
        
      default:
        return res.status(400).json({ error: 'Invalid operation' });
    }
  } catch (error) {
    console.error('Error in chat operations API:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
} 
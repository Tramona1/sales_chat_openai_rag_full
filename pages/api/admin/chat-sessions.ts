import type { NextApiRequest, NextApiResponse } from 'next';
import { 
  saveChatSession, 
  listChatSessions, 
  getChatSession, 
  searchChatSessions, 
  searchChatSessionsByContent,
  deleteChatSession,
  updateChatSession
} from '@/utils/chatStorage';
import { logError } from '@/utils/logger';

// Simple authorization check for admin routes
// In a production app, this would use proper authentication
function isAuthorized(req: NextApiRequest): boolean {
  // For now, we'll just check for an admin key in the header
  // In a real app, this would use a proper auth system
  const adminKey = req.headers['x-admin-key'] as string;
  return adminKey === process.env.ADMIN_API_KEY || process.env.NODE_ENV === 'development';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

async function handleGetRequest(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Check authorization
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { id, search, type, content } = req.query;
    
    // If session ID is provided, get that specific session
    if (id) {
      const session = await getChatSession(id as string);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      return res.status(200).json(session);
    }
    
    // If content search is provided, search sessions by content
    if (content) {
      const sessions = await searchChatSessionsByContent(content as string);
      return res.status(200).json({ sessions });
    }
    
    // If search query is provided, search sessions
    if (search) {
      const sessions = await searchChatSessions(search as string);
      
      // Filter by session type if provided
      if (type) {
        const filteredSessions = sessions.filter(s => s.sessionType === type);
        return res.status(200).json({ sessions: filteredSessions });
      }
      
      return res.status(200).json({ sessions });
    }
    
    // Otherwise, list all sessions, possibly filtered by type
    let sessions = await listChatSessions();
    
    // Filter by session type if provided
    if (type) {
      sessions = sessions.filter(s => s.sessionType === type);
    }
    
    return res.status(200).json({ sessions });
  } catch (error) {
    logError('Error in chat sessions API', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}

async function handlePostRequest(req: NextApiRequest, res: NextApiResponse) {
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

    // Ensure sessionType is always set to a valid value
    const sessionType = body.sessionType || (body.companyName ? 'company' : 'general');
    
    // In company mode, companyName and companyInfo are required
    if (sessionType === 'company' && (!body.companyName || !body.companyInfo)) {
      return res.status(400).json({ 
        error: 'For company sessions, companyName and companyInfo are required' 
      });
    }
    
    // For general sessions, title is required
    if (sessionType === 'general' && !body.title) {
      return res.status(400).json({ 
        error: 'For general sessions, title is required' 
      });
    }
    
    // Save the session
    const sessionId = await saveChatSession({
      sessionType: sessionType,
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
  } catch (error) {
    logError('Error in chat sessions API', error);
    return res.status(500).json({ error: 'Failed to save chat session' });
  }
}

/**
 * Handle PUT requests to update chat sessions
 */
async function handlePutRequest(req: NextApiRequest, res: NextApiResponse) {
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
    const success = await updateChatSession(id as string, {
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
  } catch (error) {
    logError('Error updating chat session', error);
    return res.status(500).json({ error: 'Failed to update chat session' });
  }
}

async function handleDeleteRequest(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Check authorization
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const success = await deleteChatSession(id as string);
    
    if (!success) {
      return res.status(404).json({ error: 'Failed to delete session' });
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    logError('Error in chat sessions API', error);
    return res.status(500).json({ error: 'Failed to delete chat session' });
  }
} 
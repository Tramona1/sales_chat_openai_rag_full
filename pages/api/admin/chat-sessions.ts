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
import { logError, logDebug } from '@/utils/logger';
import { withAdminAuth } from '@/utils/auth';

// Define the handler function
async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await handleGetRequest(req, res);
      case 'POST':
        return await handlePostRequest(req, res);
      case 'PUT':
        return await handlePutRequest(req, res);
      case 'DELETE':
        return await handleDeleteRequest(req, res);
      default:
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    logError('Error in chat sessions API', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}

// Handle GET requests (list sessions, search, etc.)
async function handleGetRequest(req: NextApiRequest, res: NextApiResponse) {
  const { action, query, type, id } = req.query;
  
  // Get a specific session by ID
  if (action === 'get' && id && typeof id === 'string') {
    const session = await getChatSession(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.status(200).json(session);
  }
  
  // Search sessions by title or company name
  if (action === 'search' && query && typeof query === 'string') {
    const results = await searchChatSessions(query);
    return res.status(200).json(results);
  }
  
  // Search sessions by message content
  if (action === 'searchContent' && query && typeof query === 'string') {
    const results = await searchChatSessionsByContent(query);
    return res.status(200).json(results);
  }
  
  // List sessions by type (company or general)
  if (type === 'company' || type === 'general') {
    const sessions = await listChatSessions();
    const filteredSessions = sessions.filter(
      session => session.sessionType === type
    );
    return res.status(200).json(filteredSessions);
  }
  
  // Default: List all sessions
  const sessions = await listChatSessions();
  return res.status(200).json(sessions);
}

// Handle POST requests (create new session)
async function handlePostRequest(req: NextApiRequest, res: NextApiResponse) {
  const body = req.body;
  
  if (!body) {
    return res.status(400).json({ error: 'Request body is required' });
  }
  
  // Check for required fields
  if (!body.title || !body.sessionType) {
    return res.status(400).json({ 
      error: 'Missing required fields', 
      required: ['title', 'sessionType'] 
    });
  }
  
  // Validate session type
  if (body.sessionType !== 'company' && body.sessionType !== 'general') {
    return res.status(400).json({ 
      error: 'Invalid session type', 
      allowed: ['company', 'general'] 
    });
  }
  
  // For company sessions, validate company name
  if (body.sessionType === 'company' && !body.companyName) {
    return res.status(400).json({ 
      error: 'Company name is required for company sessions' 
    });
  }
  
  try {
    // Create the new session
    const sessionId = await saveChatSession(body);
    return res.status(201).json({ id: sessionId });
  } catch (error) {
    logError('Error creating chat session', error);
    return res.status(500).json({ error: 'Failed to create chat session' });
  }
}

// Handle PUT requests (update existing session)
async function handlePutRequest(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const body = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid session ID is required' });
  }
  
  if (!body) {
    return res.status(400).json({ error: 'Request body is required' });
  }
  
  // Update the session
  const success = await updateChatSession(id, body);
  
  if (!success) {
    return res.status(404).json({ error: 'Session not found or update failed' });
  }
  
  return res.status(200).json({ success: true });
}

// Handle DELETE requests
async function handleDeleteRequest(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid session ID is required' });
  }
  
  // Delete the session
  const success = await deleteChatSession(id);
  
  if (!success) {
    return res.status(404).json({ error: 'Session not found or delete failed' });
  }
  
  return res.status(200).json({ success: true });
}

// Export the wrapped handler
export default withAdminAuth(handler); 
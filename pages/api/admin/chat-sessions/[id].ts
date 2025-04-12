import type { NextApiRequest, NextApiResponse } from 'next';
import { 
  getChatSession,
  updateChatSession,
  deleteChatSession
} from '@/utils/chatStorage';
import { logError } from '@/utils/logger';

// Simple authorization check for admin routes
function isAuthorized(req: NextApiRequest): boolean {
  // For now, we'll just check for an admin key in the header
  // In a real app, this would use a proper auth system
  const adminKey = req.headers['x-admin-key'] as string;
  return adminKey === process.env.ADMIN_API_KEY || process.env.NODE_ENV === 'development';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Check authorization
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Extract the session ID from the URL path
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Valid session ID is required' });
    }
    
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await handleGetSession(req, res, id);
      case 'PUT':
        return await handleUpdateSession(req, res, id);
      case 'DELETE':
        return await handleDeleteSession(req, res, id);
      default:
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    logError('Error in chat sessions [id] API', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}

async function handleGetSession(req: NextApiRequest, res: NextApiResponse, id: string) {
  const session = await getChatSession(id);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  return res.status(200).json(session);
}

async function handleUpdateSession(req: NextApiRequest, res: NextApiResponse, id: string) {
  const body = req.body;
  
  if (!body) {
    return res.status(400).json({ error: 'Request body is required' });
  }
  
  // For general updates, we're less strict about required fields
  const updates = {
    ...(body.title && { title: body.title }),
    ...(body.companyName && { companyName: body.companyName }),
    ...(body.companyInfo && { companyInfo: body.companyInfo }),
    ...(body.salesNotes !== undefined && { salesNotes: body.salesNotes }),
    ...(body.messages && { messages: body.messages }),
    ...(body.salesRepId && { salesRepId: body.salesRepId }),
    ...(body.salesRepName && { salesRepName: body.salesRepName }),
    ...(body.tags && { tags: body.tags }),
    ...(body.keywords && { keywords: body.keywords })
  };
  
  const success = await updateChatSession(id, updates);
  
  if (!success) {
    return res.status(404).json({ error: 'Session not found or update failed' });
  }
  
  return res.status(200).json({ success: true });
}

async function handleDeleteSession(req: NextApiRequest, res: NextApiResponse, id: string) {
  const success = await deleteChatSession(id);
  
  if (!success) {
    return res.status(404).json({ error: 'Session not found or delete failed' });
  }
  
  return res.status(200).json({ success: true });
} 
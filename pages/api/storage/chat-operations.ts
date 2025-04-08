import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { logError } from '@/utils/errorHandling';
import { CompanyInformation } from '@/utils/perplexityClient';

// Storage paths
const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const INDEX_FILE = path.join(DATA_DIR, 'session_index.json');

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

// Ensure storage directories exist
async function ensureStorageExists(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
    
    // Create index file if it doesn't exist
    try {
      await fs.access(INDEX_FILE);
    } catch {
      // Index doesn't exist, create it
      await fs.writeFile(INDEX_FILE, JSON.stringify({ sessions: [] }, null, 2));
    }
  } catch (error) {
    logError('Failed to ensure storage directories exist', error);
    throw new Error('Storage initialization failed');
  }
}

// Get session index
async function getSessionIndex(): Promise<SessionIndex> {
  try {
    await ensureStorageExists();
    const data = await fs.readFile(INDEX_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logError('Failed to read session index', error);
    return { sessions: [] };
  }
}

// Save session index
async function saveSessionIndex(index: SessionIndex): Promise<void> {
  try {
    await ensureStorageExists();
    await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
  } catch (error) {
    logError('Failed to save session index', error);
    throw new Error('Failed to update session index');
  }
}

// Save chat session
async function saveChatSession(session: Omit<StoredChatSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    // Generate ID and timestamps
    const now = new Date().toISOString();
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create full session object
    const fullSession: StoredChatSession = {
      ...session,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    // Check if this is a duplicate of a recent company session
    if (session.sessionType === 'company' && session.companyName) {
      const index = await getSessionIndex();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      // Find recent session for same company
      const recentSession = index.sessions.find(s => 
        s.sessionType === 'company' &&
        s.companyName?.toLowerCase() === session.companyName?.toLowerCase() && 
        s.updatedAt > oneHourAgo
      );
      
      if (recentSession) {
        // Return existing session ID instead of creating a new one
        return recentSession.id;
      }
    }
    
    // Save to file
    await ensureStorageExists();
    const sessionPath = path.join(SESSIONS_DIR, `${id}.json`);
    await fs.writeFile(sessionPath, JSON.stringify(fullSession, null, 2));
    
    // Update index
    const index = await getSessionIndex();
    
    // Add to index
    index.sessions.push({
      id,
      title: fullSession.title,
      sessionType: fullSession.sessionType,
      updatedAt: now,
      companyName: fullSession.companyName
    });
    
    await saveSessionIndex(index);
    
    return id;
  } catch (error) {
    logError('Failed to save chat session', error);
    throw new Error('Failed to save chat session');
  }
}

// Get chat session by ID
async function getChatSession(sessionId: string): Promise<StoredChatSession | null> {
  try {
    const sessionPath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    
    try {
      const data = await fs.readFile(sessionPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // Session not found
      return null;
    }
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
    // Get current session
    const session = await getChatSession(sessionId);
    if (!session) {
      return false;
    }
    
    // Update fields
    const now = new Date().toISOString();
    const updatedSession: StoredChatSession = {
      ...session,
      ...updates,
      id: sessionId,
      createdAt: session.createdAt,
      updatedAt: now
    };
    
    // Save to file
    const sessionPath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    await fs.writeFile(sessionPath, JSON.stringify(updatedSession, null, 2));
    
    // Update index if title changed
    if (updates.title) {
      const index = await getSessionIndex();
      const sessionIndex = index.sessions.findIndex(s => s.id === sessionId);
      
      if (sessionIndex !== -1) {
        index.sessions[sessionIndex].title = updates.title;
        index.sessions[sessionIndex].updatedAt = now;
        await saveSessionIndex(index);
      }
    }
    
    return true;
  } catch (error) {
    logError('Failed to update chat session', error);
    return false;
  }
}

// List all chat sessions
async function listChatSessions(): Promise<SessionIndex['sessions']> {
  try {
    const index = await getSessionIndex();
    return index.sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    logError('Failed to list chat sessions', error);
    return [];
  }
}

// Get sessions by type
async function getSessionsByType(sessionType: 'company' | 'general'): Promise<SessionIndex['sessions']> {
  try {
    const index = await getSessionIndex();
    return index.sessions
      .filter(session => session.sessionType === sessionType)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    logError(`Failed to get ${sessionType} sessions`, error);
    return [];
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureStorageExists();

    const { method, action } = req.query;

    switch (method) {
      case 'GET':
        // Handle get requests
        if (action === 'list') {
          const { type } = req.query;
          if (type === 'company' || type === 'general') {
            const sessions = await getSessionsByType(type);
            return res.status(200).json(sessions);
          } else {
            const sessions = await listChatSessions();
            return res.status(200).json(sessions);
          }
        } else if (action === 'get' && req.query.id) {
          const sessionId = req.query.id as string;
          const session = await getChatSession(sessionId);
          
          if (!session) {
            return res.status(404).json({ error: 'Session not found' });
          }
          
          return res.status(200).json(session);
        }
        break;
        
      case 'POST':
        // Handle post requests
        if (action === 'save') {
          if (!req.body) {
            return res.status(400).json({ error: 'Missing session data' });
          }
          
          const sessionId = await saveChatSession(req.body);
          return res.status(200).json({ sessionId });
        }
        break;
        
      case 'PUT':
        // Handle put requests
        if (action === 'update' && req.query.id) {
          if (!req.body) {
            return res.status(400).json({ error: 'Missing update data' });
          }
          
          const sessionId = req.query.id as string;
          const success = await updateChatSession(sessionId, req.body);
          
          if (!success) {
            return res.status(404).json({ error: 'Session not found' });
          }
          
          return res.status(200).json({ success: true });
        }
        break;
    }
    
    return res.status(400).json({ error: 'Invalid request' });
  } catch (error) {
    logError('Chat storage API error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 
/**
 * Chat Storage Utility
 * 
 * Manages persistent storage of chat sessions, including:
 * - Company information (for company chat)
 * - General chat sessions
 * - Sales rep notes
 * - Chat history
 */

import axios from 'axios';
import { logError } from './errorHandling';
import { CompanyInformation } from './perplexityClient';

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

// Type definitions
export interface StoredChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

// Interface for stored chat sessions
export interface StoredChatSession {
  id: string;
  sessionType: 'company' | 'general';
  companyName?: string;
  companyInfo?: Partial<CompanyInformation>;
  title: string; // Session title (company name for company chats, generated title for general chats)
  salesNotes?: string;
  messages: StoredChatMessage[];
  createdAt: string;
  updatedAt: string;
  salesRepId?: string; // For future authentication integration
  salesRepName?: string;
  tags?: string[];
  keywords?: string[]; // Extracted keywords for better searching
}

// Interface for the session index
interface SessionIndex {
  sessions: {
    id: string;
    title: string;
    sessionType: 'company' | 'general';
    updatedAt: string;
  }[];
}

/**
 * Save a new chat session
 */
export async function saveChatSession(session: Omit<StoredChatSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const baseUrl = getBaseUrl();
    const response = await axios.post(`${baseUrl}/api/storage/chat-operations?method=POST&action=save`, session);
    return response.data.sessionId;
  } catch (error) {
    logError('Failed to save chat session', error);
    throw new Error('Failed to save chat session');
  }
}

/**
 * List all chat sessions
 */
export async function listChatSessions(): Promise<SessionIndex['sessions']> {
  try {
    const baseUrl = getBaseUrl();
    const response = await axios.get(`${baseUrl}/api/storage/chat-operations?method=GET&action=list`);
    return response.data;
  } catch (error) {
    logError('Failed to list chat sessions', error);
    return [];
  }
}

/**
 * Get sessions by type
 */
export async function getSessionsByType(sessionType: 'company' | 'general'): Promise<SessionIndex['sessions']> {
  try {
    const baseUrl = getBaseUrl();
    const response = await axios.get(`${baseUrl}/api/storage/chat-operations?method=GET&action=list&type=${sessionType}`);
    return response.data;
  } catch (error) {
    logError(`Failed to get ${sessionType} sessions`, error);
    return [];
  }
}

/**
 * Search chat sessions by query text
 */
export async function searchChatSessions(query: string): Promise<SessionIndex['sessions']> {
  try {
    const baseUrl = getBaseUrl();
    const response = await axios.get(`${baseUrl}/api/admin/chat-sessions?search=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    logError('Failed to search chat sessions', error);
    return [];
  }
}

/**
 * Search chat sessions by content
 */
export async function searchChatSessionsByContent(query: string): Promise<SessionIndex['sessions']> {
  try {
    const baseUrl = getBaseUrl();
    const response = await axios.get(`${baseUrl}/api/admin/chat-sessions?content=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    logError('Failed to search chat sessions by content', error);
    return [];
  }
}

/**
 * Get a chat session by ID
 */
export async function getChatSession(sessionId: string): Promise<StoredChatSession | null> {
  try {
    const baseUrl = getBaseUrl();
    const response = await axios.get(`${baseUrl}/api/storage/chat-operations?method=GET&action=get&id=${sessionId}`);
    return response.data;
  } catch (error) {
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
export async function updateChatSession(
  sessionId: string,
  updates: Partial<Omit<StoredChatSession, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> {
  try {
    const baseUrl = getBaseUrl();
    const response = await axios.put(`${baseUrl}/api/storage/chat-operations?method=PUT&action=update&id=${sessionId}`, updates);
    return response.data.success;
  } catch (error) {
    logError('Failed to update chat session', error);
    return false;
  }
}

/**
 * Delete a chat session
 */
export async function deleteChatSession(sessionId: string): Promise<boolean> {
  try {
    const baseUrl = getBaseUrl();
    const response = await axios.delete(`${baseUrl}/api/admin/chat-sessions?id=${sessionId}`);
    return response.data.success;
  } catch (error) {
    logError('Failed to delete chat session', error);
    return false;
  }
}

/**
 * Extract keywords from messages for better searching
 */
export function extractKeywords(messages: StoredChatMessage[]): string[] {
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
  const wordCount: Record<string, number> = {};
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
export function generateSessionTitle(messages: StoredChatMessage[]): string {
  // Default title
  const defaultTitle = `Chat Session ${new Date().toLocaleDateString()}`;
  
  // Find first user message
  const firstUserMessage = messages.find(msg => msg.role === 'user');
  if (!firstUserMessage) return defaultTitle;
  
  // Clean and truncate message
  const content = firstUserMessage.content.trim();
  if (content.length < 5) return defaultTitle;
  
  if (content.length <= 30) {
    return content.charAt(0).toUpperCase() + content.slice(1);
  }
  
  // Truncate longer messages
  return content.substring(0, 30).trim() + '...';
} 
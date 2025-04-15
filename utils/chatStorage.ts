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
import { logError, logInfo } from './logger';
import { CompanyInformation } from './perplexityClient';
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
    // If Supabase is enabled, use that
    if (useSupabase) {
      return await supabaseChatStorage.saveChatSession(session);
    }
    
    // Otherwise use file-based storage via API
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
    // If Supabase is enabled, use that
    if (useSupabase) {
      const result = await supabaseChatStorage.listChatSessions();
      if (!Array.isArray(result)) {
        logError('[chatStorage] listChatSessions from Supabase did not return an array', { 
          result, 
          type: typeof result,
          isArray: Array.isArray(result)
        });
        return []; // Always return an array
      }
      return result;
    }
    
    // Otherwise use file-based storage via API
    const baseUrl = getBaseUrl();
    const response = await axios.get(`${baseUrl}/api/storage/chat-operations?method=GET&action=list`);
    
    // Validate response data is an array
    if (!Array.isArray(response.data)) {
      logError('[chatStorage] Storage API did not return an array for listChatSessions', {
        responseData: response.data,
        type: typeof response.data
      });
      return []; // Always return an array
    }
    
    return response.data;
  } catch (error) {
    logError('Failed to list chat sessions', error);
    return []; // Always return an empty array on error
  }
}

/**
 * Get sessions by type
 */
export async function getSessionsByType(sessionType: 'company' | 'general'): Promise<SessionIndex['sessions']> {
  try {
    // If Supabase is enabled, use that
    if (useSupabase) {
      return await supabaseChatStorage.getSessionsByType(sessionType);
    }
    
    // Otherwise use file-based storage via API
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
    // If Supabase is enabled, use that
    if (useSupabase) {
      return await supabaseChatStorage.searchChatSessions(query);
    }
    
    // Otherwise use file-based storage via API
    const baseUrl = getBaseUrl();
    // Call the storage operations endpoint for searching
    const response = await axios.get(`${baseUrl}/api/storage/chat-operations?method=GET&action=search&query=${encodeURIComponent(query)}`);
    // Assuming the storage endpoint returns the sessions array directly or nested under 'sessions'
    return response.data.sessions || response.data || []; 
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
    // If Supabase is enabled, use that
    if (useSupabase) {
      return await supabaseChatStorage.searchChatSessionsByContent(query);
    }
    
    // Otherwise use file-based storage via API
    const baseUrl = getBaseUrl();
    // Call the storage operations endpoint for content searching
    const response = await axios.get(`${baseUrl}/api/storage/chat-operations?method=GET&action=searchContent&query=${encodeURIComponent(query)}`);
    // Assuming the storage endpoint returns the sessions array directly or nested under 'sessions'
    return response.data.sessions || response.data || [];
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
    // If Supabase is enabled, use that
    if (useSupabase) {
      return await supabaseChatStorage.getChatSession(sessionId);
    }
    
    // Otherwise use file-based storage via API
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
    // If Supabase is enabled, use that
    if (useSupabase) {
      return await supabaseChatStorage.updateChatSession(sessionId, updates);
    }
    
    // Otherwise use file-based storage via API
    const baseUrl = getBaseUrl();
    
    // Use the chat-operations endpoint instead of admin endpoint to avoid auth issues
    const response = await axios.put(
      `${baseUrl}/api/storage/chat-operations`, 
      { id: sessionId, ...updates }
    );
    
    return response.data.success;
  } catch (error) {
    logError('Failed to update chat session', error);
    
    // Log more details if it's an HTTP error
    if (axios.isAxiosError(error)) {
      logError('HTTP Error Status:', error.response?.status);
      logError('HTTP Error Response:', error.response?.data);
    }
    
    return false;
  }
}

/**
 * Delete a chat session
 */
export async function deleteChatSession(sessionId: string): Promise<boolean> {
  try {
    // If Supabase is enabled, use that
    if (useSupabase) {
      return await supabaseChatStorage.deleteChatSession(sessionId);
    }
    
    // Otherwise use file-based storage via API
    const baseUrl = getBaseUrl();
    const response = await axios.delete(`${baseUrl}/api/storage/chat-operations?id=${sessionId}`);
    return response.data.success;
  } catch (error) {
    logError('Failed to delete chat session', error);
    return false;
  }
}

// Reexport utility functions from supabaseChatStorage
export const { extractKeywords, generateSessionTitle } = useSupabase 
  ? supabaseChatStorage 
  : require('./chatStorageUtils'); 
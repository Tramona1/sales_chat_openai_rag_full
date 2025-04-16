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
 * Enhanced version of saveChatSession that works reliably in Vercel production environment
 * 
 * This implementation tries multiple storage methods in order:
 * 1. Directly using Supabase (preferred in production/Vercel)
 * 2. Using localStorage (for client-side storage when possible)
 * 3. Using the storage API (as a fallback)
 */
export async function saveChatSession(session: Omit<StoredChatSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  const fullSession: StoredChatSession = {
    ...session,
    id,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  
  try {
    // In Vercel, try to use Supabase directly first
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      // Import Vercel-specific client
      const { getVercelSupabaseAdmin } = await import('./vercelSupabaseClient');
      const supabase = getVercelSupabaseAdmin(); // Use Vercel client
      
      if (supabase) {
        const { data, error } = await supabase
          .from('chat_sessions')
          .insert(fullSession);
          
        if (!error) {
          console.log('Chat session saved to Supabase');
          return id;
        } else {
          console.error('Error saving to Supabase:', error);
          // Continue to fallback methods
        }
      }
    }
    
    // For development environments, try to use local storage API
    console.log('Falling back to storage API for chat session persistence');
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/storage/chat-operations?operation=save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fullSession)
    });
    
    if (!response.ok) {
      console.error('Failed to save chat session via API');
      // Return the ID anyway - we at least tried to save
      return id;
    }
    
    return id;
  } catch (error) {
    console.error('Error saving chat session:', error);
    // Return the ID even if saving fails
    return id;
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
 * Enhanced version of getChatSession that works reliably in Vercel production environment
 * 
 * This implementation tries multiple storage methods in order:
 * 1. Directly using Supabase (preferred in production/Vercel)
 * 2. Using the storage API (as a fallback)
 */
export async function getChatSession(sessionId: string): Promise<StoredChatSession | null> {
  try {
    // In Vercel, try to use Supabase directly first
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      // Import Vercel-specific client
      const { getVercelSupabaseAdmin } = await import('./vercelSupabaseClient');
      const supabase = getVercelSupabaseAdmin(); // Use Vercel client
      
      if (supabase) {
        const { data, error } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
          
        if (!error && data) {
          return data as StoredChatSession;
        } else {
          console.error('Error fetching from Supabase:', error);
          // Continue to fallback methods
        }
      }
    }
    
    // For development environments, try to use local storage API
    console.log('Falling back to storage API for chat session retrieval');
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/storage/chat-operations?operation=get&id=${sessionId}`);
    
    if (!response.ok) {
      console.error('Failed to fetch chat session via API');
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting chat session:', error);
    return null;
  }
}

/**
 * Enhanced version of updateChatSession that works reliably in Vercel production environment
 * 
 * This implementation tries multiple storage methods in order:
 * 1. Directly using Supabase (preferred in production/Vercel)
 * 2. Using the storage API (as a fallback)
 */
export async function updateChatSession(
  sessionId: string,
  updates: Partial<Omit<StoredChatSession, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> {
  try {
    const timestamp = new Date().toISOString();
    const updatedData = {
      ...updates,
      updatedAt: timestamp
    };
    
    // In Vercel, try to use Supabase directly first
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      // Import Vercel-specific client
      const { getVercelSupabaseAdmin } = await import('./vercelSupabaseClient');
      const supabase = getVercelSupabaseAdmin(); // Use Vercel client
      
      if (supabase) {
        const { data, error } = await supabase
          .from('chat_sessions')
          .update(updatedData)
          .eq('id', sessionId);
          
        if (!error) {
          return true;
        } else {
          console.error('Error updating in Supabase:', error);
          // Continue to fallback methods
        }
      }
    }
    
    // For development environments, try to use local storage API
    console.log('Falling back to storage API for chat session update');
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/storage/chat-operations?operation=update&id=${sessionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedData)
    });
    
    if (!response.ok) {
      console.error('Failed to update chat session via API');
      return false;
    }
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error updating chat session:', error);
    return false;
  }
}

/**
 * Enhanced version of deleteChatSession that works reliably in Vercel production environment
 */
export async function deleteChatSession(sessionId: string): Promise<boolean> {
  try {
    // In Vercel, try to use Supabase directly first
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      // Import Vercel-specific client
      const { getVercelSupabaseAdmin } = await import('./vercelSupabaseClient');
      const supabase = getVercelSupabaseAdmin(); // Use Vercel client
      
      if (supabase) {
        const { error } = await supabase
          .from('chat_sessions')
          .delete()
          .eq('id', sessionId);
          
        if (!error) {
          return true;
        } else {
          console.error('Error deleting from Supabase:', error);
          // Continue to fallback methods
        }
      }
    }
    
    // For development environments, try to use local storage API
    console.log('Falling back to storage API for chat session deletion');
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/storage/chat-operations?operation=delete&id=${sessionId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      console.error('Failed to delete chat session via API');
      return false;
    }
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error deleting chat session:', error);
    return false;
  }
}

// Reexport utility functions from supabaseChatStorage
export const { extractKeywords, generateSessionTitle } = useSupabase 
  ? supabaseChatStorage 
  : require('./chatStorageUtils'); 
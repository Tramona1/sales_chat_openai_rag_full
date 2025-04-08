/**
 * Chat Storage Utility
 *
 * Manages persistent storage of chat sessions, including:
 * - Company information (for company chat)
 * - General chat sessions
 * - Sales rep notes
 * - Chat history
 */
import { CompanyInformation } from './perplexityClient';
export interface StoredChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
}
export interface StoredChatSession {
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
    }[];
}
/**
 * Save a new chat session
 */
export declare function saveChatSession(session: Omit<StoredChatSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
/**
 * List all chat sessions
 */
export declare function listChatSessions(): Promise<SessionIndex['sessions']>;
/**
 * Get sessions by type
 */
export declare function getSessionsByType(sessionType: 'company' | 'general'): Promise<SessionIndex['sessions']>;
/**
 * Search chat sessions by query text
 */
export declare function searchChatSessions(query: string): Promise<SessionIndex['sessions']>;
/**
 * Search chat sessions by content
 */
export declare function searchChatSessionsByContent(query: string): Promise<SessionIndex['sessions']>;
/**
 * Get a chat session by ID
 */
export declare function getChatSession(sessionId: string): Promise<StoredChatSession | null>;
/**
 * Update an existing chat session
 */
export declare function updateChatSession(sessionId: string, updates: Partial<Omit<StoredChatSession, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean>;
/**
 * Delete a chat session
 */
export declare function deleteChatSession(sessionId: string): Promise<boolean>;
/**
 * Extract keywords from messages for better searching
 */
export declare function extractKeywords(messages: StoredChatMessage[]): string[];
/**
 * Generate a title for a chat session based on messages
 */
export declare function generateSessionTitle(messages: StoredChatMessage[]): string;
export {};

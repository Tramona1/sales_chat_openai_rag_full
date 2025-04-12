/**
 * Chat Storage Utilities
 * 
 * This file contains utility functions for the file-based chat storage,
 * which are used when Supabase is not enabled.
 */

import { StoredChatMessage } from './chatStorage';

/**
 * Extract keywords from messages for better searching
 */
export function extractKeywords(messages: StoredChatMessage[]): string[] {
  // Return empty array if no messages
  if (!messages || messages.length === 0) {
    return [];
  }

  // Simple keyword extraction - in production, you'd use NLP techniques
  const allText = messages
    .filter(msg => msg && typeof msg.content === 'string') // Add null checks
    .map(msg => msg.content)
    .join(' ')
    .toLowerCase();
  
  // Return empty array if the combined text is too short
  if (allText.length < 10) {
    return [];
  }
  
  // More thorough cleaning of text
  const cleanText = allText
    .replace(/[^\w\s]/g, ' ') // Replace non-alphanumeric with spaces
    .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
    .trim();
  
  // Expanded stopword list for better filtering
  const stopwords = [
    'the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 
    'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 
    'had', 'do', 'does', 'did', 'but', 'if', 'or', 'because', 'as', 'until', 
    'while', 'that', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 
    'then', 'than', 'so', 'can', 'could', 'will', 'would', 'should', 'ought', 
    'now', 'about', 'each', 'both'
  ];
  
  // Split into words and filter more intelligently
  const words = cleanText.split(' ')
    .filter(word => {
      // Filter out empty strings, short words, numbers, and stopwords
      return word &&
        word.length > 3 &&                   // Longer than 3 characters
        !stopwords.includes(word) &&         // Not a stopword
        isNaN(Number(word)) &&               // Not just a number
        !/^\d+$/.test(word);                 // Not just a numeric string
    });
  
  // Return empty array if no words left after filtering
  if (words.length === 0) {
    return [];
  }
  
  // Count word frequency
  const wordCount: Record<string, number> = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  // Sort by frequency and return top 15 keywords (increased from 10)
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
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
  
  // Make sure content exists and is a string
  if (!firstUserMessage.content) return defaultTitle;
  
  // Clean and truncate message - safely convert to string if needed
  const content = typeof firstUserMessage.content === 'string' 
    ? firstUserMessage.content.trim()
    : String(firstUserMessage.content).trim();
    
  if (content.length < 5) return defaultTitle;
  
  if (content.length <= 30) {
    return content.charAt(0).toUpperCase() + content.slice(1);
  }
  
  // Truncate longer messages
  return content.substring(0, 30).trim() + '...';
} 
import type { NextApiRequest, NextApiResponse } from 'next';
import { logError } from '@/utils/errorHandling';

// Interface for feedback items
interface FeedbackItem {
  id: string;
  messageIndex: number;
  query: string;
  response: string;
  feedback: 'positive' | 'negative';
  queryTopics: string[];
  sessionId?: string;
  timestamp: number;
  userId?: string;
  metadata?: Record<string, any>;
}

// In-memory storage for development (would be replaced with a database in production)
let feedbackData: FeedbackItem[] = [];

// Load initial data if available (this runs only on the server)
try {
  // This is only for development purposes to have persistent data between API calls
  // In production, this would be replaced with a database connection
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(process.cwd(), 'data');
    const feedbackFile = path.join(dataDir, 'feedback.json');
    
    if (fs.existsSync(feedbackFile)) {
      const data = fs.readFileSync(feedbackFile, 'utf8');
      feedbackData = JSON.parse(data);
    }
  }
} catch (error) {
  console.error('Error loading initial feedback data', error);
  // Continue with empty array if loading fails
}

// API endpoint to handle feedback operations
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Simple authorization check (should be enhanced in production)
  const adminKey = req.headers['x-admin-key'] as string;
  const isAuthorized = 
    adminKey === process.env.ADMIN_API_KEY || 
    process.env.NODE_ENV === 'development';
  
  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      const { sessionId, type } = req.query;
      
      // Filter by session ID if provided
      if (sessionId) {
        const sessionFeedback = feedbackData.filter(item => 
          item.sessionId === sessionId
        );
        return res.status(200).json(sessionFeedback);
      }
      
      // Filter by session type if provided
      if (type === 'company' || type === 'general') {
        const typeFeedback = feedbackData.filter(item => 
          item.metadata?.sessionType === type
        );
        return res.status(200).json(typeFeedback);
      }
      
      // Return all feedback if no filters
      return res.status(200).json(feedbackData);
    } else if (req.method === 'POST') {
      const feedback = req.body as Omit<FeedbackItem, 'id' | 'timestamp'>;
      
      // Generate unique ID and timestamp
      const id = `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      const timestamp = Date.now();
      
      // Create new feedback item
      const newFeedback: FeedbackItem = {
        ...feedback,
        id,
        timestamp
      };
      
      // Add to in-memory storage
      feedbackData.push(newFeedback);
      
      // In development, optionally persist to filesystem
      // This would be a database operation in production
      if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
        try {
          const fs = require('fs');
          const path = require('path');
          const dataDir = path.join(process.cwd(), 'data');
          const feedbackFile = path.join(dataDir, 'feedback.json');
          
          // Ensure directory exists
          if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
          }
          
          // Write data to file
          fs.writeFileSync(feedbackFile, JSON.stringify(feedbackData, null, 2));
        } catch (error) {
          console.error('Error persisting feedback data', error);
          // Continue even if persistence fails
        }
      }
      
      return res.status(201).json({ success: true, id });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    logError('Feedback API error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 
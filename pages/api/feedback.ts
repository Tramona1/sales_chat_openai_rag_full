import type { NextApiRequest, NextApiResponse } from 'next';
import { extractTopics } from '@/utils/feedbackManager';
import { logError } from '@/utils/errorHandling';
import axios from 'axios';

/**
 * API endpoint to record user feedback on assistant responses
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are allowed' });
  }

  try {
    const body = req.body;
    
    // Validate required fields
    if (!body.query || !body.response || !body.feedback || body.messageIndex === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate feedback type
    if (body.feedback !== 'positive' && body.feedback !== 'negative') {
      return res.status(400).json({ error: 'Invalid feedback type. Must be "positive" or "negative"' });
    }
    
    // Extract topics from the query
    const queryTopics = extractTopics(body.query);
    
    // Process metadata
    const metadata = {
      ...(body.metadata || {}),
      sessionType: body.sessionId ? 'company' : 'general',
      timestamp: new Date().toISOString(),
    };

    // Add sessionId to metadata if available
    if (body.sessionId) {
      metadata.sessionId = body.sessionId;
    }
    
    // Prepare the feedback payload
    const feedbackPayload = {
      query: body.query,
      response: body.response,
      feedback: body.feedback,
      messageIndex: body.messageIndex,
      queryTopics,
      sessionId: body.sessionId,
      userId: body.userId,
      metadata
    };
    
    // Use our admin API to store the feedback
    // In production you'd want to use a more secure method than accessing another API route directly
    const adminKey = process.env.ADMIN_API_KEY || 'dev-key';
    
    // Fix URL formation - use server-side URL construction since this is an API route
    // Get host from request headers
    const host = req.headers.host || 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    
    const response = await axios.post(
      `${baseUrl}/api/admin/feedback`,
      feedbackPayload,
      {
        headers: {
          'x-admin-key': adminKey
        }
      }
    );
    
    return res.status(200).json({
      success: true,
      id: response.data.id
    });
    
  } catch (error) {
    logError('Error recording feedback', error);
    
    return res.status(500).json({ error: 'Failed to record feedback' });
  }
} 
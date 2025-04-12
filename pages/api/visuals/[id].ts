import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getVisual,
  readVisualContent,
  visualExists
} from '../../../utils/visualStorageManager';
import { recordMetric } from '../../../utils/performanceMonitoring';

/**
 * API endpoint for retrieving visual content
 * Supports thumbnails and download options
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  
  try {
    // Get visual ID from the URL
    const { id } = req.query;
    
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: 'Invalid visual ID' });
    }
    
    // Check if the visual exists
    const exists = await visualExists(id);
    if (!exists) {
      return res.status(404).json({ error: 'Visual not found' });
    }
    
    // Get visual metadata
    const visual = await getVisual(id);
    if (!visual) {
      return res.status(404).json({ error: 'Visual metadata not found' });
    }
    
    // Check if we should return the thumbnail
    const useThumbnail = req.query.thumbnail === 'true';
    
    // Read the visual content
    const content = await readVisualContent(id, useThumbnail);
    if (!content) {
      return res.status(404).json({ error: 'Visual content not found' });
    }
    
    // Set appropriate content type header
    res.setHeader('Content-Type', visual.mimeType);
    
    // Set cache control headers (cache for 1 day)
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    // Check if we should force download
    if (req.query.download === 'true') {
      res.setHeader(
        'Content-Disposition', 
        `attachment; filename="${visual.originalFilename}"`
      );
    }
    
    // Record performance metric
    const duration = Date.now() - startTime;
    recordMetric(
      'visualApi',
      'getVisual',
      duration,
      true,
      { 
        visualId: id,
        visualType: visual.type,
        useThumbnail,
        fileSize: content.length
      }
    );
    
    // Return the visual content
    return res.status(200).send(content);
  } catch (error) {
    console.error('Error serving visual content:', error);
    
    // Record error metric
    const duration = Date.now() - startTime;
    recordMetric(
      'visualApi',
      'getVisual',
      duration,
      false,
      {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    );
    
    return res.status(500).json({ error: 'Internal server error' });
  }
} 
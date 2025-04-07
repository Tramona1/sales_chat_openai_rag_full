import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getCacheStats } from '../../utils/caching';
import { getVectorStoreSize } from '../../utils/vectorStore';
import { standardizeApiErrorResponse } from '../../utils/errorHandling';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // Get vector store statistics
    const vectorStoreStats = {
      totalItems: await getVectorStoreSize()
    };
    
    // Get caching statistics
    const cachingStats = getCacheStats();
    
    // Get feedback data size
    const feedbackPath = path.join(process.cwd(), 'feedback.json');
    let feedbackStats: {
      count: number;
      lastUpdated: Date | null;
      sizeBytes: number;
    } = {
      count: 0,
      lastUpdated: null,
      sizeBytes: 0
    };
    
    if (fs.existsSync(feedbackPath)) {
      const feedbackData = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
      const fileStats = fs.statSync(feedbackPath);
      
      feedbackStats = {
        count: feedbackData.length,
        lastUpdated: fileStats.mtime,
        sizeBytes: fileStats.size
      };
    }
    
    // Calculate recent query metrics from feedback data
    let recentQueriesMetrics = {
      last24Hours: 0,
      last7Days: 0, 
      avgResponseTime: 0
    };
    
    if (feedbackStats.count > 0) {
      const feedbackData = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      
      recentQueriesMetrics = {
        last24Hours: feedbackData.filter((item: any) => item.timestamp > oneDayAgo).length,
        last7Days: feedbackData.filter((item: any) => item.timestamp > sevenDaysAgo).length,
        avgResponseTime: 0 // This would require timing data that we don't currently store
      };
    }
    
    // Combine all stats
    const systemMetrics = {
      vectorStore: vectorStoreStats,
      caching: cachingStats,
      feedback: feedbackStats,
      queries: recentQueriesMetrics,
      lastUpdated: new Date().toISOString()
    };
    
    return res.status(200).json(systemMetrics);
  } catch (error) {
    console.error('Error retrieving system metrics:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
} 
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getCacheStats } from '../../utils/caching';
import { standardizeApiErrorResponse } from '../../utils/errorHandling';
import { supabaseAdmin } from '../../utils/supabaseClient';
import { logInfo, logError } from '../../utils/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // Get vector store statistics from Supabase
    let vectorStoreStats = { 
      totalItems: 0,
      documents: 0,
      chunks: 0
    };
    
    try {
      logInfo('Fetching document statistics from Supabase');
      
      // Get document count
      const { count: documentCount, error: docError } = await supabaseAdmin
        .from('documents')
        .select('*', { count: 'exact', head: true });
      
      if (docError) {
        throw new Error(`Error counting documents: ${docError.message}`);
      }
      
      // Get chunk count
      const { count: chunkCount, error: chunkError } = await supabaseAdmin
        .from('document_chunks')
        .select('*', { count: 'exact', head: true });
      
      if (chunkError) {
        throw new Error(`Error counting document chunks: ${chunkError.message}`);
      }
      
      vectorStoreStats = {
        totalItems: chunkCount || 0,
        documents: documentCount || 0,
        chunks: chunkCount || 0
      };
      
      logInfo(`Retrieved document statistics: ${documentCount} documents, ${chunkCount} chunks`);
    } catch (dbError) {
      logError('Error fetching Supabase document statistics:', dbError);
      // Continue with zeros, don't fail the entire request
    }
    
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
      try {
        const feedbackData = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
        const fileStats = fs.statSync(feedbackPath);
        
        feedbackStats = {
          count: Array.isArray(feedbackData) ? feedbackData.length : 0,
          lastUpdated: fileStats.mtime,
          sizeBytes: fileStats.size
        };
      } catch (feedbackError) {
        logError('Error reading feedback data:', feedbackError);
        // Continue with default values
      }
    }
    
    // Calculate recent query metrics from feedback data
    let recentQueriesMetrics = {
      last24Hours: 0,
      last7Days: 0, 
      avgResponseTime: 0
    };
    
    if (feedbackStats.count > 0) {
      try {
        const feedbackData = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
        
        if (Array.isArray(feedbackData)) {
          recentQueriesMetrics = {
            last24Hours: feedbackData.filter((item: any) => item.timestamp > oneDayAgo).length,
            last7Days: feedbackData.filter((item: any) => item.timestamp > sevenDaysAgo).length,
            avgResponseTime: 0 // This would require timing data that we don't currently store
          };
        }
      } catch (metricsError) {
        logError('Error calculating query metrics:', metricsError);
        // Continue with default values
      }
    }
    
    // Get performance metrics from Supabase if available
    let performanceMetrics = {
      averageQueryTime: 0,
      totalQueries: 0
    };
    
    try {
      // We could query a performance_metrics table here if it exists
      // This is a placeholder for future implementation
    } catch (perfError) {
      // Just continue with defaults
    }
    
    // Combine all stats
    const systemMetrics = {
      vectorStore: vectorStoreStats,
      caching: cachingStats,
      feedback: feedbackStats,
      queries: recentQueriesMetrics,
      performance: performanceMetrics,
      lastUpdated: new Date().toISOString()
    };
    
    logInfo('Successfully retrieved system metrics');
    return res.status(200).json(systemMetrics);
  } catch (error) {
    logError('Error retrieving system metrics:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
} 
import { NextApiRequest, NextApiResponse } from 'next';
import { createServiceClient } from '@/utils/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Parse query parameters
    const { start, end, limit = 10 } = req.query;
    
    // Validate required parameters
    if (!start || !end) {
      return res.status(400).json({ error: 'Missing required query parameters: start and end' });
    }

    // Create Supabase client
    const supabase = createServiceClient();

    // Query for search queries with zero results
    const { data, error } = await supabase
      .from('search_queries_aggregated')
      .select('*')
      .gt('zero_results_count', 0)
      .order('zero_results_count', { ascending: false })
      .limit(parseInt(limit as string, 10) || 10);

    if (error) {
      console.error('Error fetching zero result queries:', error);
      return res.status(500).json({ error: 'Failed to fetch zero result queries' });
    }

    return res.status(200).json(data || []);
  } catch (error) {
    console.error('Error in zero-results API:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
} 
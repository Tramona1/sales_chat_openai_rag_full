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

    // Use the top_searches view to get data
    const { data, error } = await supabase
      .from('v_top_searches')
      .select('*')
      .limit(parseInt(limit as string, 10) || 10);

    if (error) {
      console.error('Error fetching top searches:', error);
      return res.status(500).json({ error: 'Failed to fetch top searches' });
    }

    return res.status(200).json(data || []);
  } catch (error) {
    console.error('Error in top-searches API:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
} 
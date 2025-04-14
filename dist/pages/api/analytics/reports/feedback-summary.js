import { createServiceClient } from '@/utils/supabaseClient';
export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
        // Parse query parameters
        const { start, end } = req.query;
        // Validate required parameters
        if (!start || !end) {
            return res.status(400).json({ error: 'Missing required query parameters: start and end' });
        }
        // Create Supabase client
        const supabase = createServiceClient();
        // Use the user_feedback_summary view to get data
        const { data, error } = await supabase
            .from('v_user_feedback_summary')
            .select('*');
        if (error) {
            console.error('Error fetching feedback summary:', error);
            return res.status(500).json({ error: 'Failed to fetch feedback summary' });
        }
        return res.status(200).json(data || []);
    }
    catch (error) {
        console.error('Error in feedback-summary API:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

import { extractTopics } from '@/utils/feedbackManager';
import { logError, logInfo } from '@/utils/logger';
import { createServiceClient } from '@/utils/supabaseClient';
/**
 * API endpoint to record user feedback on assistant responses
 */
export default async function handler(req, res) {
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
        // Create Supabase client
        const supabase = createServiceClient();
        // Format data for Supabase (using snake_case)
        const feedbackData = {
            query: body.query,
            response: body.response,
            feedback: body.feedback,
            message_index: body.messageIndex,
            query_topics: queryTopics,
            session_id: body.sessionId || null,
            user_id: body.userId || null,
            metadata
        };
        // Insert into Supabase
        const { data, error } = await supabase
            .from('feedback')
            .insert(feedbackData)
            .select('id')
            .single();
        if (error) {
            logError('Error storing feedback in Supabase', error);
            // Fall back to just logging it
            console.log('Feedback data (fallback - could not store in DB):', feedbackData);
            return res.status(200).json({
                success: true,
                id: `fallback_${Date.now()}`,
                message: 'Feedback logged (fallback method)'
            });
        }
        logInfo(`Feedback recorded with ID: ${data.id}`);
        return res.status(200).json({
            success: true,
            id: data.id,
            message: 'Feedback recorded successfully'
        });
    }
    catch (error) {
        logError('Error recording feedback', error);
        console.error('Feedback API error:', error);
        // Still return a 200 to prevent UI errors, but indicate the issue
        return res.status(200).json({
            success: false,
            error: 'Failed to record feedback, but the error was handled gracefully'
        });
    }
}

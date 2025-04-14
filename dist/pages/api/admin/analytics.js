import { logError } from '@/utils/logger';
import axios from 'axios';
/**
 * Generate analytics data from feedback items
 */
async function generateAnalytics() {
    try {
        // Get all feedback from our feedback API
        // In production, this would directly query the database
        const adminKey = process.env.ADMIN_API_KEY || 'dev-key';
        // Fix URL formation for server-side API calls
        // Since this runs on the server, we need to construct a complete URL
        // This would be replaced with direct database access in production
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
        const host = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'localhost:3000';
        const baseUrl = `${protocol}://${host}`;
        const response = await axios.get(`${baseUrl}/api/admin/feedback`, {
            headers: {
                'x-admin-key': adminKey
            }
        });
        const feedbackItems = response.data;
        // Calculate feedback stats
        const totalFeedback = feedbackItems.length;
        const positiveFeedback = feedbackItems.filter(item => item.feedback === 'positive').length;
        // Process common queries
        const queryMap = new Map();
        // Process content references
        const contentMap = new Map();
        // Track sessions
        const companySessionIds = new Set();
        const generalSessionIds = new Set();
        const companiesEngaged = new Set();
        // Process each feedback item
        feedbackItems.forEach(item => {
            // Track query stats
            const queryKey = item.query.toLowerCase().trim();
            const existingQuery = queryMap.get(queryKey) || {
                count: 0,
                positiveCount: 0,
                negativeCount: 0,
                lastAsked: 0
            };
            existingQuery.count += 1;
            if (item.feedback === 'positive') {
                existingQuery.positiveCount += 1;
            }
            else {
                existingQuery.negativeCount += 1;
            }
            existingQuery.lastAsked = Math.max(existingQuery.lastAsked, item.timestamp);
            queryMap.set(queryKey, existingQuery);
            // Track content references
            if (item.metadata?.references) {
                for (const ref of item.metadata.references) {
                    const contentKey = ref.source || 'unknown';
                    const existingContent = contentMap.get(contentKey) || {
                        references: 0,
                        positiveCount: 0,
                        negativeCount: 0
                    };
                    existingContent.references += 1;
                    if (item.feedback === 'positive') {
                        existingContent.positiveCount += 1;
                    }
                    else {
                        existingContent.negativeCount += 1;
                    }
                    contentMap.set(contentKey, existingContent);
                }
            }
            // Track session types
            if (item.sessionId) {
                if (item.metadata?.sessionType === 'company') {
                    companySessionIds.add(item.sessionId);
                    if (item.metadata?.companyName) {
                        companiesEngaged.add(item.metadata.companyName);
                    }
                }
                else {
                    generalSessionIds.add(item.sessionId);
                }
            }
        });
        // Format common queries
        const commonQueries = Array.from(queryMap.entries())
            .map(([query, stats]) => ({
            query,
            ...stats
        }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        // Format content references
        const topReferencedContent = Array.from(contentMap.entries())
            .map(([source, stats]) => ({
            source,
            ...stats
        }))
            .sort((a, b) => b.references - a.references)
            .slice(0, 10);
        // Calculate session stats
        const sessionStats = {
            companyChats: companySessionIds.size,
            generalChats: generalSessionIds.size,
            companiesEngaged: Array.from(companiesEngaged),
            averageFeedbackPerSession: totalFeedback / Math.max(1, companySessionIds.size + generalSessionIds.size),
            totalSessions: companySessionIds.size + generalSessionIds.size
        };
        return {
            commonQueries,
            topReferencedContent,
            feedbackStats: {
                total: totalFeedback,
                positive: positiveFeedback,
                negative: totalFeedback - positiveFeedback,
                percentagePositive: totalFeedback > 0 ? (positiveFeedback / totalFeedback) * 100 : 0
            },
            lastUpdated: Date.now(),
            sessionStats
        };
    }
    catch (error) {
        logError('Failed to generate analytics', error);
        // Return empty analytics on error
        return {
            commonQueries: [],
            topReferencedContent: [],
            feedbackStats: {
                total: 0,
                positive: 0,
                negative: 0,
                percentagePositive: 0
            },
            lastUpdated: Date.now()
        };
    }
}
/**
 * API endpoint to retrieve feedback analytics
 * Used by the admin dashboard to show insights about user questions and content usage
 */
export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed', message: 'Only GET requests are allowed' });
    }
    try {
        // Simple authorization check (should be enhanced in production)
        const adminKey = req.headers['x-admin-key'];
        const isAuthorized = adminKey === process.env.ADMIN_API_KEY ||
            process.env.NODE_ENV === 'development';
        if (!isAuthorized) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Generate analytics data
        const analytics = await generateAnalytics();
        // Return the analytics data
        return res.status(200).json(analytics);
    }
    catch (error) {
        logError('Error retrieving analytics', error);
        return res.status(500).json({ error: 'Failed to retrieve analytics data' });
    }
}

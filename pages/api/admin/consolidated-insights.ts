import { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '../../../utils/supabaseClient';
import { logError, logInfo, logDebug, logWarning } from '../../../utils/logger';
import { standardizeApiErrorResponse } from '../../../utils/errorHandling';

// Interfaces matching the frontend component
interface ConsolidatedQueryStats {
    totalQueries: number;
    avgQueryLength: number; // Calculated from fetched topics
    avgResponseTime: number; // Placeholder - Requires performance data source
    noResultRate: number; // Placeholder - Requires 'no result' tracking
    avgFeedbackScore?: number; // Placeholder - Requires feedback aggregation
}

interface TopicInsight {
    topic: string;
    count: number;
    sessionTypes: { company: number; general: number };
    avgResponseTime?: number; // Placeholder
    feedback?: { positive: number; negative: number }; // Calculated from feedback logs
    noResultCount?: number; // Placeholder
    lastOccurrence: string; // ISO string
}

interface ConsolidatedInsightsData {
    stats: ConsolidatedQueryStats;
    topTopics: TopicInsight[];
    noResultTopics: TopicInsight[]; // Placeholder
    negativeFeedbackTopics: TopicInsight[];
    // productMentions?: ProductMentionInsight[]; // Add later
}

// Define the expected structure returned by the RPC function
interface RpcQueryResult {
    topic: string; // This is the user_query from query_logs
    total_count: number;
    company_count: number;
    general_count: number;
    last_occurrence: string; // Should be timestamptz string
    // Add query_log_ids if possible from RPC, otherwise fetch separately
    query_log_ids?: string[]; // Array of UUIDs corresponding to this topic
}

// Interface for feedback fetched from DB
interface FeedbackFromDb {
    query_log_id: string; // UUID
    feedback: 'positive' | 'negative';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        logError('[API /api/admin/consolidated-insights] Supabase admin client not available.');
        return res.status(500).json(standardizeApiErrorResponse({ message: 'Database connection error' }));
    }

    logInfo('[API /api/admin/consolidated-insights] Request received');

    try {
        // Extract and validate query parameters
        const timeRange = typeof req.query.timeRange === 'string' ? req.query.timeRange : '7d';
        const sessionType = typeof req.query.sessionType === 'string' ? req.query.sessionType : 'all';
        const validTimeRanges = ['24h', '7d', '30d', 'all'];
        const validSessionTypes = ['all', 'company', 'general'];

        const validatedTimeRange = validTimeRanges.includes(timeRange) ? timeRange : '7d';
        const validatedSessionType = validSessionTypes.includes(sessionType) ? sessionType : 'all';
        const rpcInterval = validatedTimeRange === 'all' ? 'all' : validatedTimeRange === '24h' ? '1 day' : `${validatedTimeRange.replace('d','')} days`; // Convert '7d' to '7 days' etc.

        logDebug(`[API /api/admin/consolidated-insights] Filters - TimeRange: ${validatedTimeRange} (RPC Interval: ${rpcInterval}), SessionType: ${validatedSessionType}`);

        // --- 1. Fetch Aggregated Data via RPC ---
        const { data: rpcData, error: rpcError } = await supabase.rpc(
            'get_consolidated_query_insights',
            {
                time_filter_interval: rpcInterval,
                session_type_filter: validatedSessionType
            }
        );

        if (rpcError) {
            logError('[API /api/admin/consolidated-insights] Error calling RPC function:', rpcError);
            throw new Error(`Database error fetching insights: ${rpcError.message}`);
        }

        const aggregatedTopics: RpcQueryResult[] = rpcData || [];
        logInfo(`[API /api/admin/consolidated-insights] RPC returned ${aggregatedTopics.length} aggregated topics.`);

        // --- 2. Fetch Relevant Feedback Data from DB ---
        // Extract all query_log_ids from the RPC results
        const allQueryLogIds = aggregatedTopics.flatMap(topic => topic.query_log_ids || []);
        let feedbackData: FeedbackFromDb[] = [];
        
        if (allQueryLogIds.length > 0) {
            logDebug(`[API /api/admin/consolidated-insights] Fetching feedback for ${allQueryLogIds.length} query log IDs.`);
            const { data: dbFeedback, error: feedbackError } = await supabase
                .from('feedback') // Use the confirmed table name
                .select('query_log_id, feedback') // Select necessary columns
                .in('query_log_id', allQueryLogIds) // Filter by relevant IDs
                .in('feedback', ['positive', 'negative']); // Only get relevant feedback types
            
            if (feedbackError) {
                logError('[API /api/admin/consolidated-insights] Error fetching feedback from DB:', feedbackError);
                // Continue without feedback data, but log the error
            } else {
                feedbackData = (dbFeedback || []) as FeedbackFromDb[];
                logInfo(`[API /api/admin/consolidated-insights] Fetched ${feedbackData.length} relevant feedback entries from DB.`);
            }
        } else {
             logWarning('[API /api/admin/consolidated-insights] No query log IDs returned from RPC, cannot fetch associated feedback.');
        }

        // Pre-process feedback into a map keyed by query_log_id for efficient lookup
        const feedbackMapByQueryLogId: Map<string, { positive: number; negative: number }> = new Map();
        for (const fb of feedbackData) {
            if (!feedbackMapByQueryLogId.has(fb.query_log_id)) {
                feedbackMapByQueryLogId.set(fb.query_log_id, { positive: 0, negative: 0 });
            }
            const counts = feedbackMapByQueryLogId.get(fb.query_log_id)!;
            if (fb.feedback === 'positive') counts.positive++;
            else if (fb.feedback === 'negative') counts.negative++;
        }
        logDebug(`[API /api/admin/consolidated-insights] Processed DB feedback into map with ${feedbackMapByQueryLogId.size} entries.`);


        // --- 3. Process & Format Results ---
        let totalQueryLengthSum = 0;
        const allTopics: TopicInsight[] = aggregatedTopics.map(item => {
            const topicText = item.topic.trim();
            totalQueryLengthSum += topicText.split(/\s+/).length * item.total_count; // Weighted length sum
            
            const topicFeedback = { positive: 0, negative: 0 };
            if (item.query_log_ids && Array.isArray(item.query_log_ids)) {
                for (const queryLogId of item.query_log_ids) {
                    const feedbackCounts = feedbackMapByQueryLogId.get(queryLogId);
                    if (feedbackCounts) {
                        topicFeedback.positive += feedbackCounts.positive;
                        topicFeedback.negative += feedbackCounts.negative;
                    }
                }
            }

            return {
                topic: topicText,
                count: Number(item.total_count || 0),
                sessionTypes: {
                    company: Number(item.company_count || 0),
                    general: Number(item.general_count || 0)
                },
                feedback: topicFeedback,
                lastOccurrence: item.last_occurrence
                // avgResponseTime: undefined, // Placeholder
                // noResultCount: undefined // Placeholder
            };
        });

        // --- 4. Calculate Overall Stats ---
        const totalQueries = aggregatedTopics.reduce((sum, item) => sum + Number(item.total_count || 0), 0);
        const stats: ConsolidatedQueryStats = {
            totalQueries: totalQueries,
            avgQueryLength: totalQueries > 0 ? parseFloat((totalQueryLengthSum / totalQueries).toFixed(1)) : 0,
            avgResponseTime: 0, // Placeholder
            noResultRate: 0, // Placeholder
            // avgFeedbackScore: 0 // Placeholder
        };

        // --- 5. Prepare Final Response ---
        const topTopics = allTopics;

        // Filter for Negative Feedback Topics & sort
        const negativeFeedbackTopics = allTopics
            .filter(topic => topic.feedback && topic.feedback.negative > 0)
            .sort((a, b) => {
                 // Primary sort: higher negative count first
                 const negDiff = (b.feedback?.negative ?? 0) - (a.feedback?.negative ?? 0);
                 if (negDiff !== 0) return negDiff;
                 // Secondary sort: higher total count first for ties
                 return b.count - a.count;
             });

        // Placeholder for No Result Topics
        const noResultTopics: TopicInsight[] = []; // Needs data source

        const responseData: ConsolidatedInsightsData = {
            stats: stats,
            topTopics: topTopics,
            noResultTopics: noResultTopics, // Placeholder
            negativeFeedbackTopics: negativeFeedbackTopics,
            // productMentions: [] // Placeholder
        };

        logInfo(`[API /api/admin/consolidated-insights] Sending ${responseData.topTopics.length} top topics, ${responseData.negativeFeedbackTopics.length} negative feedback topics.`);
        res.status(200).json(responseData);

    } catch (error: any) {
        logError('[API /api/admin/consolidated-insights] Failed to fetch consolidated insights:', error);
        res.status(500).json(standardizeApiErrorResponse({
            message: 'Failed to fetch consolidated insights data',
            details: error.message,
            code: 'insights_fetch_failed'
        }));
    }
} 
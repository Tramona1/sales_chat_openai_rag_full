/**
 * Feedback Management Utility
 *
 * Handles storage and retrieval of user feedback on assistant responses,
 * and provides analytics for improving content and training.
 */
export interface FeedbackItem {
    id: string;
    messageIndex: number;
    query: string;
    response: string;
    feedback: 'positive' | 'negative';
    queryTopics: string[];
    sessionId?: string;
    timestamp: number;
    userId?: string;
    metadata?: Record<string, any>;
}
export interface AnalyticsData {
    commonQueries: {
        query: string;
        count: number;
        positiveCount: number;
        negativeCount: number;
        lastAsked: number;
    }[];
    topReferencedContent: {
        source: string;
        references: number;
        positiveCount: number;
        negativeCount: number;
    }[];
    feedbackStats: {
        total: number;
        positive: number;
        negative: number;
        percentagePositive: number;
    };
    lastUpdated: number;
    sessionStats?: {
        companyChats: number;
        generalChats: number;
        companiesEngaged: string[];
        averageFeedbackPerSession: number;
        totalSessions: number;
    };
}
/**
 * Record user feedback for a response
 */
export declare function recordFeedback(feedback: Omit<FeedbackItem, 'id' | 'timestamp'>): Promise<string>;
/**
 * Get analytics data
 */
export declare function getAnalytics(): Promise<AnalyticsData>;
/**
 * Get all feedback entries
 */
export declare function getAllFeedback(): Promise<FeedbackItem[]>;
/**
 * Get feedback for a specific session
 */
export declare function getSessionFeedback(sessionId: string): Promise<FeedbackItem[]>;
/**
 * Extract common topics from a query
 */
export declare function extractTopics(query: string): string[];
/**
 * Get feedback by session type
 */
export declare function getFeedbackBySessionType(sessionType: 'company' | 'general'): Promise<FeedbackItem[]>;

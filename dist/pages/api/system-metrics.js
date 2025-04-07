"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const caching_1 = require("../../utils/caching");
const vectorStore_1 = require("../../utils/vectorStore");
const errorHandling_1 = require("../../utils/errorHandling");
async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    try {
        // Get vector store statistics
        const vectorStoreStats = {
            totalItems: await (0, vectorStore_1.getVectorStoreSize)()
        };
        // Get caching statistics
        const cachingStats = (0, caching_1.getCacheStats)();
        // Get feedback data size
        const feedbackPath = path_1.default.join(process.cwd(), 'feedback.json');
        let feedbackStats = {
            count: 0,
            lastUpdated: null,
            sizeBytes: 0
        };
        if (fs_1.default.existsSync(feedbackPath)) {
            const feedbackData = JSON.parse(fs_1.default.readFileSync(feedbackPath, 'utf8'));
            const fileStats = fs_1.default.statSync(feedbackPath);
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
            const feedbackData = JSON.parse(fs_1.default.readFileSync(feedbackPath, 'utf8'));
            const now = Date.now();
            const oneDayAgo = now - (24 * 60 * 60 * 1000);
            const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
            recentQueriesMetrics = {
                last24Hours: feedbackData.filter((item) => item.timestamp > oneDayAgo).length,
                last7Days: feedbackData.filter((item) => item.timestamp > sevenDaysAgo).length,
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
    }
    catch (error) {
        console.error('Error retrieving system metrics:', error);
        const errorResponse = (0, errorHandling_1.standardizeApiErrorResponse)(error);
        return res.status(500).json(errorResponse);
    }
}

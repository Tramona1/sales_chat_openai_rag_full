"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const vectorStore_1 = require("@/utils/vectorStore");
const conflictDetection_1 = require("@/utils/conflictDetection");
const errorHandling_1 = require("@/utils/errorHandling");
/**
 * API endpoint to get content conflicts in the knowledge base
 */
async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }
    try {
        // Get query parameters
        const useGemini = req.query.useGemini !== 'false'; // Default to true unless explicitly set to false
        const entityName = req.query.entity;
        // Get vector store items
        const vectorStoreItems = (0, vectorStore_1.getAllVectorStoreItems)();
        // Detect conflicts in documents with Gemini enhancement
        const conflicts = await (0, conflictDetection_1.detectDocumentConflicts)(vectorStoreItems, entityName, useGemini);
        // Return conflicts
        return res.status(200).json({
            conflicts,
            totalConflicts: conflicts.length,
            highPriorityConflicts: conflicts.filter(c => c.isHighPriority).length,
            usedGemini: useGemini
        });
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error retrieving conflicts:', error);
        return res.status(500).json({
            message: 'Failed to retrieve conflicts',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

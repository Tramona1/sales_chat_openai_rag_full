"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const errorHandling_1 = require("../../../utils/errorHandling");
const vectorStore_1 = require("../../../utils/vectorStore");
async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: { message: 'Method Not Allowed', code: 'method_not_allowed' } });
    }
    try {
        // Get the limit parameter (default to 100)
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
        // Get documents from vector store
        const vectorStoreItems = (0, vectorStore_1.getAllVectorStoreItems)();
        // Transform items to the format expected by the UI
        const documents = vectorStoreItems.slice(0, limit).map((item) => {
            var _a, _b, _c;
            return ({
                id: ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) || `doc-${Math.random().toString(36).substring(7)}`,
                source: ((_b = item.metadata) === null || _b === void 0 ? void 0 : _b.source) || 'Unknown Source',
                text: item.text,
                metadata: {
                    ...item.metadata,
                    // Ensure source is always available
                    source: ((_c = item.metadata) === null || _c === void 0 ? void 0 : _c.source) || 'Unknown Source',
                }
            });
        });
        // Return the documents
        return res.status(200).json({
            documents,
            total: vectorStoreItems.length,
            limit
        });
    }
    catch (error) {
        console.error('Error fetching documents:', error);
        const errorResponse = (0, errorHandling_1.standardizeApiErrorResponse)(error);
        return res.status(500).json(errorResponse);
    }
}

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
        // Get search parameters
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
        const searchTerm = req.query.search ? req.query.search.toLowerCase() : '';
        const contentType = req.query.contentType;
        const recentlyApproved = req.query.recentlyApproved === 'true';
        // Get documents from vector store
        console.log('Fetching vector store items...');
        const vectorStoreItems = (0, vectorStore_1.getAllVectorStoreItems)();
        console.log(`Retrieved ${vectorStoreItems.length} vector store items`);
        // Sort items by lastUpdated date (newest first) or any available date field
        console.log('Sorting items by recency...');
        const sortedItems = [...vectorStoreItems].sort((a, b) => {
            // Get timestamp from item metadata, trying different common date fields
            const getTimestamp = (item) => {
                if (!item.metadata)
                    return 0;
                // Cast to our extended metadata type
                const meta = item.metadata;
                // Try different date fields in order of preference
                const dateField = meta.lastUpdated || meta.timestamp || meta.createdAt;
                if (dateField) {
                    try {
                        return new Date(dateField).getTime();
                    }
                    catch (e) {
                        return 0;
                    }
                }
                return 0;
            };
            const timestampA = getTimestamp(a);
            const timestampB = getTimestamp(b);
            // Sort newest first
            return timestampB - timestampA;
        });
        // If we have a search term, filter the items before limiting
        let filteredItems = sortedItems;
        if (searchTerm) {
            console.log(`Searching for "${searchTerm}" in ${sortedItems.length} documents`);
            filteredItems = sortedItems.filter(item => {
                var _a;
                // Search in text content
                const textMatch = item.text && item.text.toLowerCase().includes(searchTerm);
                // Search in source
                const sourceMatch = ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) &&
                    item.metadata.source.toLowerCase().includes(searchTerm);
                // Search in other metadata fields that might contain relevant information
                const metadataMatch = item.metadata && Object.entries(item.metadata).some(([key, value]) => {
                    // Skip source since we already checked it
                    if (key === 'source')
                        return false;
                    // Check if the value is a string and contains the search term
                    return typeof value === 'string' && value.toLowerCase().includes(searchTerm);
                });
                return textMatch || sourceMatch || metadataMatch;
            });
            console.log(`Found ${filteredItems.length} matching documents`);
        }
        // Filter by content type if specified
        if (contentType && contentType !== 'all') {
            filteredItems = filteredItems.filter(item => {
                // Safely check if contentType exists in metadata
                const itemContentType = item.metadata && item.metadata.contentType;
                return itemContentType === contentType;
            });
            console.log(`Filtered to ${filteredItems.length} documents with content type: ${contentType}`);
        }
        // Filter recently approved items if requested
        if (recentlyApproved) {
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            filteredItems = filteredItems.filter(item => {
                var _a, _b;
                const approvalDate = ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.approvedAt)
                    ? new Date(item.metadata.approvedAt)
                    : ((_b = item.metadata) === null || _b === void 0 ? void 0 : _b.lastUpdated)
                        ? new Date(item.metadata.lastUpdated)
                        : null;
                return approvalDate && approvalDate > oneDayAgo;
            });
            console.log(`Filtered to ${filteredItems.length} recently approved documents`);
        }
        // Get the total count before applying the limit
        const totalFilteredCount = filteredItems.length;
        // Apply the limit
        const limitedItems = filteredItems.slice(0, limit);
        // Transform items to the format expected by the UI
        console.log(`Processing ${limitedItems.length} items for UI display`);
        const documents = limitedItems.map((item) => {
            var _a, _b, _c;
            return ({
                id: ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) || `doc-${Math.random().toString(36).substring(7)}`,
                source: ((_b = item.metadata) === null || _b === void 0 ? void 0 : _b.source) || 'Unknown Source',
                text: item.text || '',
                metadata: {
                    ...item.metadata,
                    // Ensure source is always available
                    source: ((_c = item.metadata) === null || _c === void 0 ? void 0 : _c.source) || 'Unknown Source',
                }
            });
        });
        console.log(`Returning ${documents.length} documents to client (total available: ${totalFilteredCount})`);
        // Return the documents
        return res.status(200).json({
            documents,
            total: totalFilteredCount,
            limit
        });
    }
    catch (error) {
        console.error('Error fetching documents:', error);
        const errorResponse = (0, errorHandling_1.standardizeApiErrorResponse)(error);
        return res.status(500).json(errorResponse);
    }
}

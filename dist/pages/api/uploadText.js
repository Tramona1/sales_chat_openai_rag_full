"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const openaiClient_1 = require("@/utils/openaiClient");
const documentProcessing_1 = require("@/utils/documentProcessing");
const adminWorkflow_1 = require("@/utils/adminWorkflow");
const documentCategories_1 = require("@/utils/documentCategories");
async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }
    // Ensure data directory exists for vector store persistence
    const dataDir = path_1.default.join(process.cwd(), 'data');
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    try {
        const { text, title } = req.body;
        if (!text || typeof text !== 'string' || text.trim() === '') {
            return res.status(400).json({ message: 'Text content is required' });
        }
        // Set the source for context-aware chunking
        const source = title || 'Direct Text Input';
        // Process the text with source information
        const chunks = (0, documentProcessing_1.splitIntoChunks)(text, 500, source);
        // Add to pending documents instead of directly to vector store
        if (chunks.length > 0) {
            // Create embedding for the first chunk to help with similarity search later
            const embedding = await (0, openaiClient_1.embedText)(chunks[0].text);
            // Add to pending documents - with correct parameter format
            await (0, adminWorkflow_1.addToPendingDocuments)(text, {
                source: source,
                title: source,
                contentType: 'text/plain',
                primaryCategory: documentCategories_1.DocumentCategoryType.GENERAL,
                secondaryCategories: [],
                confidenceScore: 0.8,
                summary: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
                keyTopics: [],
                technicalLevel: 5,
                entities: [],
                keywords: [],
                qualityFlags: [],
                approved: false,
                routingPriority: 5
            }, embedding);
            return res.status(200).json({
                message: `Successfully processed text and created ${chunks.length} chunks. Content will be available after admin approval.`
            });
        }
        else {
            return res.status(400).json({ message: 'No valid content chunks could be created from the text' });
        }
    }
    catch (error) {
        console.error('Error processing text:', error);
        return res.status(500).json({
            message: `Error processing text: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
    }
}

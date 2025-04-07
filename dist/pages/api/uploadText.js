"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const openaiClient_1 = require("@/utils/openaiClient");
const vectorStore_1 = require("@/utils/vectorStore");
const documentProcessing_1 = require("@/utils/documentProcessing");
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
        // Process chunks
        let processedCount = 0;
        for (const chunk of chunks) {
            if (chunk.text.trim()) {
                const embedding = await (0, openaiClient_1.embedText)(chunk.text);
                const item = {
                    embedding,
                    text: chunk.text,
                    metadata: {
                        source,
                        // Include the additional metadata from the chunking process
                        ...(chunk.metadata || {})
                    }
                };
                (0, vectorStore_1.addToVectorStore)(item);
                processedCount++;
            }
        }
        return res.status(200).json({
            message: `Successfully processed text and created ${processedCount} chunks. You can now ask questions about this content!`
        });
    }
    catch (error) {
        console.error('Error processing text:', error);
        return res.status(500).json({
            message: `Error processing text: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
    }
}

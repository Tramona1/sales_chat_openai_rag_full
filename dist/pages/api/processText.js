"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const advancedDocumentProcessing_1 = require("@/utils/advancedDocumentProcessing");
async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    try {
        const { text, title } = req.body;
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({ message: 'Text is required and must be a non-empty string' });
        }
        // Use provided title or generate a default one
        const documentTitle = title && typeof title === 'string' && title.trim().length > 0
            ? title.trim()
            : 'Direct Text Input';
        // Process the text input with advanced understanding
        try {
            const result = await (0, advancedDocumentProcessing_1.processTextWithUnderstanding)(text, documentTitle);
            const analysisSnippet = {
                title: result.title,
                topics: result.topics,
                contentType: result.contentType,
                technicalLevel: 3, // Default value as it's not directly available in result
            };
            return res.status(200).json({
                message: `Text processed with advanced understanding. Created ${result.chunks} smart chunks.`,
                analysis: analysisSnippet
            });
        }
        catch (error) {
            console.error('Error processing text:', error);
            return res.status(500).json({
                message: `Error processing text: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }
    catch (error) {
        console.error('Processing error:', error);
        return res.status(500).json({
            message: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
    }
}

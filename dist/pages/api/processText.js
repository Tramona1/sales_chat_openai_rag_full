import { processTextWithUnderstanding } from '../../utils/advancedDocumentProcessing';
export default async function handler(req, res) {
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
            const result = await processTextWithUnderstanding(text, {
                extractEntities: true,
                summarize: true,
                categorize: true
            });
            // Create a custom analysis object since the function doesn't return these fields
            const analysisSnippet = {
                title: documentTitle,
                topics: result.entities || [],
                contentType: "text",
                technicalLevel: 3, // Default value
            };
            return res.status(200).json({
                message: `Text processed with advanced understanding. Created smart chunks.`,
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

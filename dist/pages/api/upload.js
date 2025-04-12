"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = handler;
const formidable_1 = __importDefault(require("formidable"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const embeddingClient_js_1 = require("@/utils/embeddingClient.js");
const vectorStore_1 = require("@/utils/vectorStore");
const documentProcessing_js_1 = require("@/utils/documentProcessing.js");
const geminiClient_js_1 = require("@/utils/geminiClient.js");
const imageAnalyzer_1 = require("@/utils/imageAnalysis/imageAnalyzer");
// Disable the default body parser
exports.config = { api: { bodyParser: false } };
// Helper function to check if a file is an image
function isImageFile(mimetype) {
    return mimetype.startsWith('image/');
}
async function handler(req, res) {
    var _a, _b, _c;
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    // Check for feature flags
    const useContextualChunking = req.query.contextual === 'true';
    const useVisualProcessing = req.query.visualProcessing === 'true';
    // Ensure uploads directory exists
    const uploadsDir = path_1.default.join(process.cwd(), 'public', 'uploads');
    if (!fs_1.default.existsSync(uploadsDir)) {
        fs_1.default.mkdirSync(uploadsDir, { recursive: true });
    }
    // Ensure data directory exists for vector store persistence
    const dataDir = path_1.default.join(process.cwd(), 'data');
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    try {
        const form = new formidable_1.default.IncomingForm({
            uploadDir: uploadsDir,
            keepExtensions: true,
            maxFileSize: 20 * 1024 * 1024, // 20MB limit
            multiples: true, // Support multiple files
        });
        // Parse the form
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err)
                    reject(err);
                else
                    resolve([fields, files]);
            });
        });
        // Get the uploaded files
        const fileArray = Array.isArray(files.file) ? files.file : [files.file];
        if (!fileArray || fileArray.length === 0 || !fileArray[0]) {
            return res.status(400).json({ message: 'No files uploaded' });
        }
        const results = [];
        // Process each file
        for (const uploadedFile of fileArray) {
            // Skip if uploadedFile is undefined
            if (!uploadedFile) {
                results.push({
                    source: 'unknown',
                    error: 'Invalid file data'
                });
                continue;
            }
            const mimetype = uploadedFile.mimetype || '';
            const source = uploadedFile.originalFilename || 'unknown';
            let processedCount = 0;
            let result = { source };
            try {
                // Process image files differently if visual processing is enabled
                if (isImageFile(mimetype) && useVisualProcessing) {
                    // Ensure filepath exists
                    if (!uploadedFile.filepath) {
                        throw new Error('Missing file path');
                    }
                    // Use ImageAnalyzer to process the image
                    const analysisResult = await imageAnalyzer_1.ImageAnalyzer.analyze(uploadedFile.filepath);
                    if (analysisResult.success) {
                        // Generate document context from image analysis
                        const imageContext = imageAnalyzer_1.ImageAnalyzer.generateDocumentContext(analysisResult);
                        // Prepare text for embedding with enhanced contextual information
                        const textForEmbedding = imageAnalyzer_1.ImageAnalyzer.prepareTextForEmbedding(analysisResult);
                        // Generate embedding
                        const embedding = await (0, embeddingClient_js_1.embedText)(textForEmbedding);
                        // Store the image in vector store
                        const item = {
                            embedding,
                            text: textForEmbedding,
                            originalText: analysisResult.description + ' ' + analysisResult.detectedText,
                            metadata: {
                                source,
                                isVisualContent: true,
                                visualType: analysisResult.type,
                                documentType: imageContext.documentType,
                                documentSummary: imageContext.summary,
                                primaryTopics: imageContext.mainTopics.join(', '),
                                technicalLevel: imageContext.technicalLevel,
                                audienceType: imageContext.audienceType.join(', '),
                                context: imageAnalyzer_1.ImageAnalyzer.generateChunkContext(analysisResult),
                                timestamp: new Date().toISOString(),
                                approved: true,
                                imageMetadata: {
                                    analysisTime: analysisResult.metadata.analysisTime,
                                    model: analysisResult.metadata.model,
                                    analysisId: analysisResult.metadata.analysisId
                                }
                            }
                        };
                        // Add to vector store
                        (0, vectorStore_1.addToVectorStore)(item);
                        processedCount = 1;
                        result = {
                            source,
                            type: 'image',
                            imageType: analysisResult.type,
                            processedCount,
                            summary: imageContext.summary
                        };
                    }
                    else {
                        throw new Error(`Image analysis failed: ${analysisResult.error}`);
                    }
                }
                else {
                    // Process standard document files
                    // Ensure filepath exists
                    if (!uploadedFile.filepath) {
                        throw new Error('Missing file path');
                    }
                    const rawText = await (0, documentProcessing_js_1.extractText)(uploadedFile.filepath, mimetype);
                    let documentContext = null;
                    // Use contextual chunking if enabled
                    if (useContextualChunking) {
                        console.log('Using contextual chunking for document:', source);
                        try {
                            // Extract document-level context using Gemini
                            documentContext = await (0, geminiClient_js_1.extractDocumentContext)(rawText);
                            console.log('Document context extracted successfully');
                            // Create chunks with context
                            const chunks = await (0, documentProcessing_js_1.splitIntoChunksWithContext)(rawText, 500, source, true, documentContext);
                            // Prepare texts for embedding with enhanced context
                            for (const chunk of chunks) {
                                if (chunk.text.trim()) {
                                    // Prepare the text with enhanced contextual information
                                    const preparedText = (0, documentProcessing_js_1.prepareTextForEmbedding)(chunk);
                                    // Generate embedding for the prepared text
                                    const embedding = await (0, embeddingClient_js_1.embedText)(preparedText);
                                    // Build vector store item with both prepared and original text
                                    const item = {
                                        embedding,
                                        text: preparedText, // Store the prepared text that was embedded
                                        originalText: chunk.text, // Keep the original text intact
                                        metadata: {
                                            source: source,
                                            // Base metadata
                                            ...(chunk.metadata || {}),
                                            // Document-level metadata properly mapped to VectorStoreItem fields
                                            documentSummary: documentContext === null || documentContext === void 0 ? void 0 : documentContext.summary,
                                            documentType: documentContext === null || documentContext === void 0 ? void 0 : documentContext.documentType,
                                            primaryTopics: (_a = documentContext === null || documentContext === void 0 ? void 0 : documentContext.mainTopics) === null || _a === void 0 ? void 0 : _a.join(', '),
                                            technicalLevel: documentContext === null || documentContext === void 0 ? void 0 : documentContext.technicalLevel,
                                            audienceType: (_b = documentContext === null || documentContext === void 0 ? void 0 : documentContext.audienceType) === null || _b === void 0 ? void 0 : _b.join(', '),
                                            // Chunk context is preserved in the context field
                                            context: (_c = chunk.metadata) === null || _c === void 0 ? void 0 : _c.context,
                                            // Add fields for filtering and tracking
                                            isContextualChunk: true,
                                            timestamp: new Date().toISOString(),
                                            isChunk: true,
                                            approved: true
                                        }
                                    };
                                    (0, vectorStore_1.addToVectorStore)(item);
                                    processedCount++;
                                }
                            }
                            result = {
                                source,
                                type: 'document',
                                documentType: (documentContext === null || documentContext === void 0 ? void 0 : documentContext.documentType) || 'unknown',
                                processedCount,
                                summary: documentContext === null || documentContext === void 0 ? void 0 : documentContext.summary
                            };
                        }
                        catch (contextError) {
                            console.error('Error in contextual processing, falling back to standard chunking:', contextError);
                            // Fall back to standard chunking
                            const chunks = (0, documentProcessing_js_1.splitIntoChunks)(rawText, 500, source);
                            // Process chunks with standard text preparation
                            for (const chunk of chunks) {
                                if (chunk.text.trim()) {
                                    // Even for standard chunks, prepare the text for consistency
                                    const preparedText = (0, documentProcessing_js_1.prepareTextForEmbedding)(chunk);
                                    // Generate embedding for the prepared text
                                    const embedding = await (0, embeddingClient_js_1.embedText)(preparedText);
                                    const item = {
                                        embedding,
                                        text: preparedText,
                                        originalText: chunk.text,
                                        metadata: {
                                            source: source,
                                            // Include the additional metadata from the chunking process
                                            ...(chunk.metadata || {}),
                                            timestamp: new Date().toISOString(),
                                            isChunk: true,
                                            approved: true
                                        }
                                    };
                                    (0, vectorStore_1.addToVectorStore)(item);
                                    processedCount++;
                                }
                            }
                            result = {
                                source,
                                type: 'document',
                                processedCount,
                                fallbackProcessing: true
                            };
                        }
                    }
                    else {
                        // Use standard chunking when contextual is not enabled
                        const chunks = (0, documentProcessing_js_1.splitIntoChunks)(rawText, 500, source);
                        // Process chunks with standard text preparation
                        for (const chunk of chunks) {
                            if (chunk.text.trim()) {
                                // Even for standard chunks, prepare the text for consistency
                                const preparedText = (0, documentProcessing_js_1.prepareTextForEmbedding)(chunk);
                                // Generate embedding for the prepared text
                                const embedding = await (0, embeddingClient_js_1.embedText)(preparedText);
                                const item = {
                                    embedding,
                                    text: preparedText,
                                    originalText: chunk.text,
                                    metadata: {
                                        source: source,
                                        // Include the additional metadata from the chunking process
                                        ...(chunk.metadata || {}),
                                        timestamp: new Date().toISOString(),
                                        isChunk: true,
                                        approved: true
                                    }
                                };
                                (0, vectorStore_1.addToVectorStore)(item);
                                processedCount++;
                            }
                        }
                        result = {
                            source,
                            type: 'document',
                            processedCount,
                            standardProcessing: true
                        };
                    }
                }
                results.push(result);
            }
            catch (error) {
                console.error(`Error processing file ${source}:`, error);
                results.push({
                    source,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    failed: true
                });
            }
        }
        // Check if any files were processed successfully
        const successCount = results.filter(r => !r.failed).length;
        if (successCount === 0 && results.length > 0) {
            return res.status(500).json({
                message: 'All files failed to process',
                results
            });
        }
        return res.status(200).json({
            message: `${successCount} file(s) processed successfully.`,
            contextual: useContextualChunking,
            visualProcessing: useVisualProcessing,
            results
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({
            message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
    }
}

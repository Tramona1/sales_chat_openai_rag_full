"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = handler;
const fs_1 = __importDefault(require("fs"));
const visualStorageManager_1 = require("../../../utils/visualStorageManager");
const performanceMonitoring_1 = require("../../../utils/performanceMonitoring");
const imageAnalyzer_1 = require("../../../utils/imageAnalysis/imageAnalyzer");
const formidable_1 = require("formidable");
// Disable body parser to handle file uploads
exports.config = {
    api: {
        bodyParser: false,
    },
};
/**
 * API endpoint for uploading visual content
 * Supports batch uploads and automatic analysis
 */
async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const startTime = Date.now();
    try {
        // Parse the multipart form data
        const { fields, files } = await parseFormData(req);
        // Get document ID if provided
        const documentId = Array.isArray(fields.documentId)
            ? fields.documentId[0]
            : fields.documentId;
        // Check if we should analyze the visuals
        const analyzeVisuals = Array.isArray(fields.analyze)
            ? fields.analyze[0] === 'true'
            : fields.analyze === 'true';
        // Get array of files (formidable can provide a single file or an array)
        const fileArray = Array.isArray(files.files)
            ? files.files
            : files.files ? [files.files] : [];
        if (fileArray.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        // Process each file
        const results = [];
        let errors = 0;
        for (const file of fileArray) {
            try {
                // Store visual metadata without analysis first
                const visual = await (0, visualStorageManager_1.storeVisual)(file.filepath, {
                    originalFilename: file.originalFilename || 'unknown',
                    mimeType: file.mimetype || 'application/octet-stream',
                    associatedDocumentId: documentId,
                    hasBeenAnalyzed: false
                });
                // If analysis is requested, analyze the visual
                if (analyzeVisuals) {
                    // Analyze the image
                    const analysisResult = await imageAnalyzer_1.ImageAnalyzer.analyze(file.filepath);
                    // Update the visual metadata with analysis results
                    if (analysisResult.success) {
                        await updateVisualWithAnalysis(visual.id, analysisResult);
                    }
                    results.push({
                        id: visual.id,
                        filename: file.originalFilename,
                        analyzed: analysisResult.success,
                        type: analysisResult.success ? analysisResult.type : undefined,
                        url: `/api/visuals/${visual.id}`
                    });
                }
                else {
                    results.push({
                        id: visual.id,
                        filename: file.originalFilename,
                        analyzed: false,
                        url: `/api/visuals/${visual.id}`
                    });
                }
            }
            catch (error) {
                console.error('Error processing visual:', error);
                errors++;
                results.push({
                    filename: file.originalFilename,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
            finally {
                // Remove the temporary file
                if (fs_1.default.existsSync(file.filepath)) {
                    fs_1.default.unlinkSync(file.filepath);
                }
            }
        }
        // Record performance metric
        const duration = Date.now() - startTime;
        (0, performanceMonitoring_1.recordMetric)('visualApi', 'uploadVisuals', duration, errors === 0, // success if no errors
        {
            uploadCount: fileArray.length,
            errorCount: errors,
            totalSize: fileArray.reduce((sum, file) => sum + file.size, 0),
            analyzed: analyzeVisuals
        });
        // Return response with processed visuals
        return res.status(200).json({
            success: true,
            processed: fileArray.length,
            errors,
            results
        });
    }
    catch (error) {
        console.error('Error uploading visuals:', error);
        // Record error metric
        const duration = Date.now() - startTime;
        (0, performanceMonitoring_1.recordMetric)('visualApi', 'uploadVisuals', duration, false, {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * Parse the multipart form data
 */
async function parseFormData(req) {
    return new Promise((resolve, reject) => {
        const form = new formidable_1.IncomingForm({
            multiples: true,
            keepExtensions: true,
            maxFileSize: 10 * 1024 * 1024, // 10MB max file size
        });
        form.parse(req, (err, fields, files) => {
            if (err) {
                reject(err);
                return;
            }
            resolve({ fields, files });
        });
    });
}
/**
 * Update visual metadata with analysis results
 */
async function updateVisualWithAnalysis(visualId, analysisResult) {
    const { storeVisual, getVisual, updateVisualMetadata } = await Promise.resolve().then(() => __importStar(require('../../../utils/visualStorageManager')));
    // Get the current visual metadata
    const visual = await getVisual(visualId);
    if (!visual) {
        throw new Error(`Visual not found: ${visualId}`);
    }
    // Update with analysis results
    await updateVisualMetadata(visualId, {
        type: analysisResult.type,
        description: analysisResult.description,
        extractedText: analysisResult.detectedText,
        hasBeenAnalyzed: true,
        analysisResults: {
            detectedType: analysisResult.type,
            description: analysisResult.description,
            extractedText: analysisResult.detectedText,
            structuredData: analysisResult.data
        }
    });
}

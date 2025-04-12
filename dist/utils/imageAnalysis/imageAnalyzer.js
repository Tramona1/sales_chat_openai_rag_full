"use strict";
/**
 * Image Analyzer Utility
 *
 * Provides functionality to analyze images using Gemini Vision API
 * and extract structured information for the RAG system.
 */
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
exports.ImageAnalyzer = void 0;
const generative_ai_1 = require("@google/generative-ai");
const fs = __importStar(require("fs"));
const util_1 = require("util");
const crypto_1 = __importDefault(require("crypto"));
const baseTypes_1 = require("../../types/baseTypes");
const performanceMonitoring_1 = require("../performanceMonitoring");
// Promisify fs functions
const readFile = (0, util_1.promisify)(fs.readFile);
/**
 * Map local ImageType to VisualContentType
 * This helps with compatibility between the older API and the new type system
 */
function mapImageTypeToVisualContentType(imageType) {
    const typeMap = {
        'chart': baseTypes_1.VisualContentType.CHART,
        'table': baseTypes_1.VisualContentType.TABLE,
        'diagram': baseTypes_1.VisualContentType.DIAGRAM,
        'screenshot': baseTypes_1.VisualContentType.SCREENSHOT,
        'photo': baseTypes_1.VisualContentType.IMAGE,
        'unknown': baseTypes_1.VisualContentType.UNKNOWN
    };
    return typeMap[imageType] || baseTypes_1.VisualContentType.UNKNOWN;
}
/**
 * ImageAnalyzer class for analyzing images with Gemini Vision
 */
class ImageAnalyzer {
    static getGeminiClient() {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            throw new Error('Gemini API key not found in environment variables');
        }
        return new generative_ai_1.GoogleGenerativeAI(apiKey);
    }
    /**
     * Analyzes an image using Gemini Vision API
     *
     * @param imagePathOrBuffer - Path to image file or Buffer containing image data
     * @param options - Analysis options
     * @returns Analysis result
     */
    static async analyze(imagePathOrBuffer, options = {}) {
        const startTime = Date.now();
        const analysisId = crypto_1.default.randomBytes(8).toString('hex');
        try {
            (0, performanceMonitoring_1.recordMetric)('imageAnalysis', 'analyze', Date.now() - startTime, true, { options });
            // Set default options
            const analysisOptions = {
                extractStructuredData: true,
                extractText: true,
                model: 'gemini-2.0-flash',
                temperature: 0.2,
                ...options
            };
            // Get image data
            let imageData;
            let sizeBytes;
            if (typeof imagePathOrBuffer === 'string') {
                imageData = await readFile(imagePathOrBuffer);
                sizeBytes = fs.statSync(imagePathOrBuffer).size;
            }
            else {
                imageData = imagePathOrBuffer;
                sizeBytes = imageData.length;
            }
            // Get Gemini client and model
            const genAI = this.getGeminiClient();
            const model = genAI.getGenerativeModel({
                model: analysisOptions.model,
                safetySettings: [
                    {
                        category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                        threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH
                    }
                ],
                generationConfig: {
                    temperature: analysisOptions.temperature,
                    maxOutputTokens: 1500,
                }
            });
            // Create analysis prompt
            const prompt = `
Please analyze this image and provide the following information:

IMAGE_TYPE: Classify the image (chart, table, diagram, screenshot, photo, or unknown)
DESCRIPTION: Detailed description of what the image shows (2-3 sentences)
DETECTED_TEXT: Text visible in the image
${analysisOptions.extractStructuredData ? 'STRUCTURED_DATA: If the image contains a chart, table, or structured information, extract it in JSON format' : ''}

Reply ONLY with a valid JSON object containing these keys and relevant values.`;
            // Call Gemini API
            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: imageData.toString('base64')
                    }
                }
            ]);
            const responseText = result.response.text();
            // Parse JSON response
            // Extract JSON from response (handling possible text before or after JSON)
            let jsonStart = responseText.indexOf('{');
            let jsonEnd = responseText.lastIndexOf('}');
            if (jsonStart >= 0 && jsonEnd >= 0) {
                const jsonText = responseText.substring(jsonStart, jsonEnd + 1);
                try {
                    const analysisResult = JSON.parse(jsonText);
                    // Record performance metric
                    const durationMs = Date.now() - startTime;
                    (0, performanceMonitoring_1.recordMetric)('imageAnalysis', 'analyze', durationMs, true, {
                        imageSize: sizeBytes,
                        resultType: this.determineImageType(analysisResult.IMAGE_TYPE)
                    });
                    // Format the result
                    const visualType = mapImageTypeToVisualContentType(this.determineImageType(analysisResult.IMAGE_TYPE));
                    const result = {
                        success: true,
                        type: visualType,
                        description: analysisResult.DESCRIPTION || '',
                        extractedText: analysisResult.DETECTED_TEXT || '',
                        detectedText: analysisResult.DETECTED_TEXT || '',
                        data: analysisResult.STRUCTURED_DATA || null,
                        metadata: {
                            analysisTime: new Date().toISOString(),
                            durationMs,
                            model: analysisOptions.model,
                            sizeBytes,
                            analysisId
                        }
                    };
                    return result;
                }
                catch (jsonError) {
                    console.error(`Error parsing image analysis JSON: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
                    // Record failure
                    const durationMs = Date.now() - startTime;
                    (0, performanceMonitoring_1.recordMetric)('imageAnalysis', 'analyze', durationMs, false, {
                        error: jsonError instanceof Error ? jsonError.message : 'JSON parsing error'
                    });
                    return {
                        success: false,
                        type: baseTypes_1.VisualContentType.UNKNOWN,
                        description: responseText.substring(0, 200) + '...',
                        extractedText: '',
                        detectedText: '',
                        error: `JSON parsing error: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`,
                        metadata: {
                            analysisTime: new Date().toISOString(),
                            durationMs,
                            model: analysisOptions.model,
                            sizeBytes,
                            analysisId
                        }
                    };
                }
            }
        }
        catch (error) {
            // Record failure
            const durationMs = Date.now() - startTime;
            (0, performanceMonitoring_1.recordMetric)('imageAnalysis', 'analyze', durationMs, false, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                success: false,
                type: baseTypes_1.VisualContentType.UNKNOWN,
                description: '',
                extractedText: '',
                detectedText: '',
                error: error.message,
                metadata: {
                    analysisTime: new Date().toISOString(),
                    durationMs,
                    model: options.model || 'gemini-2.0-flash',
                    analysisId
                }
            };
        }
        // Fallback error case
        const durationMs = Date.now() - startTime;
        return {
            success: false,
            type: baseTypes_1.VisualContentType.UNKNOWN,
            description: '',
            extractedText: '',
            detectedText: '',
            error: 'Unknown error during image analysis',
            metadata: {
                analysisTime: new Date().toISOString(),
                durationMs,
                model: options.model || 'gemini-2.0-flash',
                analysisId
            }
        };
    }
    /**
     * Determines the image type from Gemini's response
     */
    static determineImageType(typeText) {
        if (!typeText)
            return 'unknown';
        const normalizedType = typeText.toLowerCase().trim();
        if (normalizedType.includes('chart') || normalizedType.includes('graph')) {
            return 'chart';
        }
        else if (normalizedType.includes('table')) {
            return 'table';
        }
        else if (normalizedType.includes('diagram') || normalizedType.includes('flowchart')) {
            return 'diagram';
        }
        else if (normalizedType.includes('screenshot')) {
            return 'screenshot';
        }
        else if (normalizedType.includes('photo') || normalizedType.includes('image')) {
            return 'photo';
        }
        return 'unknown';
    }
    /**
     * Generates contextual information from image analysis
     *
     * @param analysis Result of image analysis
     * @returns Document context for the image
     */
    static generateDocumentContext(analysis) {
        // Extract context relevant data from the analysis
        const topics = this.extractTopicsFromAnalysis(analysis);
        const entities = this.extractEntitiesFromAnalysis(analysis);
        const technicalLevel = this.assessTechnicalLevel(analysis);
        const audienceType = this.determineAudienceType(analysis, technicalLevel);
        return {
            summary: analysis.description.split('.')[0] + '.',
            mainTopics: topics,
            entities: entities,
            documentType: analysis.type,
            technicalLevel: technicalLevel,
            audienceType: audienceType,
            isVisualContent: true,
            visualType: analysis.type
        };
    }
    /**
     * Extracts main topics from the image analysis
     */
    static extractTopicsFromAnalysis(analysis) {
        const topics = [];
        // Extract based on image type
        if (analysis.type === 'chart') {
            // For charts, look for data categories and titles
            if (analysis.data && analysis.data.title) {
                topics.push(analysis.data.title);
            }
            if (analysis.data && analysis.data.categories) {
                topics.push(...analysis.data.categories.slice(0, 3));
            }
        }
        // If we couldn't extract structured topics, try from text
        if (topics.length === 0) {
            // Simple keyword extraction from description
            const description = analysis.description.toLowerCase();
            const possibleTopics = [
                'revenue', 'sales', 'performance', 'growth', 'comparison',
                'market share', 'forecast', 'trend', 'analysis', 'metrics',
                'product', 'service', 'customer', 'user', 'workflow',
                'process', 'system', 'architecture', 'interface', 'design'
            ];
            for (const topic of possibleTopics) {
                if (description.includes(topic)) {
                    // Capitalize first letter
                    topics.push(topic.charAt(0).toUpperCase() + topic.slice(1));
                }
                if (topics.length >= 3)
                    break;
            }
        }
        // Still no topics? Use type as a fallback
        if (topics.length === 0) {
            topics.push(analysis.type.charAt(0).toUpperCase() + analysis.type.slice(1));
        }
        return topics;
    }
    /**
     * Extracts entities from the image analysis
     */
    static extractEntitiesFromAnalysis(analysis) {
        const entities = [];
        const fullText = analysis.description + ' ' + (analysis.detectedText || '');
        // Simple regex-based entity extraction
        // Look for capitalized words that might be entities
        const entityRegex = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g;
        const matches = fullText.match(entityRegex) || [];
        // Filter out common words and duplicates
        const commonWords = ['the', 'a', 'an', 'chart', 'image', 'table', 'diagram'];
        const uniqueEntities = new Set();
        for (const match of matches) {
            if (!commonWords.includes(match.toLowerCase()) && match.length > 1) {
                uniqueEntities.add(match);
            }
        }
        return Array.from(uniqueEntities).slice(0, 5);
    }
    /**
     * Assesses the technical level of the image content
     * (0-3 scale)
     */
    static assessTechnicalLevel(analysis) {
        const fullText = analysis.description + ' ' + (analysis.detectedText || '');
        const lowerText = fullText.toLowerCase();
        // Technical terminology indicators
        const technicalTerms = [
            'algorithm', 'coefficient', 'infrastructure', 'architecture',
            'implementation', 'technical', 'specification', 'framework',
            'parameter', 'configuration', 'deployment', 'integration'
        ];
        // Count technical terms
        let technicalCount = 0;
        for (const term of technicalTerms) {
            if (lowerText.includes(term)) {
                technicalCount++;
            }
        }
        // Determine level based on count and type
        if (analysis.type === 'diagram' && technicalCount > 2) {
            return 3; // Most technical
        }
        else if (analysis.type === 'chart' && technicalCount > 1) {
            return 2; // Moderately technical
        }
        else if (technicalCount > 0) {
            return 1; // Somewhat technical
        }
        return 0; // Non-technical
    }
    /**
     * Determines the likely audience type for the image
     */
    static determineAudienceType(analysis, technicalLevel) {
        const fullText = analysis.description + ' ' + (analysis.detectedText || '');
        const lowerText = fullText.toLowerCase();
        const audienceTypes = [];
        // Determine based on content and technical level
        if (technicalLevel >= 2) {
            audienceTypes.push('Technical');
        }
        if (lowerText.includes('revenue') || lowerText.includes('sales') ||
            lowerText.includes('forecast') || lowerText.includes('growth')) {
            audienceTypes.push('Sales');
            audienceTypes.push('Management');
        }
        if (lowerText.includes('user') || lowerText.includes('customer') ||
            lowerText.includes('satisfaction') || lowerText.includes('experience')) {
            audienceTypes.push('Marketing');
        }
        if (lowerText.includes('architecture') || lowerText.includes('system') ||
            lowerText.includes('infrastructure') || lowerText.includes('workflow')) {
            audienceTypes.push('Engineering');
        }
        // Default if no specific audience detected
        if (audienceTypes.length === 0) {
            audienceTypes.push('General');
        }
        return audienceTypes;
    }
    /**
     * Generates chunk context information from image analysis
     *
     * @param analysis Result of image analysis
     * @returns Chunk context for the image
     */
    static generateChunkContext(analysis) {
        return {
            description: analysis.description.substring(0, 200), // Truncated description
            keyPoints: this.extractKeyPointsFromAnalysis(analysis),
            isDefinition: false, // Images are typically not definitions
            containsExample: true, // Images are usually examples of something
            relatedTopics: this.extractTopicsFromAnalysis(analysis)
        };
    }
    /**
     * Extracts key points from the image analysis
     */
    static extractKeyPointsFromAnalysis(analysis) {
        const keyPoints = [];
        // Extract based on image type
        if (analysis.type === 'chart') {
            // For charts, look for insights in the data
            keyPoints.push(`This is a ${analysis.type} visualization`);
            // Add detected text as a key point if available
            if (analysis.detectedText && analysis.detectedText.length > 0) {
                const truncatedText = analysis.detectedText.length > 100
                    ? analysis.detectedText.substring(0, 100) + '...'
                    : analysis.detectedText;
                keyPoints.push(`Contains text: "${truncatedText}"`);
            }
            // Add structured data insight if available
            if (analysis.data) {
                keyPoints.push('Contains structured data that can be analyzed');
            }
        }
        else {
            // Generic key points for other image types
            keyPoints.push(`This is a ${analysis.type}`);
            // Break description into sentences and use first 2 as key points
            const sentences = analysis.description.split(/\. |\.\n/);
            for (let i = 0; i < Math.min(2, sentences.length); i++) {
                const sentence = sentences[i].trim();
                if (sentence.length > 0 && !keyPoints.includes(sentence)) {
                    keyPoints.push(sentence);
                }
            }
        }
        // Ensure we have at least one key point
        if (keyPoints.length === 0) {
            keyPoints.push(`Visual content: ${analysis.type}`);
        }
        return keyPoints;
    }
    /**
     * Prepares text for embedding from image analysis
     *
     * @param analysis Result of image analysis
     * @returns Text prepared for embedding
     */
    static prepareTextForEmbedding(analysis) {
        const documentContext = this.generateDocumentContext(analysis);
        const chunkContext = this.generateChunkContext(analysis);
        // Combine context and content for embedding
        return `[Context: ${analysis.type} showing ${documentContext.summary} Key points: ${chunkContext.keyPoints.join(', ')}] ${analysis.description} ${analysis.detectedText || ''}`;
    }
}
exports.ImageAnalyzer = ImageAnalyzer;
exports.default = ImageAnalyzer;

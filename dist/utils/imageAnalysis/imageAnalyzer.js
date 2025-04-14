/**
 * Image Analyzer Utility
 *
 * Provides functionality to analyze images using Gemini Vision API
 * and extract structured information for the RAG system.
 */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import * as fs from 'fs';
import { promisify } from 'util';
import crypto from 'crypto';
import { VisualContentType } from '../../types/baseTypes';
import { recordMetric } from '../performanceMonitoring';
import { logError } from '../logger';
// Promisify fs functions
const readFile = promisify(fs.readFile);
/**
 * Map local ImageType to VisualContentType
 * This helps with compatibility between the older API and the new type system
 */
function mapImageTypeToVisualContentType(imageType) {
    const typeMap = {
        'chart': VisualContentType.CHART,
        'table': VisualContentType.TABLE,
        'diagram': VisualContentType.DIAGRAM,
        'screenshot': VisualContentType.SCREENSHOT,
        'photo': VisualContentType.IMAGE,
        'unknown': VisualContentType.UNKNOWN
    };
    return typeMap[imageType] || VisualContentType.UNKNOWN;
}
/**
 * ImageAnalyzer class for analyzing images with Gemini Vision
 */
export class ImageAnalyzer {
    constructor() {
        this.isInitialized = false;
        this.apiKey = process.env.GOOGLE_AI_API_KEY || '';
        this.initializeModel();
    }
    initializeModel() {
        try {
            if (!this.apiKey) {
                throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
            }
            const genAI = new GoogleGenerativeAI(this.apiKey);
            // We use gemini-1.5-flash for vision tasks since gemini-2.0-flash doesn't support vision
            const modelName = 'gemini-1.5-flash';
            this.visionModel = genAI.getGenerativeModel({ model: modelName });
            this.isInitialized = true;
            console.log(`ImageAnalyzer initialized with model: ${modelName}`);
        }
        catch (error) {
            logError('Failed to initialize ImageAnalyzer', error);
            this.isInitialized = false;
        }
    }
    /**
     * Analyzes an image buffer and returns structured information about its content
     *
     * @param imageBuffer - The image data buffer
     * @param pageNumber - The page number where this image appears in the document
     * @param contextHints - Optional text surrounding the image that might provide context
     * @returns Structured analysis of the image content
     */
    async analyze(imageBuffer, pageNumber, contextHints) {
        if (!this.isInitialized) {
            this.initializeModel();
            if (!this.isInitialized) {
                throw new Error('ImageAnalyzer could not be initialized');
            }
        }
        try {
            // Convert buffer to base64
            const base64Image = imageBuffer.toString('base64');
            // Create prompt that asks for structured analysis
            const prompt = `Analyze this image in detail and provide the following information:
1. A detailed description of what you see in the image (be thorough and descriptive).
2. Classify the visual type as one of: chart, table, diagram, graph, image, screenshot, or other.
3. Any text that appears in the image (transcribed exactly).
4. If this is a chart, table, or graph, extract the structured data in a usable format.

${contextHints ? `Context about this image: ${contextHints}` : ''}

Provide your response in this exact JSON format:
{
  "contentDescription": "detailed description of the image content",
  "visualType": "chart|table|diagram|graph|image|screenshot|other",
  "detectedText": "all text visible in the image",
  "structuredData": {
    "title": "title if present",
    "dataPoints": [{"label": "label1", "value": "value1"}, ...],
    "rows": [["cell1", "cell2"], ["cell3", "cell4"], ...],
    "columns": ["column1", "column2", ...],
    "type": "bar|line|pie|scatter|table|etc"
  },
  "confidence": 0.95
}`;
            // Prepare the image part
            const imagePart = {
                inlineData: {
                    data: base64Image,
                    mimeType: "image/jpeg", // Assumed MIME type
                },
            };
            // Generate content using the vision model
            const result = await this.visionModel.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();
            // Extract JSON from response
            let jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) ||
                text.match(/```\n([\s\S]*?)\n```/) ||
                text.match(/{[\s\S]*?}/);
            let parsedResponse;
            if (jsonMatch) {
                try {
                    parsedResponse = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                }
                catch (e) {
                    console.warn('Failed to parse JSON directly from response, falling back to manual extraction');
                    parsedResponse = this.extractStructuredData(text);
                }
            }
            else {
                parsedResponse = this.extractStructuredData(text);
            }
            // Construct the response
            const analysisResult = {
                pageNumber,
                contentDescription: parsedResponse.contentDescription || 'No description available',
                visualType: this.validateVisualType(parsedResponse.visualType),
                detectedText: parsedResponse.detectedText || '',
                structuredData: parsedResponse.structuredData || undefined,
                confidence: parsedResponse.confidence || 0.7
            };
            return analysisResult;
        }
        catch (error) {
            logError('Error analyzing image', error);
            // Return a minimal result in case of error
            return {
                pageNumber,
                contentDescription: 'Failed to analyze image due to an error',
                visualType: 'other',
                detectedText: '',
                confidence: 0
            };
        }
    }
    validateVisualType(type) {
        const validTypes = [
            'chart', 'table', 'diagram', 'graph', 'image', 'screenshot', 'other'
        ];
        if (!type || !validTypes.includes(type)) {
            return 'other';
        }
        return type;
    }
    extractStructuredData(text) {
        // Fallback extraction for when JSON parsing fails
        const result = {
            contentDescription: '',
            visualType: 'other',
            detectedText: '',
            confidence: 0.5
        };
        // Extract content description
        const descriptionMatch = text.match(/contentDescription["']?\s*:["']?\s*["']?(.*?)["']?\s*[,}]/);
        if (descriptionMatch) {
            result.contentDescription = descriptionMatch[1];
        }
        // Extract visual type
        const typeMatch = text.match(/visualType["']?\s*:["']?\s*["']?(chart|table|diagram|graph|image|screenshot|other)["']?\s*[,}]/);
        if (typeMatch) {
            result.visualType = typeMatch[1];
        }
        // Extract detected text
        const textMatch = text.match(/detectedText["']?\s*:["']?\s*["']?(.*?)["']?\s*[,}]/);
        if (textMatch) {
            result.detectedText = textMatch[1];
        }
        // Extract structured data if possible
        if (text.includes('structuredData') || text.includes('structured data')) {
            result.structuredData = {};
        }
        return result;
    }
    /**
     * Analyzes an image using Gemini Vision API
     *
     * @param imagePathOrBuffer - Path to image file or Buffer containing image data
     * @param options - Analysis options
     * @returns Analysis result
     */
    static async analyzeImage(imagePathOrBuffer, options = {}) {
        const startTime = Date.now();
        const analysisId = crypto.randomBytes(8).toString('hex');
        try {
            recordMetric('imageAnalysis', 'analyze', Date.now() - startTime, true, { options });
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
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '');
            const model = genAI.getGenerativeModel({
                model: analysisOptions.model,
                safetySettings: [
                    {
                        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
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
                    recordMetric('imageAnalysis', 'analyze', durationMs, true, {
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
                    recordMetric('imageAnalysis', 'analyze', durationMs, false, {
                        error: jsonError instanceof Error ? jsonError.message : 'JSON parsing error'
                    });
                    return {
                        success: false,
                        type: VisualContentType.UNKNOWN,
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
            recordMetric('imageAnalysis', 'analyze', durationMs, false, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                success: false,
                type: VisualContentType.UNKNOWN,
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
            type: VisualContentType.UNKNOWN,
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
// Export a singleton instance
export const imageAnalyzer = new ImageAnalyzer();

"use strict";
/**
 * Image Analyzer Utility
 *
 * Provides functionality to analyze images using Gemini Vision API
 * and extract structured information for the RAG system.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageAnalyzer = void 0;
var generative_ai_1 = require("@google/generative-ai");
var fs = __importStar(require("fs"));
var util_1 = require("util");
var crypto_1 = __importDefault(require("crypto"));
var baseTypes_1 = require("../../types/baseTypes");
var performanceMonitoring_1 = require("../performanceMonitoring");
// Promisify fs functions
var readFile = (0, util_1.promisify)(fs.readFile);
/**
 * Map local ImageType to VisualContentType
 * This helps with compatibility between the older API and the new type system
 */
function mapImageTypeToVisualContentType(imageType) {
    var typeMap = {
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
var ImageAnalyzer = /** @class */ (function () {
    function ImageAnalyzer() {
    }
    ImageAnalyzer.getGeminiClient = function () {
        var apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            throw new Error('Gemini API key not found in environment variables');
        }
        return new generative_ai_1.GoogleGenerativeAI(apiKey);
    };
    /**
     * Analyzes an image using Gemini Vision API
     *
     * @param imagePathOrBuffer - Path to image file or Buffer containing image data
     * @param options - Analysis options
     * @returns Analysis result
     */
    ImageAnalyzer.analyze = function (imagePathOrBuffer_1) {
        return __awaiter(this, arguments, void 0, function (imagePathOrBuffer, options) {
            var startTime, analysisId, analysisOptions, imageData, sizeBytes, genAI, model, prompt_1, result, responseText, jsonStart, jsonEnd, jsonText, analysisResult, durationMs_1, visualType, result_1, durationMs_2, error_1, durationMs_3, durationMs;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        analysisId = crypto_1.default.randomBytes(8).toString('hex');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        (0, performanceMonitoring_1.recordMetric)('imageAnalysis', 'analyze', Date.now() - startTime, true, { options: options });
                        analysisOptions = __assign({ extractStructuredData: true, extractText: true, model: 'gemini-2.0-flash', temperature: 0.2 }, options);
                        imageData = void 0;
                        sizeBytes = void 0;
                        if (!(typeof imagePathOrBuffer === 'string')) return [3 /*break*/, 3];
                        return [4 /*yield*/, readFile(imagePathOrBuffer)];
                    case 2:
                        imageData = _a.sent();
                        sizeBytes = fs.statSync(imagePathOrBuffer).size;
                        return [3 /*break*/, 4];
                    case 3:
                        imageData = imagePathOrBuffer;
                        sizeBytes = imageData.length;
                        _a.label = 4;
                    case 4:
                        genAI = this.getGeminiClient();
                        model = genAI.getGenerativeModel({
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
                        prompt_1 = "\nPlease analyze this image and provide the following information:\n\nIMAGE_TYPE: Classify the image (chart, table, diagram, screenshot, photo, or unknown)\nDESCRIPTION: Detailed description of what the image shows (2-3 sentences)\nDETECTED_TEXT: Text visible in the image\n".concat(analysisOptions.extractStructuredData ? 'STRUCTURED_DATA: If the image contains a chart, table, or structured information, extract it in JSON format' : '', "\n\nReply ONLY with a valid JSON object containing these keys and relevant values.");
                        return [4 /*yield*/, model.generateContent([
                                prompt_1,
                                {
                                    inlineData: {
                                        mimeType: 'image/jpeg',
                                        data: imageData.toString('base64')
                                    }
                                }
                            ])];
                    case 5:
                        result = _a.sent();
                        responseText = result.response.text();
                        jsonStart = responseText.indexOf('{');
                        jsonEnd = responseText.lastIndexOf('}');
                        if (jsonStart >= 0 && jsonEnd >= 0) {
                            jsonText = responseText.substring(jsonStart, jsonEnd + 1);
                            try {
                                analysisResult = JSON.parse(jsonText);
                                durationMs_1 = Date.now() - startTime;
                                (0, performanceMonitoring_1.recordMetric)('imageAnalysis', 'analyze', durationMs_1, true, {
                                    imageSize: sizeBytes,
                                    resultType: this.determineImageType(analysisResult.IMAGE_TYPE)
                                });
                                visualType = mapImageTypeToVisualContentType(this.determineImageType(analysisResult.IMAGE_TYPE));
                                result_1 = {
                                    success: true,
                                    type: visualType,
                                    description: analysisResult.DESCRIPTION || '',
                                    extractedText: analysisResult.DETECTED_TEXT || '',
                                    detectedText: analysisResult.DETECTED_TEXT || '',
                                    data: analysisResult.STRUCTURED_DATA || null,
                                    metadata: {
                                        analysisTime: new Date().toISOString(),
                                        durationMs: durationMs_1,
                                        model: analysisOptions.model,
                                        sizeBytes: sizeBytes,
                                        analysisId: analysisId
                                    }
                                };
                                return [2 /*return*/, result_1];
                            }
                            catch (jsonError) {
                                console.error("Error parsing image analysis JSON: ".concat(jsonError instanceof Error ? jsonError.message : String(jsonError)));
                                durationMs_2 = Date.now() - startTime;
                                (0, performanceMonitoring_1.recordMetric)('imageAnalysis', 'analyze', durationMs_2, false, {
                                    error: jsonError instanceof Error ? jsonError.message : 'JSON parsing error'
                                });
                                return [2 /*return*/, {
                                        success: false,
                                        type: baseTypes_1.VisualContentType.UNKNOWN,
                                        description: responseText.substring(0, 200) + '...',
                                        extractedText: '',
                                        detectedText: '',
                                        error: "JSON parsing error: ".concat(jsonError instanceof Error ? jsonError.message : String(jsonError)),
                                        metadata: {
                                            analysisTime: new Date().toISOString(),
                                            durationMs: durationMs_2,
                                            model: analysisOptions.model,
                                            sizeBytes: sizeBytes,
                                            analysisId: analysisId
                                        }
                                    }];
                            }
                        }
                        return [3 /*break*/, 7];
                    case 6:
                        error_1 = _a.sent();
                        durationMs_3 = Date.now() - startTime;
                        (0, performanceMonitoring_1.recordMetric)('imageAnalysis', 'analyze', durationMs_3, false, {
                            error: error_1 instanceof Error ? error_1.message : 'Unknown error'
                        });
                        return [2 /*return*/, {
                                success: false,
                                type: baseTypes_1.VisualContentType.UNKNOWN,
                                description: '',
                                extractedText: '',
                                detectedText: '',
                                error: error_1.message,
                                metadata: {
                                    analysisTime: new Date().toISOString(),
                                    durationMs: durationMs_3,
                                    model: options.model || 'gemini-2.0-flash',
                                    analysisId: analysisId
                                }
                            }];
                    case 7:
                        durationMs = Date.now() - startTime;
                        return [2 /*return*/, {
                                success: false,
                                type: baseTypes_1.VisualContentType.UNKNOWN,
                                description: '',
                                extractedText: '',
                                detectedText: '',
                                error: 'Unknown error during image analysis',
                                metadata: {
                                    analysisTime: new Date().toISOString(),
                                    durationMs: durationMs,
                                    model: options.model || 'gemini-2.0-flash',
                                    analysisId: analysisId
                                }
                            }];
                }
            });
        });
    };
    /**
     * Determines the image type from Gemini's response
     */
    ImageAnalyzer.determineImageType = function (typeText) {
        if (!typeText)
            return 'unknown';
        var normalizedType = typeText.toLowerCase().trim();
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
    };
    /**
     * Generates contextual information from image analysis
     *
     * @param analysis Result of image analysis
     * @returns Document context for the image
     */
    ImageAnalyzer.generateDocumentContext = function (analysis) {
        // Extract context relevant data from the analysis
        var topics = this.extractTopicsFromAnalysis(analysis);
        var entities = this.extractEntitiesFromAnalysis(analysis);
        var technicalLevel = this.assessTechnicalLevel(analysis);
        var audienceType = this.determineAudienceType(analysis, technicalLevel);
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
    };
    /**
     * Extracts main topics from the image analysis
     */
    ImageAnalyzer.extractTopicsFromAnalysis = function (analysis) {
        var topics = [];
        // Extract based on image type
        if (analysis.type === 'chart') {
            // For charts, look for data categories and titles
            if (analysis.data && analysis.data.title) {
                topics.push(analysis.data.title);
            }
            if (analysis.data && analysis.data.categories) {
                topics.push.apply(topics, analysis.data.categories.slice(0, 3));
            }
        }
        // If we couldn't extract structured topics, try from text
        if (topics.length === 0) {
            // Simple keyword extraction from description
            var description = analysis.description.toLowerCase();
            var possibleTopics = [
                'revenue', 'sales', 'performance', 'growth', 'comparison',
                'market share', 'forecast', 'trend', 'analysis', 'metrics',
                'product', 'service', 'customer', 'user', 'workflow',
                'process', 'system', 'architecture', 'interface', 'design'
            ];
            for (var _i = 0, possibleTopics_1 = possibleTopics; _i < possibleTopics_1.length; _i++) {
                var topic = possibleTopics_1[_i];
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
    };
    /**
     * Extracts entities from the image analysis
     */
    ImageAnalyzer.extractEntitiesFromAnalysis = function (analysis) {
        var entities = [];
        var fullText = analysis.description + ' ' + (analysis.detectedText || '');
        // Simple regex-based entity extraction
        // Look for capitalized words that might be entities
        var entityRegex = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g;
        var matches = fullText.match(entityRegex) || [];
        // Filter out common words and duplicates
        var commonWords = ['the', 'a', 'an', 'chart', 'image', 'table', 'diagram'];
        var uniqueEntities = new Set();
        for (var _i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
            var match = matches_1[_i];
            if (!commonWords.includes(match.toLowerCase()) && match.length > 1) {
                uniqueEntities.add(match);
            }
        }
        return Array.from(uniqueEntities).slice(0, 5);
    };
    /**
     * Assesses the technical level of the image content
     * (0-3 scale)
     */
    ImageAnalyzer.assessTechnicalLevel = function (analysis) {
        var fullText = analysis.description + ' ' + (analysis.detectedText || '');
        var lowerText = fullText.toLowerCase();
        // Technical terminology indicators
        var technicalTerms = [
            'algorithm', 'coefficient', 'infrastructure', 'architecture',
            'implementation', 'technical', 'specification', 'framework',
            'parameter', 'configuration', 'deployment', 'integration'
        ];
        // Count technical terms
        var technicalCount = 0;
        for (var _i = 0, technicalTerms_1 = technicalTerms; _i < technicalTerms_1.length; _i++) {
            var term = technicalTerms_1[_i];
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
    };
    /**
     * Determines the likely audience type for the image
     */
    ImageAnalyzer.determineAudienceType = function (analysis, technicalLevel) {
        var fullText = analysis.description + ' ' + (analysis.detectedText || '');
        var lowerText = fullText.toLowerCase();
        var audienceTypes = [];
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
    };
    /**
     * Generates chunk context information from image analysis
     *
     * @param analysis Result of image analysis
     * @returns Chunk context for the image
     */
    ImageAnalyzer.generateChunkContext = function (analysis) {
        return {
            description: analysis.description.substring(0, 200), // Truncated description
            keyPoints: this.extractKeyPointsFromAnalysis(analysis),
            isDefinition: false, // Images are typically not definitions
            containsExample: true, // Images are usually examples of something
            relatedTopics: this.extractTopicsFromAnalysis(analysis)
        };
    };
    /**
     * Extracts key points from the image analysis
     */
    ImageAnalyzer.extractKeyPointsFromAnalysis = function (analysis) {
        var keyPoints = [];
        // Extract based on image type
        if (analysis.type === 'chart') {
            // For charts, look for insights in the data
            keyPoints.push("This is a ".concat(analysis.type, " visualization"));
            // Add detected text as a key point if available
            if (analysis.detectedText && analysis.detectedText.length > 0) {
                var truncatedText = analysis.detectedText.length > 100
                    ? analysis.detectedText.substring(0, 100) + '...'
                    : analysis.detectedText;
                keyPoints.push("Contains text: \"".concat(truncatedText, "\""));
            }
            // Add structured data insight if available
            if (analysis.data) {
                keyPoints.push('Contains structured data that can be analyzed');
            }
        }
        else {
            // Generic key points for other image types
            keyPoints.push("This is a ".concat(analysis.type));
            // Break description into sentences and use first 2 as key points
            var sentences = analysis.description.split(/\. |\.\n/);
            for (var i = 0; i < Math.min(2, sentences.length); i++) {
                var sentence = sentences[i].trim();
                if (sentence.length > 0 && !keyPoints.includes(sentence)) {
                    keyPoints.push(sentence);
                }
            }
        }
        // Ensure we have at least one key point
        if (keyPoints.length === 0) {
            keyPoints.push("Visual content: ".concat(analysis.type));
        }
        return keyPoints;
    };
    /**
     * Prepares text for embedding from image analysis
     *
     * @param analysis Result of image analysis
     * @returns Text prepared for embedding
     */
    ImageAnalyzer.prepareTextForEmbedding = function (analysis) {
        var documentContext = this.generateDocumentContext(analysis);
        var chunkContext = this.generateChunkContext(analysis);
        // Combine context and content for embedding
        return "[Context: ".concat(analysis.type, " showing ").concat(documentContext.summary, " Key points: ").concat(chunkContext.keyPoints.join(', '), "] ").concat(analysis.description, " ").concat(analysis.detectedText || '');
    };
    return ImageAnalyzer;
}());
exports.ImageAnalyzer = ImageAnalyzer;
exports.default = ImageAnalyzer;

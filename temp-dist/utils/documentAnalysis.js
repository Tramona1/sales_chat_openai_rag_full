"use strict";
/**
 * Document Analysis Module
 *
 * This module provides a unified approach to document analysis, combining the functionality
 * of metadataExtractor.ts and geminiClient.ts (extractDocumentContext) into a single,
 * efficient function that makes only one LLM call.
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeDocument = analyzeDocument;
exports.batchAnalyzeDocuments = batchAnalyzeDocuments;
var geminiClient_1 = require("./geminiClient");
var openaiClient_1 = require("./openaiClient");
var documentCategories_1 = require("./documentCategories");
var logger_1 = require("./logger");
var caching_1 = require("./caching");
var metadata_1 = require("../types/metadata");
// Constants
var ANALYSIS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
var MAX_RETRIES = 2;
var DEFAULT_MODEL = 'gpt-4-turbo';
var FALLBACK_MODEL = 'gpt-3.5-turbo';
var GEMINI_MODEL = 'gemini-2.0-flash';
// Cache key prefix
var ANALYSIS_CACHE_KEY_PREFIX = 'document_analysis_';
// Primary model for document analysis
var PRIMARY_MODEL = 'gemini';
/**
 * Unified document analysis function that replaces both extractMetadata and extractDocumentContext
 * with a single, efficient LLM call
 *
 * @param text The document text to analyze
 * @param source The source identifier for the document
 * @param options Optional settings for the analysis
 * @returns Combined metadata and document context
 */
function analyzeDocument(text_1, source_1) {
    return __awaiter(this, arguments, void 0, function (text, source, options) {
        var useCaching, model, cacheKey, cachedAnalysis, textSample, startTime, analysisResult, processingTime, baseMetadata, result, cacheKey, error_1, fallbackResult;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    useCaching = options.useCaching !== false;
                    model = options.model || PRIMARY_MODEL;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    // Check cache first if caching is enabled
                    if (useCaching) {
                        cacheKey = "".concat(ANALYSIS_CACHE_KEY_PREFIX).concat(source);
                        cachedAnalysis = (0, caching_1.getFromCache)(cacheKey);
                        if (cachedAnalysis) {
                            (0, logger_1.logInfo)("Using cached document analysis for ".concat(source));
                            return [2 /*return*/, cachedAnalysis];
                        }
                    }
                    textSample = text.length > 10000
                        ? "".concat(text.substring(0, 10000), "... (truncated, full length: ").concat(text.length, " chars)")
                        : text;
                    // Try to analyze document with the primary model
                    (0, logger_1.logInfo)("Analyzing document for ".concat(source, " with ").concat(model, "..."));
                    startTime = Date.now();
                    analysisResult = void 0;
                    if (!(model === 'gemini' || model === GEMINI_MODEL)) return [3 /*break*/, 3];
                    (0, logger_1.logInfo)('Using Gemini model for document analysis...');
                    return [4 /*yield*/, analyzeDocumentWithLLM(textSample, 'gemini')];
                case 2:
                    analysisResult = _a.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, analyzeDocumentWithLLM(textSample, model)];
                case 4:
                    // Fallback to OpenAI
                    analysisResult = _a.sent();
                    _a.label = 5;
                case 5:
                    processingTime = Date.now() - startTime;
                    (0, logger_1.logInfo)("Document analysis completed in ".concat(processingTime, "ms"));
                    baseMetadata = (0, metadata_1.createDefaultMetadata)(source);
                    result = __assign(__assign({}, baseMetadata), { source: source, primaryCategory: mapToDocumentCategory(analysisResult.categories.primary) || documentCategories_1.DocumentCategoryType.GENERAL, secondaryCategories: analysisResult.categories.secondary
                            .filter(function (category) { return category && category.trim() !== ''; }) // Filter out empty categories
                            .map(mapToDocumentCategory)
                            .filter(Boolean), confidenceScore: calculateConfidenceScore(analysisResult, text), summary: analysisResult.summary, keyTopics: analysisResult.keyTopics || [], technicalLevel: analysisResult.technicalLevel || 1, keywords: analysisResult.keywords || [], entities: Array.isArray(analysisResult.entities)
                            ? analysisResult.entities.map(function (entity) { return ({
                                name: entity.name,
                                type: mapToEntityType(entity.type),
                                confidence: mapToConfidenceLevel(entity.confidence),
                                mentions: 1,
                            }); })
                            : [], qualityFlags: determineQualityFlags(analysisResult), approved: false, routingPriority: 3, 
                        // Document context portion
                        documentContext: {
                            summary: analysisResult.summary,
                            mainTopics: analysisResult.mainTopics || analysisResult.keyTopics || [],
                            entities: Array.isArray(analysisResult.entities)
                                ? analysisResult.entities.map(function (e) { return e.name; })
                                : [],
                            documentType: analysisResult.documentType || 'general',
                            technicalLevel: analysisResult.technicalLevel || 1,
                            audienceType: analysisResult.audienceType || []
                        } });
                    // Update routing priority based on category
                    updateRoutingPriority(result);
                    // Cache result if caching is enabled
                    if (useCaching) {
                        cacheKey = "".concat(ANALYSIS_CACHE_KEY_PREFIX).concat(source);
                        (0, caching_1.cacheWithExpiry)(cacheKey, result, ANALYSIS_CACHE_TTL);
                    }
                    return [2 /*return*/, result];
                case 6:
                    error_1 = _a.sent();
                    (0, logger_1.logError)('Document analysis failed', { source: source, error: error_1 });
                    fallbackResult = (0, metadata_1.createDefaultMetadata)(source);
                    fallbackResult.primaryCategory = (0, documentCategories_1.detectCategoryFromText)(text)[0];
                    fallbackResult.qualityFlags.push(documentCategories_1.QualityControlFlag.NEEDS_CLARIFICATION);
                    // Add minimal document context
                    fallbackResult.documentContext = {
                        summary: text.substring(0, 200) + "...",
                        mainTopics: extractBasicTopics(text),
                        entities: extractBasicEntities(text),
                        documentType: 'general',
                        technicalLevel: 3,
                        audienceType: ['general']
                    };
                    return [2 /*return*/, fallbackResult];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Use LLM to analyze document content in a single call
 */
function analyzeDocumentWithLLM(text, model) {
    return __awaiter(this, void 0, void 0, function () {
        var analysisSchema, systemPrompt, userPrompt, response, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    analysisSchema = {
                        type: 'object',
                        properties: {
                            categories: {
                                type: 'object',
                                properties: {
                                    primary: {
                                        type: 'string',
                                        description: "The primary category of the document. Choose from: ".concat(Object.values(documentCategories_1.DocumentCategoryType).join(', '))
                                    },
                                    secondary: {
                                        type: 'array',
                                        items: {
                                            type: 'string',
                                            description: "A relevant secondary category. Choose from: ".concat(Object.values(documentCategories_1.DocumentCategoryType).join(', '))
                                        },
                                        description: 'Secondary categories that also apply (0-3 categories recommended)'
                                    }
                                },
                                required: ['primary'] // Secondary is optional
                            },
                            summary: {
                                type: 'string',
                                description: 'A concise 1-2 sentence summary of the content'
                            },
                            keyTopics: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Key topics or concepts covered in the document (3-5 topics recommended)'
                            },
                            mainTopics: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Main topics covered in the document (similar to keyTopics, 3-5 recommended)'
                            },
                            technicalLevel: {
                                type: 'number',
                                description: 'Technical complexity level (1-5 scale: 1=very basic, 5=highly technical/expert)'
                            },
                            documentType: {
                                type: 'string',
                                description: 'The type of document (e.g., product description, user guide, API documentation, marketing blog, case study, policy, legal notice, etc.)'
                            },
                            keywords: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Important keywords or short phrases from the content (5-10 recommended)'
                            },
                            entities: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string', description: 'The name of the entity' },
                                        type: { type: 'string', description: "The type of entity. Choose from: ".concat(Object.values(documentCategories_1.EntityType).join(', ')) },
                                        confidence: { type: 'string', description: 'Confidence level (HIGH, MEDIUM, LOW)' }
                                    },
                                    required: ['name', 'type', 'confidence']
                                },
                                description: 'Named entities mentioned in the document (people, organizations, products, features, locations, etc.)'
                            },
                            qualityIssues: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Specific quality issues detected (e.g., outdated information, contradictory statements, missing context, unclear language, formatting problems)'
                            },
                            containsContradictions: {
                                type: 'boolean',
                                description: 'Whether the document contains clearly contradictory information'
                            },
                            needsClarification: {
                                type: 'boolean',
                                description: 'Whether the document contains significantly unclear or ambiguous content that requires clarification'
                            },
                            unreliableSource: {
                                type: 'boolean',
                                description: 'Whether the content seems to come from an unreliable source or contains highly questionable/unverified information'
                            },
                            audienceType: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Target audience types for this document (e.g., managers, hr professionals, developers, end-users, sales team, potential customers, specific industry roles)'
                            }
                        },
                        required: ['categories', 'summary', 'technicalLevel', 'documentType', 'keywords', 'entities'] // Made more fields required
                    };
                    systemPrompt = "\nYou are a document analysis expert. Analyze the provided document text for a Retrieval Augmented Generation (RAG) system. Extract structured information based precisely on the provided JSON schema.\n\nYour task is to extract:\n1.  Primary and Secondary Categories: Select the MOST appropriate primary category and up to 3 relevant secondary categories from the provided enum list in the schema description.\n2.  Summary: A concise 1-2 sentence summary.\n3.  Key Topics / Main Topics: 3-5 key concepts or topics.\n4.  Technical Level: Rate the technical complexity from 1 (very basic) to 10 (highly technical/expert) based on the schema definition.\n5.  Document Type: Identify the type of document (e.g., user guide, API doc, blog post).\n6.  Keywords: Extract 5-10 important keywords or short phrases.\n7.  Entities: Identify named entities (people, orgs, products, features, etc.), their type (choose from the enum list in the schema), and your confidence (HIGH, MEDIUM, LOW).\n8.  Quality Issues: List specific quality problems, if any.\n9.  Quality Flags: Indicate boolean flags for contradictions, need for clarification, or unreliability.\n10. Audience Type: Suggest likely target audiences.\n\nProvide the analysis ONLY as a single, valid JSON object conforming strictly to the schema.\n";
                    userPrompt = "\nAnalyze the following document:\n\n---\n".concat(text, "\n---\n\nReturn a single JSON object with all the requested fields. Be thorough but precise.\n");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    response = void 0;
                    if (!(model === 'gemini')) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, geminiClient_1.generateStructuredGeminiResponse)(systemPrompt, userPrompt, analysisSchema)];
                case 2:
                    // Use Gemini for structured response
                    response = _a.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, (0, openaiClient_1.generateStructuredResponse)(systemPrompt, userPrompt, analysisSchema, model)];
                case 4:
                    // Use OpenAI for structured response
                    response = _a.sent();
                    _a.label = 5;
                case 5:
                    result = {
                        categories: response.categories || { primary: 'GENERAL', secondary: [] },
                        summary: response.summary || '',
                        keyTopics: response.keyTopics || [],
                        mainTopics: response.mainTopics || response.keyTopics || [],
                        technicalLevel: response.technicalLevel !== undefined ? response.technicalLevel : 1,
                        documentType: response.documentType || 'general',
                        keywords: response.keywords || [],
                        entities: response.entities || [],
                        qualityIssues: response.qualityIssues || [],
                        containsContradictions: response.containsContradictions || false,
                        needsClarification: response.needsClarification || false,
                        unreliableSource: response.unreliableSource || false,
                        audienceType: response.audienceType || []
                    };
                    return [2 /*return*/, result];
                case 6:
                    error_2 = _a.sent();
                    // If structured generation fails, try again with a fallback model
                    if (model !== FALLBACK_MODEL) {
                        (0, logger_1.logWarning)("Structured analysis failed with ".concat(model, ", trying fallback model..."));
                        return [2 /*return*/, analyzeDocumentWithLLM(text, FALLBACK_MODEL)];
                    }
                    // If all fails, throw the error
                    (0, logger_1.logError)('Document analysis failed with all models', error_2);
                    throw error_2;
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Map a category string to a DocumentCategoryType enum value.
 * Performs basic normalization and checks if the value exists in the enum.
 */
function mapToDocumentCategory(category) {
    if (!category)
        return null;
    var formattedCategory = category.toUpperCase().trim().replace(/\s+/g, '_');
    // Check if the formatted category is a valid value in the enum
    if (Object.values(documentCategories_1.DocumentCategoryType).includes(formattedCategory)) {
        return formattedCategory;
    }
    // Log a warning if a category suggested by the LLM doesn't match our enum
    (0, logger_1.logWarning)("LLM suggested category \"".concat(category, "\" (formatted as \"").concat(formattedCategory, "\") does not match any standard DocumentCategoryType. Defaulting to GENERAL or discarding."));
    // Optionally, add more sophisticated mapping here if needed, otherwise return null or default
    // For now, we'll return null and let the calling function handle the default
    return null;
}
/**
 * Map an entity type string to the EntityType enum
 */
function mapToEntityType(entityType) {
    if (!entityType)
        return documentCategories_1.EntityType.OTHER;
    var normalizedType = entityType.toUpperCase().trim();
    // Use the correct EntityType enum values from documentCategories.ts
    var entityTypeMap = {
        'PERSON': documentCategories_1.EntityType.PERSON,
        'PEOPLE': documentCategories_1.EntityType.PERSON,
        'INDIVIDUAL': documentCategories_1.EntityType.PERSON,
        'COMPANY': documentCategories_1.EntityType.ORGANIZATION,
        'ORGANIZATION': documentCategories_1.EntityType.ORGANIZATION,
        'BUSINESS': documentCategories_1.EntityType.ORGANIZATION,
        'ENTERPRISE': documentCategories_1.EntityType.ORGANIZATION,
        'PRODUCT': documentCategories_1.EntityType.PRODUCT,
        'SERVICE': documentCategories_1.EntityType.PRODUCT,
        'SOLUTION': documentCategories_1.EntityType.PRODUCT,
        'TOOL': documentCategories_1.EntityType.PRODUCT,
        'FEATURE': documentCategories_1.EntityType.FEATURE,
        'CAPABILITY': documentCategories_1.EntityType.FEATURE,
        'FUNCTION': documentCategories_1.EntityType.FEATURE,
        'LOCATION': documentCategories_1.EntityType.LOCATION,
        'PLACE': documentCategories_1.EntityType.LOCATION,
        'GEOGRAPHY': documentCategories_1.EntityType.LOCATION,
        'EVENT': documentCategories_1.EntityType.DATE, // Map EVENT to DATE as a fallback
        'OCCURRENCE': documentCategories_1.EntityType.DATE, // Map OCCURRENCE to DATE as a fallback
        'DATE': documentCategories_1.EntityType.DATE,
        'TIME': documentCategories_1.EntityType.DATE,
        'CONCEPT': documentCategories_1.EntityType.OTHER, // Map CONCEPT to OTHER as a fallback
        'IDEA': documentCategories_1.EntityType.OTHER, // Map IDEA to OTHER as a fallback
        'THEORY': documentCategories_1.EntityType.OTHER // Map THEORY to OTHER as a fallback
    };
    for (var _i = 0, _a = Object.entries(entityTypeMap); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (normalizedType.includes(key)) {
            return value;
        }
    }
    return documentCategories_1.EntityType.OTHER;
}
/**
 * Map a confidence string to the ConfidenceLevel enum
 */
function mapToConfidenceLevel(confidence) {
    if (!confidence)
        return documentCategories_1.ConfidenceLevel.MEDIUM;
    var normalizedConfidence = confidence.toUpperCase().trim();
    if (normalizedConfidence.includes('HIGH') || normalizedConfidence.includes('CERTAIN')) {
        return documentCategories_1.ConfidenceLevel.HIGH;
    }
    else if (normalizedConfidence.includes('LOW') || normalizedConfidence.includes('UNCERTAIN')) {
        return documentCategories_1.ConfidenceLevel.LOW;
    }
    return documentCategories_1.ConfidenceLevel.MEDIUM;
}
/**
 * Determine quality flags based on LLM analysis
 */
function determineQualityFlags(analysis) {
    var flags = [];
    if (analysis.needsClarification) {
        flags.push(documentCategories_1.QualityControlFlag.NEEDS_CLARIFICATION);
    }
    if (analysis.containsContradictions) {
        flags.push(documentCategories_1.QualityControlFlag.CONTAINS_CONTRADICTIONS);
    }
    if (analysis.unreliableSource) {
        flags.push(documentCategories_1.QualityControlFlag.UNRELIABLE_SOURCE);
    }
    if (analysis.qualityIssues && analysis.qualityIssues.length > 0) {
        var issues = analysis.qualityIssues.map(function (issue) { return issue.toLowerCase(); });
        if (issues.some(function (issue) { return issue.includes('outdated') || issue.includes('old'); })) {
            flags.push(documentCategories_1.QualityControlFlag.OUTDATED_CONTENT);
        }
        if (issues.some(function (issue) { return issue.includes('incomplete') || issue.includes('missing'); })) {
            flags.push(documentCategories_1.QualityControlFlag.INCOMPLETE_CONTENT);
        }
        if (issues.some(function (issue) { return issue.includes('formatting') || issue.includes('structure'); })) {
            flags.push(documentCategories_1.QualityControlFlag.FORMATTING_ISSUES);
        }
    }
    return flags;
}
/**
 * Calculate confidence score based on metadata completeness
 */
function calculateConfidenceScore(analysis, text) {
    var score = 0.5; // Start with neutral score
    // Quality of summary
    if (analysis.summary && analysis.summary.length > 20) {
        score += 0.1;
    }
    // Number of topics identified
    if (analysis.keyTopics && analysis.keyTopics.length >= 3) {
        score += 0.1;
    }
    // Number of entities identified
    if (analysis.entities && analysis.entities.length > 0) {
        score += 0.1;
    }
    // Quality issues detected
    if (analysis.qualityIssues && analysis.qualityIssues.length > 0) {
        score -= 0.1;
    }
    // Contradictions, clarity issues, or reliability concerns
    if (analysis.containsContradictions || analysis.needsClarification || analysis.unreliableSource) {
        score -= 0.15;
    }
    // Text length (longer texts might have more complete analysis)
    if (text.length > 3000) {
        score += 0.05;
    }
    // Cap the score between 0.1 and 1.0
    return Math.max(0.1, Math.min(1.0, score));
}
/**
 * Update routing priority based on document category
 */
function updateRoutingPriority(metadata) {
    if (!metadata.primaryCategory)
        return;
    var categoryAttributes = (0, documentCategories_1.getCategoryAttributes)(metadata.primaryCategory);
    if (categoryAttributes && categoryAttributes.routingPriority !== undefined) {
        metadata.routingPriority = categoryAttributes.routingPriority;
    }
}
/**
 * Extract basic topics from text (fallback method)
 */
function extractBasicTopics(text) {
    // Very basic keyword extraction - in real fallback, more sophisticated NLP would be used
    var words = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(function (word) { return word.length > 4; });
    var wordCounts = {};
    words.forEach(function (word) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    return Object.entries(wordCounts)
        .sort(function (a, b) { return b[1] - a[1]; })
        .slice(0, 5)
        .map(function (_a) {
        var word = _a[0];
        return word;
    });
}
/**
 * Extract basic entities from text (fallback method)
 */
function extractBasicEntities(text) {
    // Very basic entity extraction - just look for capitalized words
    var capitalizedWords = text.match(/\b[A-Z][a-zA-Z]+\b/g) || [];
    var uniqueEntities = __spreadArray([], new Set(capitalizedWords), true);
    return uniqueEntities.slice(0, 10);
}
/**
 * Batch process multiple documents
 */
function batchAnalyzeDocuments(documents_1) {
    return __awaiter(this, arguments, void 0, function (documents, options) {
        var concurrency, results, i, batch, batchPromises, batchResults;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    concurrency = options.concurrency || 3;
                    results = [];
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < documents.length)) return [3 /*break*/, 4];
                    batch = documents.slice(i, i + concurrency);
                    batchPromises = batch.map(function (doc) {
                        return analyzeDocument(doc.text, doc.source, options);
                    });
                    return [4 /*yield*/, Promise.all(batchPromises)];
                case 2:
                    batchResults = _a.sent();
                    results.push.apply(results, batchResults);
                    _a.label = 3;
                case 3:
                    i += concurrency;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, results];
            }
        });
    });
}

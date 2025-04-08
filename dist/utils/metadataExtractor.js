"use strict";
/**
 * Metadata Extraction Module
 *
 * This module provides functions to extract structured metadata from documents
 * using LLMs (OpenAI/Gemini).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractMetadata = extractMetadata;
exports.batchExtractMetadata = batchExtractMetadata;
const openaiClient_1 = require("./openaiClient");
const errorHandling_1 = require("./errorHandling");
const caching_1 = require("./caching");
const documentCategories_1 = require("./documentCategories");
const geminiClient_1 = require("./geminiClient");
const metadata_1 = require("../types/metadata");
// Constants
const METADATA_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RETRIES = 2;
const DEFAULT_MODEL = 'gpt-4-turbo';
const FALLBACK_MODEL = 'gpt-3.5-turbo';
const GEMINI_MODEL = 'gemini-1.5-pro';
// Cache key prefix
const METADATA_CACHE_KEY_PREFIX = 'metadata_extraction_';
// Primary model for metadata extraction
const PRIMARY_MODEL = 'gemini';
/**
 * Extract metadata from document text
 */
async function extractMetadata(text, source, options = {}) {
    const useCaching = options.useCaching !== false;
    const model = options.model || DEFAULT_MODEL;
    try {
        // Check cache first if caching is enabled
        if (useCaching) {
            const cacheKey = `${METADATA_CACHE_KEY_PREFIX}${source}`;
            const cachedMetadata = (0, caching_1.getFromCache)(cacheKey);
            if (cachedMetadata) {
                console.log(`Using cached metadata for ${source}`);
                return cachedMetadata;
            }
        }
        // Prepare text sample (truncate if too long)
        const textSample = text.length > 8000
            ? `${text.substring(0, 8000)}... (truncated, full length: ${text.length} chars)`
            : text;
        // Try to extract metadata with the primary model
        console.log(`Extracting metadata for ${source} with ${model}...`);
        const startTime = Date.now();
        let llmMetadata;
        if (model === 'gemini' || model === GEMINI_MODEL) {
            console.log('Using Gemini model for metadata extraction...');
            llmMetadata = await extractMetadataWithLLM(textSample, 'gemini');
        }
        else {
            // Fallback to OpenAI
            llmMetadata = await extractMetadataWithLLM(textSample, model);
        }
        const processingTime = Date.now() - startTime;
        console.log(`Metadata extraction completed in ${processingTime}ms`);
        // Convert to enhanced metadata
        const metadata = {
            source,
            primaryCategory: mapToDocumentCategory(llmMetadata.categories.primary) || documentCategories_1.DocumentCategoryType.GENERAL,
            secondaryCategories: llmMetadata.categories.secondary
                .map(mapToDocumentCategory)
                .filter(Boolean),
            confidenceScore: calculateConfidenceScore(llmMetadata, text),
            summary: llmMetadata.summary,
            keyTopics: llmMetadata.keyTopics || [],
            technicalLevel: llmMetadata.technicalLevel || 1,
            keywords: llmMetadata.keywords || [],
            entities: Array.isArray(llmMetadata.entities)
                ? llmMetadata.entities.map((entity) => ({
                    name: entity.name,
                    type: mapToEntityType(entity.type),
                    confidence: mapToConfidenceLevel(entity.confidence),
                    mentions: 1,
                }))
                : [], // Return empty array if entities is not an array
            qualityFlags: determineQualityFlags(llmMetadata),
            approved: false,
            routingPriority: 3,
        };
        // Update routing priority based on category
        updateRoutingPriority(metadata);
        // Cache result if caching is enabled
        if (useCaching) {
            const cacheKey = `${METADATA_CACHE_KEY_PREFIX}${source}`;
            (0, caching_1.cacheWithExpiry)(cacheKey, metadata, METADATA_CACHE_TTL);
        }
        return metadata;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Metadata extraction failed', { source, error });
        // Fallback to simple metadata with rules-based categorization
        const fallbackMetadata = (0, metadata_1.createDefaultMetadata)(source);
        fallbackMetadata.primaryCategory = (0, documentCategories_1.detectCategoryFromText)(text)[0];
        fallbackMetadata.qualityFlags.push(documentCategories_1.QualityControlFlag.NEEDS_CLARIFICATION);
        return fallbackMetadata;
    }
}
/**
 * Use LLM to extract detailed metadata from text
 */
async function extractMetadataWithLLM(text, model) {
    // Define the schema for structured extraction
    const extractionSchema = {
        type: 'object',
        properties: {
            categories: {
                type: 'object',
                properties: {
                    primary: {
                        type: 'string',
                        description: 'The primary category of the document'
                    },
                    secondary: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Secondary categories that also apply'
                    }
                },
                required: ['primary', 'secondary']
            },
            summary: {
                type: 'string',
                description: 'A concise 1-2 sentence summary of the content'
            },
            keyTopics: {
                type: 'array',
                items: { type: 'string' },
                description: 'Key topics covered in the document (3-5 topics)'
            },
            technicalLevel: {
                type: 'number',
                minimum: 1,
                maximum: 5,
                description: 'Technical complexity level (1-5, where 1 is non-technical and 5 is highly technical)'
            },
            keywords: {
                type: 'array',
                items: { type: 'string' },
                description: 'Important keywords from the content (5-10 keywords)'
            },
            entities: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        type: { type: 'string', enum: ['person', 'organization', 'product', 'feature', 'price', 'date', 'location'] },
                        confidence: { type: 'string', enum: ['high', 'medium', 'low', 'uncertain'] }
                    },
                    required: ['name', 'type', 'confidence']
                },
                description: 'Named entities mentioned in the text'
            },
            qualityIssues: {
                type: 'array',
                items: { type: 'string' },
                description: 'Any quality issues identified in the content'
            },
            containsContradictions: {
                type: 'boolean',
                description: 'Whether the content contains contradictory information'
            },
            needsClarification: {
                type: 'boolean',
                description: 'Whether the content needs clarification or is ambiguous'
            },
            unreliableSource: {
                type: 'boolean',
                description: 'Whether the source appears to be unreliable'
            }
        },
        required: [
            'categories',
            'summary',
            'keyTopics',
            'technicalLevel',
            'keywords',
            'entities',
            'containsContradictions',
            'needsClarification'
        ]
    };
    // System prompt for extraction
    const systemPrompt = `You are an expert document analyzer. Your task is to extract structured metadata from the provided document chunk.
  
Focus on accurately categorizing the document, identifying key entities, and determining the technical level. 
  
For document categories, choose from:
- PRODUCT: Information about products
- TECHNICAL: Technical documentation
- FEATURES: Feature descriptions
- PRICING: Pricing information
- CUSTOMER: Customer case studies or testimonials
- COMPANY: Information about the company
- FAQ: Frequently asked questions
- BLOG: Blog post or article
- GENERAL: General information`;
    // Try with backoff strategy for rate limits
    const maxRetries = 3;
    const baseDelay = 2000; // Start with a 2-second delay
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Log which model is being used
            console.log(`Attempt ${attempt + 1}/${maxRetries + 1} - Using ${model === 'gemini' ? 'Gemini' : model} model for metadata extraction`);
            if (model === 'gemini' || model === GEMINI_MODEL) {
                try {
                    return await (0, geminiClient_1.generateStructuredGeminiResponse)(systemPrompt, text, extractionSchema);
                }
                catch (error) {
                    console.log('Gemini extraction failed, falling back to OpenAI:', error);
                    // Fall back to OpenAI if Gemini fails
                    return await (0, openaiClient_1.generateStructuredResponse)(systemPrompt, text, extractionSchema, DEFAULT_MODEL);
                }
            }
            else {
                // Use OpenAI
                return await (0, openaiClient_1.generateStructuredResponse)(systemPrompt, text, extractionSchema, model);
            }
        }
        catch (error) {
            // Check if it's a rate limit error (status code 429)
            const isRateLimit = (error === null || error === void 0 ? void 0 : error.status) === 429 ||
                (error === null || error === void 0 ? void 0 : error.code) === 'rate_limit_exceeded' ||
                ((error === null || error === void 0 ? void 0 : error.message) && (error === null || error === void 0 ? void 0 : error.message.includes('Rate limit'))) ||
                ((error === null || error === void 0 ? void 0 : error.errorDetails) && (error === null || error === void 0 ? void 0 : error.errorDetails.some((detail) => { var _a; return (_a = detail['@type']) === null || _a === void 0 ? void 0 : _a.includes('QuotaFailure'); })));
            if (isRateLimit && attempt < maxRetries) {
                // Calculate delay with exponential backoff and jitter
                const jitter = Math.random() * 0.3 + 0.85; // Random between 0.85 and 1.15
                const delay = Math.min(baseDelay * Math.pow(2, attempt) * jitter, 30000); // Cap at 30 seconds
                console.log(`Rate limit hit. Retrying in ${Math.round(delay / 1000)} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                // For alternating between Gemini and OpenAI on retries
                if (model === 'gemini') {
                    console.log('Switching to OpenAI model for next attempt...');
                    model = DEFAULT_MODEL;
                }
                else if (model.includes('gpt-4')) {
                    console.log('Switching to fallback model for next attempt...');
                    model = FALLBACK_MODEL;
                }
                continue;
            }
            // If it's not a rate limit error or we've run out of retries, log and throw
            (0, errorHandling_1.logError)('Error in extractMetadataWithLLM', error);
            throw error;
        }
    }
    // This should not be reached because the last attempt will either return or throw
    throw new Error('Failed to extract metadata after multiple attempts');
}
/**
 * Map a string category to DocumentCategoryType enum
 */
function mapToDocumentCategory(category) {
    const normalizedCategory = category.toLowerCase().trim().replace(/\s+/g, '_');
    // Map to our enum values
    const categoryMap = {
        'product': documentCategories_1.DocumentCategoryType.PRODUCT,
        'pricing': documentCategories_1.DocumentCategoryType.PRICING,
        'price': documentCategories_1.DocumentCategoryType.PRICING,
        'features': documentCategories_1.DocumentCategoryType.FEATURES,
        'feature': documentCategories_1.DocumentCategoryType.FEATURES,
        'technical': documentCategories_1.DocumentCategoryType.TECHNICAL,
        'customer': documentCategories_1.DocumentCategoryType.CUSTOMER,
        'case_study': documentCategories_1.DocumentCategoryType.CASE_STUDY,
        'success_story': documentCategories_1.DocumentCategoryType.CASE_STUDY,
        'testimonial': documentCategories_1.DocumentCategoryType.TESTIMONIAL,
        'sales_process': documentCategories_1.DocumentCategoryType.SALES_PROCESS,
        'competitors': documentCategories_1.DocumentCategoryType.COMPETITORS,
        'competitor': documentCategories_1.DocumentCategoryType.COMPETITORS,
        'market': documentCategories_1.DocumentCategoryType.MARKET,
        'internal_policy': documentCategories_1.DocumentCategoryType.INTERNAL_POLICY,
        'policy': documentCategories_1.DocumentCategoryType.INTERNAL_POLICY,
        'training': documentCategories_1.DocumentCategoryType.TRAINING,
        'faq': documentCategories_1.DocumentCategoryType.FAQ,
        'general': documentCategories_1.DocumentCategoryType.GENERAL,
        'other': documentCategories_1.DocumentCategoryType.OTHER
    };
    return categoryMap[normalizedCategory] || null;
}
/**
 * Map a string entity type to EntityType enum
 */
function mapToEntityType(entityType) {
    const normalizedType = entityType.toLowerCase().trim();
    const typeMap = {
        'person': documentCategories_1.EntityType.PERSON,
        'organization': documentCategories_1.EntityType.ORGANIZATION,
        'company': documentCategories_1.EntityType.ORGANIZATION,
        'product': documentCategories_1.EntityType.PRODUCT,
        'feature': documentCategories_1.EntityType.FEATURE,
        'price': documentCategories_1.EntityType.PRICE,
        'cost': documentCategories_1.EntityType.PRICE,
        'date': documentCategories_1.EntityType.DATE,
        'location': documentCategories_1.EntityType.LOCATION,
        'place': documentCategories_1.EntityType.LOCATION
    };
    return typeMap[normalizedType] || documentCategories_1.EntityType.ORGANIZATION;
}
/**
 * Map a string confidence level to ConfidenceLevel enum
 */
function mapToConfidenceLevel(confidence) {
    const normalizedConfidence = confidence.toLowerCase().trim();
    switch (normalizedConfidence) {
        case 'high':
            return documentCategories_1.ConfidenceLevel.HIGH;
        case 'medium':
            return documentCategories_1.ConfidenceLevel.MEDIUM;
        case 'low':
            return documentCategories_1.ConfidenceLevel.LOW;
        case 'uncertain':
        default:
            return documentCategories_1.ConfidenceLevel.UNCERTAIN;
    }
}
/**
 * Determine quality control flags based on LLM analysis
 */
function determineQualityFlags(llmMetadata) {
    const flags = [documentCategories_1.QualityControlFlag.PENDING_REVIEW];
    if (llmMetadata === null || llmMetadata === void 0 ? void 0 : llmMetadata.containsContradictions) {
        flags.push(documentCategories_1.QualityControlFlag.CONTAINS_CONTRADICTIONS);
    }
    if (llmMetadata === null || llmMetadata === void 0 ? void 0 : llmMetadata.needsClarification) {
        flags.push(documentCategories_1.QualityControlFlag.NEEDS_CLARIFICATION);
    }
    if (llmMetadata === null || llmMetadata === void 0 ? void 0 : llmMetadata.unreliableSource) {
        flags.push(documentCategories_1.QualityControlFlag.UNRELIABLE_SOURCE);
    }
    if ((llmMetadata === null || llmMetadata === void 0 ? void 0 : llmMetadata.qualityIssues) && Array.isArray(llmMetadata.qualityIssues) &&
        llmMetadata.qualityIssues.some(issue => issue.toLowerCase().includes('outdated'))) {
        flags.push(documentCategories_1.QualityControlFlag.OUTDATED);
    }
    return flags;
}
/**
 * Calculate confidence score based on metadata and text
 */
function calculateConfidenceScore(metadata, text) {
    let score = 0.5; // Start with a baseline score
    // Safely handle potentially undefined properties
    const keywords = Array.isArray(metadata === null || metadata === void 0 ? void 0 : metadata.keywords) ? metadata.keywords : [];
    const entities = Array.isArray(metadata === null || metadata === void 0 ? void 0 : metadata.entities) ? metadata.entities : [];
    const qualityIssues = Array.isArray(metadata === null || metadata === void 0 ? void 0 : metadata.qualityIssues) ? metadata.qualityIssues : [];
    // Boost score based on the number of keywords found
    const keywordBoost = Math.min(0.2, keywords.length * 0.02);
    score += keywordBoost;
    // Boost score based on the number of entities found
    const entityBoost = Math.min(0.2, entities.length * 0.03);
    score += entityBoost;
    // Reduce score if there are quality issues
    if (qualityIssues.length > 0) {
        score -= qualityIssues.length * 0.1;
    }
    // Reduce score if it contains contradictions
    if (metadata === null || metadata === void 0 ? void 0 : metadata.containsContradictions) {
        score -= 0.2;
    }
    // Reduce score if it needs clarification
    if (metadata === null || metadata === void 0 ? void 0 : metadata.needsClarification) {
        score -= 0.1;
    }
    // Cap the score between 0 and 1
    return Math.min(Math.max(score, 0), 1);
}
/**
 * Update routing priority based on primary category
 */
function updateRoutingPriority(metadata) {
    // Get the category attributes from documentCategories module
    const categoryAttributes = (0, documentCategories_1.getCategoryAttributes)(metadata.primaryCategory);
    // Update routing priority based on category attributes
    if (categoryAttributes && categoryAttributes.routingPriority) {
        metadata.routingPriority = categoryAttributes.routingPriority;
    }
}
/**
 * Batch process multiple documents for metadata extraction
 */
async function batchExtractMetadata(documents, options = {}) {
    const { concurrency = 3 } = options;
    console.log(`Batch processing ${documents.length} documents for metadata extraction with concurrency ${concurrency}`);
    // Process in batches to control concurrency
    const results = [];
    for (let i = 0; i < documents.length; i += concurrency) {
        const batch = documents.slice(i, i + concurrency);
        // Process each document in the batch concurrently
        const batchPromises = batch.map(doc => extractMetadata(doc.text, doc.source, options));
        // Wait for the current batch to complete
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        console.log(`Completed batch ${i / concurrency + 1}/${Math.ceil(documents.length / concurrency)} (${batchResults.length} documents)`);
    }
    return results;
}

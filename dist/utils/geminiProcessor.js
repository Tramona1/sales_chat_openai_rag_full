"use strict";
/**
 * Gemini Document Processing Utility
 *
 * This module handles interaction with Google's Gemini API for document analysis,
 * metadata extraction, categorization, and conflict detection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDocumentWithGemini = processDocumentWithGemini;
exports.processDocumentWithEnhancedLabels = processDocumentWithEnhancedLabels;
exports.analyzeQueryWithGemini = analyzeQueryWithGemini;
exports.detectConflictWithGemini = detectConflictWithGemini;
exports.convertAnalysisToMetadata = convertAnalysisToMetadata;
exports.convertEnhancedAnalysisToMetadata = convertEnhancedAnalysisToMetadata;
const generative_ai_1 = require("@google/generative-ai");
const errorHandling_1 = require("./errorHandling");
const documentCategories_1 = require("./documentCategories");
// Initialize Gemini API client
const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new generative_ai_1.GoogleGenerativeAI(API_KEY);
const MODEL_NAME = 'gemini-pro';
/**
 * Generate system prompt for document analysis
 */
function generateDocumentAnalysisPrompt(text) {
    return `
You are an AI assistant specializing in document analysis and categorization for a knowledge base system.

Analyze the following document and extract structured information. The document may contain information about a company, products, pricing, leadership, features, etc.

DOCUMENT:
${text}

Provide a detailed analysis in the following JSON format:
{
  "summary": "A concise summary of the document (max 150 words)",
  "contentType": "One of: [leadership, product, pricing, technical, company_info, feature, support, competitors, other]",
  "primaryCategory": "The main category of this document",
  "secondaryCategories": ["Other relevant categories"],
  "technicalLevel": "A number from 0-3 where 0 is non-technical and 3 is highly technical",
  "entities": {
    "people": [
      {"name": "Person name", "role": "Their role if mentioned", "importance": "high/medium/low"}
    ],
    "companies": [
      {"name": "Company name", "relationship": "Relationship to main company if any"}
    ],
    "products": ["List of products mentioned"],
    "features": ["List of features mentioned"]
  },
  "keywords": ["Important keywords from the document"],
  "topics": ["Main topics covered"],
  "confidenceScore": "A number from 0-1 indicating your confidence in this analysis"
}

Focus particularly on:
1. Leadership information - identify CEOs, founders, and executives
2. Company-specific information
3. Product details and features
4. Technical specifications
5. Pricing information

Be as accurate and comprehensive as possible. If information is not present, use empty arrays or null values rather than inventing information.
`;
}
/**
 * Generate system prompt for enhanced document analysis with more detailed categorization
 */
function generateEnhancedAnalysisPrompt(text) {
    return `
You are an AI assistant specializing in document analysis and detailed categorization for an advanced knowledge base system.

Analyze the following document and extract comprehensive structured information with detailed categories, entities, and metadata. The document may contain information about companies, products, technologies, services, etc.

DOCUMENT:
${text}

Provide a detailed analysis in the following JSON format:
{
  "summary": "A concise summary of the document (max 150 words)",
  "contentType": "One of: [leadership, product, pricing, technical, company_info, feature, support, competitor, partner, market, training, legal, policy, other]",
  
  "primaryCategory": "The main category of this document",
  "secondaryCategories": ["Other relevant categories"],
  "industryCategories": ["Relevant industry sectors like healthcare, finance, retail, etc."],
  "functionCategories": ["Relevant business functions like marketing, sales, support, development"],
  "useCases": ["Specific use cases the document addresses"],
  
  "technicalLevel": "A number from 0-3 where 0 is non-technical and 3 is highly technical",
  "complexityScore": "A number from 0-5 rating the complexity of content (0=simple, 5=very complex)",
  
  "topics": ["Main topics covered in the document"],
  "subtopics": ["More specific subtopics covered"],
  
  "entities": {
    "people": [
      {
        "name": "Person name",
        "role": "Their role if mentioned",
        "importance": "high/medium/low",
        "sentiment": "positive/neutral/negative",
        "relationships": [
          {"entity": "Related entity", "relationship": "Nature of relationship"}
        ]
      }
    ],
    "companies": [
      {
        "name": "Company name",
        "relationship": "Relationship to main company if any",
        "type": "competitor/partner/customer/vendor",
        "importance": "high/medium/low"
      }
    ],
    "products": [
      {
        "name": "Product name",
        "version": "Version if mentioned",
        "category": "Product category"
      }
    ],
    "features": [
      {
        "name": "Feature name",
        "product": "Associated product if mentioned",
        "status": "current/planned/deprecated if mentioned"
      }
    ],
    "locations": ["Locations mentioned"],
    "dates": [
      {
        "date": "Date mentioned",
        "context": "Context of this date (e.g., product launch, meeting)"
      }
    ]
  },
  
  "keywords": ["Important keywords from the document"],
  "semanticKeywords": ["Related terms that might not appear directly in the text but are semantically relevant"],
  
  "confidenceScore": "A number from 0-1 indicating your confidence in this analysis",
  "authorityScore": "A number from 0-1 indicating how authoritative this document appears to be",
  "recencyIndicators": {
    "hasTimestamps": true/false,
    "mostRecentDate": "The most recent date mentioned in the document if any",
    "likelyOutdated": true/false
  }
}

Be as detailed and accurate as possible, but do not invent information not present in the document. If information is not available, use empty arrays or null values.
`;
}
/**
 * Process a document using Gemini API
 * @param text Document text
 * @returns Structured analysis of the document
 */
async function processDocumentWithGemini(text) {
    try {
        (0, errorHandling_1.logInfo)('Processing document with Gemini', {
            textLength: text.length,
            textPreview: text.substring(0, 100) + '...'
        });
        // Create model instance with safety settings
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            safetySettings: [
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
            ],
        });
        // Generate prompt
        const prompt = generateDocumentAnalysisPrompt(text);
        // Generate response
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();
        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to extract JSON from Gemini response');
        }
        // Parse JSON
        const analysis = JSON.parse(jsonMatch[0]);
        (0, errorHandling_1.logInfo)('Document processed successfully with Gemini', {
            contentType: analysis.contentType,
            primaryCategory: analysis.primaryCategory,
            confidenceScore: analysis.confidenceScore
        });
        return analysis;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error processing document with Gemini', error);
        // Return fallback minimal analysis
        return {
            summary: 'Failed to generate summary due to processing error',
            contentType: 'other',
            primaryCategory: 'GENERAL',
            secondaryCategories: [],
            technicalLevel: 0,
            entities: {
                people: [],
                companies: [],
                products: [],
                features: []
            },
            keywords: [],
            topics: [],
            confidenceScore: 0
        };
    }
}
/**
 * Process a document with enhanced labeling capabilities
 * This expands on the basic document processing with more detailed categories,
 * better entity recognition, and hierarchical classification
 *
 * @param text Document text
 * @returns Enhanced document analysis with detailed categorization
 */
async function processDocumentWithEnhancedLabels(text) {
    var _a, _b;
    try {
        (0, errorHandling_1.logInfo)('Processing document with enhanced labeling', {
            textLength: text.length,
            textPreview: text.substring(0, 100) + '...'
        });
        // Create model instance with safety settings
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            safetySettings: [
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
            ],
        });
        // Generate prompt with enhanced categorization requirements
        const prompt = generateEnhancedAnalysisPrompt(text);
        // Generate response
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();
        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to extract JSON from Gemini response');
        }
        // Parse JSON
        const analysis = JSON.parse(jsonMatch[0]);
        (0, errorHandling_1.logInfo)('Document processed successfully with enhanced labeling', {
            contentType: analysis.contentType,
            primaryCategory: analysis.primaryCategory,
            industryCategories: ((_a = analysis.industryCategories) === null || _a === void 0 ? void 0 : _a.length) || 0,
            functionCategories: ((_b = analysis.functionCategories) === null || _b === void 0 ? void 0 : _b.length) || 0,
            confidenceScore: analysis.confidenceScore
        });
        return analysis;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error processing document with enhanced labeling', error);
        // Return fallback minimal analysis
        return {
            summary: 'Failed to generate summary due to processing error',
            contentType: 'other',
            primaryCategory: 'GENERAL',
            secondaryCategories: [],
            industryCategories: [],
            functionCategories: [],
            useCases: [],
            technicalLevel: 0,
            complexityScore: 0,
            topics: [],
            subtopics: [],
            entities: {
                people: [],
                companies: [],
                products: [],
                features: [],
                locations: [],
                dates: []
            },
            keywords: [],
            semanticKeywords: [],
            confidenceScore: 0,
            authorityScore: 0,
            recencyIndicators: {
                hasTimestamps: false,
                likelyOutdated: false
            }
        };
    }
}
/**
 * Analyze a user query using Gemini
 * @param query User query text
 * @returns Analysis of query intent and structure
 */
async function analyzeQueryWithGemini(query) {
    try {
        (0, errorHandling_1.logInfo)('Analyzing query with Gemini', { query });
        // Create model
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        // Generate prompt
        const prompt = `
You are an AI assistant specializing in query analysis for a knowledge base system.

Analyze the following user query and extract structured information about its intent and entities.

QUERY: "${query}"

Provide your analysis in the following JSON format:
{
  "intent": "One of: [factual, technical, comparison, overview]",
  "entities": [
    {
      "type": "The entity type (person, company, product, feature, etc.)",
      "name": "The entity name",
      "importance": "A number from 0-1 indicating entity importance to the query"
    }
  ],
  "suggestedFilters": {
    // Any filters that should be applied to the search, such as
    "categories": ["Relevant categories"],
    "technicalLevel": "Suggested technical level (0-3)"
  },
  "expectedContentTypes": ["Types of content that would best answer this query"],
  "confidence": "A number from 0-1 indicating your confidence in this analysis"
}
`;
        // Generate response
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();
        // Extract JSON
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to extract JSON from Gemini response');
        }
        // Parse JSON
        const analysis = JSON.parse(jsonMatch[0]);
        (0, errorHandling_1.logInfo)('Query analyzed successfully with Gemini', {
            intent: analysis.intent,
            entityCount: analysis.entities.length,
            confidence: analysis.confidence
        });
        return analysis;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error analyzing query with Gemini', error);
        // Return fallback analysis
        return {
            intent: 'factual',
            entities: [],
            suggestedFilters: {},
            expectedContentTypes: [],
            confidence: 0
        };
    }
}
/**
 * Check for conflicts between documents using Gemini
 * @param doc1 First document
 * @param doc2 Second document
 * @returns Analysis of potential conflicts
 */
async function detectConflictWithGemini(doc1, doc2) {
    try {
        // Create model
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        // Generate prompt
        const prompt = `
You are an AI assistant specializing in detecting contradictions and conflicts between documents.

Analyze the following two documents and determine if they contain conflicting information.

DOCUMENT 1 (ID: ${doc1.id}):
${doc1.text}

DOCUMENT 2 (ID: ${doc2.id}):
${doc2.text}

Provide your analysis in the following JSON format:
{
  "hasConflict": true/false,
  "conflictType": "One of: [contradictory, outdated, incomplete, duplicate, none]",
  "conflictDescription": "Description of the specific conflict or contradiction if any",
  "confidence": "A number from 0-1 indicating your confidence in this analysis",
  "preferredDocument": "ID of the document that seems more authoritative or recent, or null if equal"
}

Focus particularly on:
1. Leadership information - conflicting CEOs or executive roles
2. Product information - contradictory features or specifications
3. Pricing information - different pricing models
4. Timeline inconsistencies - when products were launched, features added, etc.

Only report genuine conflicts where information directly contradicts, not just different topics.
`;
        // Generate response
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();
        // Extract JSON
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to extract JSON from Gemini response');
        }
        // Parse JSON
        const analysis = JSON.parse(jsonMatch[0]);
        (0, errorHandling_1.logInfo)('Conflict detection completed with Gemini', {
            hasConflict: analysis.hasConflict,
            conflictType: analysis.conflictType,
            confidence: analysis.confidence,
            preferredDocument: analysis.preferredDocument
        });
        return analysis;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error detecting conflicts with Gemini', error);
        // Return fallback result
        return {
            hasConflict: false,
            confidence: 0
        };
    }
}
/**
 * Convert Gemini analysis to document metadata
 * @param analysis Gemini document analysis
 * @returns Metadata suitable for storage in vector database
 */
function convertAnalysisToMetadata(analysis) {
    // Map content type to document category
    const categoryMapping = {
        'leadership': documentCategories_1.DocumentCategoryType.PRODUCT,
        'product': documentCategories_1.DocumentCategoryType.PRODUCT,
        'pricing': documentCategories_1.DocumentCategoryType.PRICING,
        'technical': documentCategories_1.DocumentCategoryType.TECHNICAL,
        'company_info': documentCategories_1.DocumentCategoryType.GENERAL,
        'feature': documentCategories_1.DocumentCategoryType.FEATURES,
        'support': documentCategories_1.DocumentCategoryType.FAQ,
        'competitor': documentCategories_1.DocumentCategoryType.COMPETITORS,
        'partner': documentCategories_1.DocumentCategoryType.CUSTOMER,
        'market': documentCategories_1.DocumentCategoryType.MARKET,
        'training': documentCategories_1.DocumentCategoryType.TRAINING,
        'legal': documentCategories_1.DocumentCategoryType.INTERNAL_POLICY,
        'policy': documentCategories_1.DocumentCategoryType.INTERNAL_POLICY,
        'other': documentCategories_1.DocumentCategoryType.OTHER
    };
    // Extract CEO information if present
    const ceoInfo = analysis.entities.people.find(p => {
        var _a, _b, _c;
        return ((_a = p.role) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('ceo')) ||
            ((_b = p.role) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes('chief executive')) ||
            ((_c = p.role) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes('founder'));
    });
    return {
        // Core metadata
        category: categoryMapping[analysis.contentType] || documentCategories_1.DocumentCategoryType.GENERAL,
        primaryCategory: categoryMapping[analysis.primaryCategory] || documentCategories_1.DocumentCategoryType.GENERAL,
        secondaryCategories: analysis.secondaryCategories
            .map(c => categoryMapping[c] || null)
            .filter(Boolean),
        technicalLevel: analysis.technicalLevel,
        // Enhanced metadata
        summary: analysis.summary,
        keywords: analysis.keywords.join(','),
        entities: analysis.entities.people
            .map(p => p.name)
            .concat(analysis.entities.companies.map(c => c.name))
            .join(','),
        // Special fields
        hasCeoInfo: !!ceoInfo,
        ceoName: (ceoInfo === null || ceoInfo === void 0 ? void 0 : ceoInfo.name) || null,
        // Confidence and timestamps
        confidenceScore: analysis.confidenceScore,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
    };
}
/**
 * Convert enhanced analysis to document metadata
 * Maps the detailed Gemini analysis to metadata format suitable for storage
 *
 * @param analysis Enhanced document analysis from Gemini
 * @returns Metadata record for storage
 */
function convertEnhancedAnalysisToMetadata(analysis) {
    var _a, _b, _c, _d, _e, _f;
    // Map content type to document category
    const categoryMapping = {
        'leadership': documentCategories_1.DocumentCategoryType.PRODUCT,
        'product': documentCategories_1.DocumentCategoryType.PRODUCT,
        'pricing': documentCategories_1.DocumentCategoryType.PRICING,
        'technical': documentCategories_1.DocumentCategoryType.TECHNICAL,
        'company_info': documentCategories_1.DocumentCategoryType.GENERAL,
        'feature': documentCategories_1.DocumentCategoryType.FEATURES,
        'support': documentCategories_1.DocumentCategoryType.FAQ,
        'competitor': documentCategories_1.DocumentCategoryType.COMPETITORS,
        'partner': documentCategories_1.DocumentCategoryType.CUSTOMER,
        'market': documentCategories_1.DocumentCategoryType.MARKET,
        'training': documentCategories_1.DocumentCategoryType.TRAINING,
        'legal': documentCategories_1.DocumentCategoryType.INTERNAL_POLICY,
        'policy': documentCategories_1.DocumentCategoryType.INTERNAL_POLICY,
        'other': documentCategories_1.DocumentCategoryType.OTHER
    };
    // Extract CEO information if present
    const ceoInfo = analysis.entities.people.find(p => {
        var _a, _b, _c;
        return ((_a = p.role) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('ceo')) ||
            ((_b = p.role) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes('chief executive')) ||
            ((_c = p.role) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes('founder'));
    });
    // Extract product information
    const primaryProduct = (_a = analysis.entities.products[0]) === null || _a === void 0 ? void 0 : _a.name;
    // Build hierarchical category structure
    const hierarchicalCategories = {
        primary: categoryMapping[analysis.primaryCategory] || documentCategories_1.DocumentCategoryType.GENERAL,
        secondary: analysis.secondaryCategories
            .map(c => categoryMapping[c] || null)
            .filter(Boolean),
        industry: analysis.industryCategories || [],
        function: analysis.functionCategories || [],
        useCases: analysis.useCases || []
    };
    return {
        // Core metadata
        category: categoryMapping[analysis.contentType] || documentCategories_1.DocumentCategoryType.GENERAL,
        primaryCategory: categoryMapping[analysis.primaryCategory] || documentCategories_1.DocumentCategoryType.GENERAL,
        secondaryCategories: analysis.secondaryCategories
            .map(c => categoryMapping[c] || null)
            .filter(Boolean),
        technicalLevel: analysis.technicalLevel,
        // Enhanced metadata
        summary: analysis.summary,
        keywords: analysis.keywords.join(','),
        semanticKeywords: ((_b = analysis.semanticKeywords) === null || _b === void 0 ? void 0 : _b.join(',')) || '',
        // Hierarchical categories
        hierarchicalCategories: JSON.stringify(hierarchicalCategories),
        // Entity information
        entities: analysis.entities.people
            .map(p => p.name)
            .concat(analysis.entities.companies.map(c => c.name))
            .join(','),
        // Product information
        primaryProduct,
        products: analysis.entities.products.map(p => p.name).join(','),
        features: analysis.entities.features.map(f => f.name).join(','),
        // Special fields
        hasCeoInfo: !!ceoInfo,
        ceoName: (ceoInfo === null || ceoInfo === void 0 ? void 0 : ceoInfo.name) || null,
        // Topics and subtopics
        topics: analysis.topics.join(','),
        subtopics: ((_c = analysis.subtopics) === null || _c === void 0 ? void 0 : _c.join(',')) || '',
        // Document quality metrics
        complexityScore: analysis.complexityScore,
        authorityScore: analysis.authorityScore,
        confidenceScore: analysis.confidenceScore,
        // Recency indicators
        hasTimestamps: ((_d = analysis.recencyIndicators) === null || _d === void 0 ? void 0 : _d.hasTimestamps) || false,
        mostRecentDate: ((_e = analysis.recencyIndicators) === null || _e === void 0 ? void 0 : _e.mostRecentDate) || null,
        likelyOutdated: ((_f = analysis.recencyIndicators) === null || _f === void 0 ? void 0 : _f.likelyOutdated) || false,
        // Timestamps
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
    };
}

/**
 * Gemini Document Processing Utility
 *
 * This module handles interaction with Google's Gemini API for document analysis,
 * metadata extraction, categorization, and conflict detection.
 */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { logError, logInfo } from './logger';
import { getStandardCategories } from './documentCategories';
import { STANDARD_CATEGORIES } from './tagUtils';
// Initialize Gemini API client
const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = 'gemini-pro';
/**
 * Generate system prompt for document analysis
 */
function generateDocumentAnalysisPrompt(text) {
    // Get the category values from STANDARD_CATEGORIES to use in the prompt
    const categoryValues = STANDARD_CATEGORIES.map(cat => cat.value).join(', ');
    return `
You are an AI assistant specializing in document analysis and categorization for a knowledge base system.

Analyze the following document and extract structured information. The document may contain information about a company, products, pricing, leadership, features, etc.

DOCUMENT:
${text}

Provide a detailed analysis in the following JSON format:
{
  "summary": "A concise summary of the document (max 150 words)",
  "contentType": "One of: [leadership, product, pricing, technical, company_info, feature, support, competitors, other]",
  "primaryCategory": "The main category of this document. Must be one of the following standardized values: ${categoryValues}",
  "secondaryCategories": ["Other relevant categories from the same standardized list: ${categoryValues} (0-3 categories recommended)"],
  "technicalLevel": "A number from 1 to 10 indicating technical complexity (1=very basic, 10=highly technical/expert)",
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
  "keywords": ["Important keywords from the document (5-10 recommended)"],
  "topics": ["Main topics covered (3-5 recommended)"],
  "confidenceScore": "A number from 0-1 indicating your confidence in this analysis"
}

Be as accurate and comprehensive as possible. If information is not present, use empty arrays or null values rather than inventing information.

IMPORTANT: For the primaryCategory and secondaryCategories fields, you MUST use ONLY values from this standardized list: ${categoryValues}. Do not invent new categories.
`;
}
/**
 * Generate system prompt for enhanced document analysis with more detailed categorization
 */
function generateEnhancedAnalysisPrompt(text) {
    // Get the category values from STANDARD_CATEGORIES to use in the prompt
    const categoryValues = STANDARD_CATEGORIES.map(cat => cat.value).join(', ');
    return `
You are an AI assistant specializing in document analysis and detailed categorization for an advanced knowledge base system.

Analyze the following document and extract comprehensive structured information with detailed categories, entities, and metadata. The document may contain information about companies, products, technologies, services, etc.

DOCUMENT:
${text}

Provide a detailed analysis in the following JSON format:
{
  "summary": "A concise summary of the document (max 150 words)",
  "contentType": "One of: [leadership, product, pricing, technical, company_info, feature, support, competitor, partner, market, training, legal, policy, other]",
  
  "primaryCategory": "The main category of this document. Must be one of the following standardized values: ${categoryValues}",
  "secondaryCategories": ["Other relevant categories from the same standardized list: ${categoryValues} (0-3 categories recommended)"],
  "industryCategories": ["Relevant industry sectors like healthcare, finance, retail, etc."],
  "functionCategories": ["Relevant business functions like marketing, sales, support, development"],
  "useCases": ["Specific use cases the document addresses"],
  
  "technicalLevel": "A number from 1 to 10 indicating technical complexity (1=very basic, 10=highly technical/expert)",
  "complexityScore": "A number from 0-5 rating the complexity of content (0=simple, 5=very complex)",
  
  "topics": ["Main topics covered in the document (3-5 recommended)"],
  "subtopics": ["More specific subtopics covered (3-5 recommended)"],
  
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
export async function processDocumentWithGemini(text) {
    try {
        logInfo('Processing document with Gemini', {
            textLength: text.length,
            textPreview: text.substring(0, 100) + '...'
        });
        // Create model instance with safety settings
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
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
        logInfo('Document processed successfully with Gemini', {
            contentType: analysis.contentType,
            primaryCategory: analysis.primaryCategory,
            confidenceScore: analysis.confidenceScore
        });
        return analysis;
    }
    catch (error) {
        logError('Error processing document with Gemini', error);
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
export async function processDocumentWithEnhancedLabels(text) {
    try {
        logInfo('Processing document with enhanced labeling', {
            textLength: text.length,
            textPreview: text.substring(0, 100) + '...'
        });
        // Create model instance with safety settings
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
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
        logInfo('Document processed successfully with enhanced labeling', {
            contentType: analysis.contentType,
            primaryCategory: analysis.primaryCategory,
            industryCategories: analysis.industryCategories?.length || 0,
            functionCategories: analysis.functionCategories?.length || 0,
            confidenceScore: analysis.confidenceScore
        });
        return analysis;
    }
    catch (error) {
        logError('Error processing document with enhanced labeling', error);
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
export async function analyzeQueryWithGemini(query) {
    try {
        logInfo('Analyzing query with Gemini', { query });
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
        logInfo('Query analyzed successfully with Gemini', {
            intent: analysis.intent,
            entityCount: analysis.entities.length,
            confidence: analysis.confidence
        });
        return analysis;
    }
    catch (error) {
        logError('Error analyzing query with Gemini', error);
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
export async function detectConflictWithGemini(doc1, doc2) {
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
        logInfo('Conflict detection completed with Gemini', {
            hasConflict: analysis.hasConflict,
            conflictType: analysis.conflictType,
            confidence: analysis.confidence,
            preferredDocument: analysis.preferredDocument
        });
        return analysis;
    }
    catch (error) {
        logError('Error detecting conflicts with Gemini', error);
        // Return fallback result
        return {
            hasConflict: false,
            confidence: 0
        };
    }
}
/**
 * Find matching standardized category based on input from Gemini analysis
 * This function ensures we always use standardized values across the application
 * @param category Category name from Gemini
 * @returns Standardized category value
 */
export function findStandardizedCategory(category) {
    if (!category || typeof category !== 'string') {
        return 'GENERAL';
    }
    const standardCategories = getStandardCategories(); // Use the function to get current enum values
    const formattedCategory = category.toUpperCase().trim().replace(/\s+/g, '_');
    // Check if the formatted category is a valid value in the enum
    if (standardCategories.includes(formattedCategory)) {
        return formattedCategory;
    }
    // If not a direct match, check labels from STANDARD_CATEGORIES in tagUtils.ts
    const matchingStandardCategory = STANDARD_CATEGORIES.find(sc => sc.label.toLowerCase() === category.toLowerCase() ||
        sc.value === formattedCategory);
    if (matchingStandardCategory) {
        return matchingStandardCategory.value; // Return the VALUE (enum key)
    }
    // Log a warning if no match is found after checking labels
    logError(`Could not map category "${category}" (formatted: ${formattedCategory}) to a standard category value. Defaulting to GENERAL.`);
    // Default to GENERAL if no match found
    return 'GENERAL';
}
/**
 * Convert Gemini analysis to document metadata
 * @param analysis Gemini document analysis
 * @returns Metadata suitable for storage in vector database
 */
export function convertAnalysisToMetadata(analysis) {
    // Extract CEO information if present
    const ceoInfo = analysis.entities.people.find(p => p.role?.toLowerCase().includes('ceo') ||
        p.role?.toLowerCase().includes('chief executive') ||
        p.role?.toLowerCase().includes('founder'));
    return {
        // Core metadata
        category: findStandardizedCategory(analysis.contentType),
        primaryCategory: findStandardizedCategory(analysis.primaryCategory),
        secondaryCategories: analysis.secondaryCategories
            .filter(category => category && category.trim() !== '') // Filter out empty categories
            .map(category => findStandardizedCategory(category))
            .filter((value, index, self) => self.indexOf(value) === index), // Remove duplicates
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
        ceoName: ceoInfo?.name || null,
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
export function convertEnhancedAnalysisToMetadata(analysis) {
    // Extract CEO information if present
    const ceoInfo = analysis.entities.people.find(p => p.role?.toLowerCase().includes('ceo') ||
        p.role?.toLowerCase().includes('chief executive') ||
        p.role?.toLowerCase().includes('founder'));
    // Extract product information
    const primaryProduct = analysis.entities.products[0]?.name;
    // Build hierarchical category structure
    const hierarchicalCategories = {
        primary: findStandardizedCategory(analysis.primaryCategory),
        secondary: analysis.secondaryCategories
            .filter(category => category && category.trim() !== '') // Filter out empty categories
            .map(category => findStandardizedCategory(category))
            .filter((value, index, self) => self.indexOf(value) === index), // Remove duplicates
        industry: analysis.industryCategories || [],
        function: analysis.functionCategories || [],
        useCases: analysis.useCases || []
    };
    return {
        // Core metadata
        category: findStandardizedCategory(analysis.contentType),
        primaryCategory: findStandardizedCategory(analysis.primaryCategory),
        secondaryCategories: analysis.secondaryCategories
            .filter(category => category && category.trim() !== '') // Filter out empty categories
            .map(category => findStandardizedCategory(category))
            .filter((value, index, self) => self.indexOf(value) === index), // Remove duplicates
        technicalLevel: analysis.technicalLevel,
        // Enhanced metadata
        summary: analysis.summary,
        keywords: analysis.keywords.join(','),
        semanticKeywords: analysis.semanticKeywords?.join(',') || '',
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
        ceoName: ceoInfo?.name || null,
        // Topics and subtopics
        topics: analysis.topics.join(','),
        subtopics: analysis.subtopics?.join(',') || '',
        // Document quality metrics
        complexityScore: analysis.complexityScore,
        authorityScore: analysis.authorityScore,
        confidenceScore: analysis.confidenceScore,
        // Recency indicators
        hasTimestamps: analysis.recencyIndicators?.hasTimestamps || false,
        mostRecentDate: analysis.recencyIndicators?.mostRecentDate || null,
        likelyOutdated: analysis.recencyIndicators?.likelyOutdated || false,
        // Timestamps
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
    };
}

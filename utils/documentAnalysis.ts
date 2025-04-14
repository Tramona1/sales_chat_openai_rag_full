/**
 * Document Analysis Module
 * 
 * This module provides a unified approach to document analysis, combining the functionality
 * of metadataExtractor.ts and geminiClient.ts (extractDocumentContext) into a single,
 * efficient function that makes only one LLM call.
 */

import { 
  generateStructuredGeminiResponse, 
  generateGeminiChatCompletion 
} from './geminiClient';
import { 
  generateStructuredResponse 
} from './openaiClient';
import { 
  DocumentCategoryType, 
  QualityControlFlag, 
  ConfidenceLevel,
  EntityType,
  getCategoryAttributes,
  detectCategoryFromText 
} from './documentCategories';
import { logError, logInfo, logWarning } from './logger';
import { getFromCache, cacheWithExpiry } from './caching';
import { safeExecute } from './errorHandling';
import { createDefaultMetadata, EnhancedMetadata } from '../types/metadata';
import { AI_SETTINGS } from './modelConfig';
import { DocumentContext } from '../types/documentProcessing';

// Constants
const ANALYSIS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RETRIES = 2;
const DEFAULT_MODEL = 'gpt-4-turbo';
const FALLBACK_MODEL = 'gpt-3.5-turbo';
const GEMINI_MODEL = 'gemini-2.0-flash';

// Cache key prefix
const ANALYSIS_CACHE_KEY_PREFIX = 'document_analysis_';

// Primary model for document analysis
const PRIMARY_MODEL = 'gemini';

/**
 * Unified response structure combining all needed metadata and context
 */
interface DocumentAnalysisResponse {
  // Metadata categories
  categories: {
    primary: string;
    secondary: string[];
  };
  // Summary and topics
  summary: string;
  keyTopics: string[];
  mainTopics: string[];
  // Technical information
  technicalLevel: number;
  documentType: string;
  // Content metadata
  keywords: string[];
  entities: {
    name: string;
    type: string;
    confidence: string;
  }[];
  // Quality indicators
  qualityIssues: string[];
  containsContradictions: boolean;
  needsClarification: boolean;
  unreliableSource: boolean;
  // Audience information
  audienceType: string[];
}

/**
 * Return type combining the EnhancedMetadata with document context
 */
export interface DocumentAnalysisResult extends EnhancedMetadata {
  documentContext: DocumentContext;
}

/**
 * Unified document analysis function that replaces both extractMetadata and extractDocumentContext
 * with a single, efficient LLM call
 * 
 * @param text The document text to analyze
 * @param source The source identifier for the document
 * @param options Optional settings for the analysis
 * @returns Combined metadata and document context
 */
export async function analyzeDocument(
  text: string, 
  source: string,
  options: {
    useCaching?: boolean;
    model?: string;
  } = {}
): Promise<DocumentAnalysisResult> {
  const useCaching = options.useCaching !== false;
  const model = options.model || PRIMARY_MODEL;
  
  try {
    // Check cache first if caching is enabled
    if (useCaching) {
      const cacheKey = `${ANALYSIS_CACHE_KEY_PREFIX}${source}`;
      const cachedAnalysis = getFromCache<DocumentAnalysisResult>(cacheKey);
      
      if (cachedAnalysis) {
        logInfo(`Using cached document analysis for ${source}`);
        return cachedAnalysis;
      }
    }
    
    // Prepare text sample (truncate if too long)
    const textSample = text.length > 10000 
      ? `${text.substring(0, 10000)}... (truncated, full length: ${text.length} chars)`
      : text;
      
    // Try to analyze document with the primary model
    logInfo(`Analyzing document for ${source} with ${model}...`);
    const startTime = Date.now();
    
    let analysisResult;
    if (model === 'gemini' || model === GEMINI_MODEL) {
      logInfo('Using Gemini model for document analysis...');
      analysisResult = await analyzeDocumentWithLLM(textSample, 'gemini');
    } else {
      // Fallback to OpenAI
      analysisResult = await analyzeDocumentWithLLM(textSample, model);
    }
    
    const processingTime = Date.now() - startTime;
    logInfo(`Document analysis completed in ${processingTime}ms`);
    
    // Create a default enhanced metadata object
    const baseMetadata = createDefaultMetadata(source);
    
    // Convert to enhanced metadata
    const result: DocumentAnalysisResult = {
      ...baseMetadata,
      source,
      primaryCategory: mapToDocumentCategory(analysisResult.categories.primary) || DocumentCategoryType.GENERAL,
      secondaryCategories: analysisResult.categories.secondary
        .filter(category => category && category.trim() !== '') // Filter out empty categories
        .map(mapToDocumentCategory)
        .filter(Boolean) as DocumentCategoryType[],
      confidenceScore: calculateConfidenceScore(analysisResult, text),
      summary: analysisResult.summary,
      keyTopics: analysisResult.keyTopics || [],
      technicalLevel: analysisResult.technicalLevel || 1,
      keywords: analysisResult.keywords || [],
      entities: Array.isArray(analysisResult.entities) 
        ? analysisResult.entities.map((entity: { 
            name: string; 
            type: string; 
            confidence: string;
          }) => ({
            name: entity.name,
            type: mapToEntityType(entity.type),
            confidence: mapToConfidenceLevel(entity.confidence),
            mentions: 1,
          }))
        : [],
      qualityFlags: determineQualityFlags(analysisResult),
      approved: false,
      routingPriority: 3,
      // Document context portion
      documentContext: {
        summary: analysisResult.summary,
        mainTopics: analysisResult.mainTopics || analysisResult.keyTopics || [],
        entities: Array.isArray(analysisResult.entities) 
          ? analysisResult.entities.map(e => e.name)
          : [],
        documentType: analysisResult.documentType || 'general',
        technicalLevel: analysisResult.technicalLevel || 1,
        audienceType: analysisResult.audienceType || []
      } as DocumentContext
    };
    
    // Update routing priority based on category
    updateRoutingPriority(result);
    
    // Cache result if caching is enabled
    if (useCaching) {
      const cacheKey = `${ANALYSIS_CACHE_KEY_PREFIX}${source}`;
      cacheWithExpiry(cacheKey, result, ANALYSIS_CACHE_TTL);
    }
    
    return result;
  } catch (error) {
    logError('Document analysis failed', { source, error });
    
    // Fallback to simple metadata with rules-based categorization
    const fallbackResult = createDefaultMetadata(source);
    fallbackResult.primaryCategory = detectCategoryFromText(text)[0];
    fallbackResult.qualityFlags.push(QualityControlFlag.NEEDS_CLARIFICATION);
    
    // Add minimal document context
    (fallbackResult as DocumentAnalysisResult).documentContext = {
      summary: text.substring(0, 200) + "...",
      mainTopics: extractBasicTopics(text),
      entities: extractBasicEntities(text),
      documentType: 'general',
      technicalLevel: 3,
      audienceType: ['general']
    } as DocumentContext;
    
    return fallbackResult as DocumentAnalysisResult;
  }
}

/**
 * Use LLM to analyze document content in a single call
 */
async function analyzeDocumentWithLLM(
  text: string,
  model: string
): Promise<DocumentAnalysisResponse> {
  // Define the comprehensive schema for structured extraction
  const analysisSchema = {
    type: 'object',
    properties: {
      categories: {
        type: 'object',
        properties: {
          primary: {
            type: 'string',
            description: `The primary category of the document. Choose from: ${Object.values(DocumentCategoryType).join(', ')}`
          },
          secondary: {
            type: 'array',
            items: { 
              type: 'string',
              description: `A relevant secondary category. Choose from: ${Object.values(DocumentCategoryType).join(', ')}`
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
            type: { type: 'string', description: `The type of entity. Choose from: ${Object.values(EntityType).join(', ')}` },
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
  
  const systemPrompt = `
You are a document analysis expert. Analyze the provided document text for a Retrieval Augmented Generation (RAG) system. Extract structured information based precisely on the provided JSON schema.

Your task is to extract:
1.  Primary and Secondary Categories: Select the MOST appropriate primary category and up to 3 relevant secondary categories from the provided enum list in the schema description.
2.  Summary: A concise 1-2 sentence summary.
3.  Key Topics / Main Topics: 3-5 key concepts or topics.
4.  Technical Level: Rate the technical complexity from 1 (very basic) to 10 (highly technical/expert) based on the schema definition.
5.  Document Type: Identify the type of document (e.g., user guide, API doc, blog post).
6.  Keywords: Extract 5-10 important keywords or short phrases.
7.  Entities: Identify named entities (people, orgs, products, features, etc.), their type (choose from the enum list in the schema), and your confidence (HIGH, MEDIUM, LOW).
8.  Quality Issues: List specific quality problems, if any.
9.  Quality Flags: Indicate boolean flags for contradictions, need for clarification, or unreliability.
10. Audience Type: Suggest likely target audiences.

Provide the analysis ONLY as a single, valid JSON object conforming strictly to the schema.
`;

  const userPrompt = `
Analyze the following document:

---
${text}
---

Return a single JSON object with all the requested fields. Be thorough but precise.
`;

  try {
    let response;
    
    if (model === 'gemini') {
      // Use Gemini for structured response
      response = await generateStructuredGeminiResponse(
        systemPrompt,
        userPrompt,
        analysisSchema
      );
    } else {
      // Use OpenAI for structured response
      response = await generateStructuredResponse(
        systemPrompt,
        userPrompt,
        analysisSchema,
        model
      );
    }
    
    // Ensure all required fields exist
    const result: DocumentAnalysisResponse = {
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
    
    return result;
  } catch (error) {
    // If structured generation fails, try again with a fallback model
    if (model !== FALLBACK_MODEL) {
      logWarning(`Structured analysis failed with ${model}, trying fallback model...`);
      return analyzeDocumentWithLLM(text, FALLBACK_MODEL);
    }
    
    // If all fails, throw the error
    logError('Document analysis failed with all models', error);
    throw error;
  }
}

/**
 * Map a category string to a DocumentCategoryType enum value.
 * Performs basic normalization and checks if the value exists in the enum.
 */
function mapToDocumentCategory(category: string): DocumentCategoryType | null {
  if (!category) return null;
  
  const formattedCategory = category.toUpperCase().trim().replace(/\s+/g, '_');
  
  // Check if the formatted category is a valid value in the enum
  if (Object.values(DocumentCategoryType).includes(formattedCategory as DocumentCategoryType)) {
    return formattedCategory as DocumentCategoryType;
  }
  
  // Log a warning if a category suggested by the LLM doesn't match our enum
  logWarning(`LLM suggested category "${category}" (formatted as "${formattedCategory}") does not match any standard DocumentCategoryType. Defaulting to GENERAL or discarding.`);
  
  // Optionally, add more sophisticated mapping here if needed, otherwise return null or default
  // For now, we'll return null and let the calling function handle the default
  return null; 
}

/**
 * Map an entity type string to the EntityType enum
 */
function mapToEntityType(entityType: string): EntityType {
  if (!entityType) return EntityType.OTHER;
  
  const normalizedType = entityType.toUpperCase().trim();
  
  // Use the correct EntityType enum values from documentCategories.ts
  const entityTypeMap: Record<string, EntityType> = {
    'PERSON': EntityType.PERSON,
    'PEOPLE': EntityType.PERSON,
    'INDIVIDUAL': EntityType.PERSON,
    'COMPANY': EntityType.ORGANIZATION,
    'ORGANIZATION': EntityType.ORGANIZATION,
    'BUSINESS': EntityType.ORGANIZATION,
    'ENTERPRISE': EntityType.ORGANIZATION,
    'PRODUCT': EntityType.PRODUCT,
    'SERVICE': EntityType.PRODUCT,
    'SOLUTION': EntityType.PRODUCT,
    'TOOL': EntityType.PRODUCT,
    'FEATURE': EntityType.FEATURE,
    'CAPABILITY': EntityType.FEATURE,
    'FUNCTION': EntityType.FEATURE,
    'LOCATION': EntityType.LOCATION,
    'PLACE': EntityType.LOCATION,
    'GEOGRAPHY': EntityType.LOCATION,
    'EVENT': EntityType.DATE, // Map EVENT to DATE as a fallback
    'OCCURRENCE': EntityType.DATE, // Map OCCURRENCE to DATE as a fallback
    'DATE': EntityType.DATE,
    'TIME': EntityType.DATE,
    'CONCEPT': EntityType.OTHER, // Map CONCEPT to OTHER as a fallback
    'IDEA': EntityType.OTHER, // Map IDEA to OTHER as a fallback
    'THEORY': EntityType.OTHER // Map THEORY to OTHER as a fallback
  };
  
  for (const [key, value] of Object.entries(entityTypeMap)) {
    if (normalizedType.includes(key)) {
      return value;
    }
  }
  
  return EntityType.OTHER;
}

/**
 * Map a confidence string to the ConfidenceLevel enum
 */
function mapToConfidenceLevel(confidence: string): ConfidenceLevel {
  if (!confidence) return ConfidenceLevel.MEDIUM;
  
  const normalizedConfidence = confidence.toUpperCase().trim();
  
  if (normalizedConfidence.includes('HIGH') || normalizedConfidence.includes('CERTAIN')) {
    return ConfidenceLevel.HIGH;
  } else if (normalizedConfidence.includes('LOW') || normalizedConfidence.includes('UNCERTAIN')) {
    return ConfidenceLevel.LOW;
  }
  
  return ConfidenceLevel.MEDIUM;
}

/**
 * Determine quality flags based on LLM analysis
 */
function determineQualityFlags(analysis: DocumentAnalysisResponse): QualityControlFlag[] {
  const flags: QualityControlFlag[] = [];
  
  if (analysis.needsClarification) {
    flags.push(QualityControlFlag.NEEDS_CLARIFICATION);
  }
  
  if (analysis.containsContradictions) {
    flags.push(QualityControlFlag.CONTAINS_CONTRADICTIONS);
  }
  
  if (analysis.unreliableSource) {
    flags.push(QualityControlFlag.UNRELIABLE_SOURCE);
  }
  
  if (analysis.qualityIssues && analysis.qualityIssues.length > 0) {
    const issues = analysis.qualityIssues.map(issue => issue.toLowerCase());
    
    if (issues.some(issue => issue.includes('outdated') || issue.includes('old'))) {
      flags.push(QualityControlFlag.OUTDATED_CONTENT);
    }
    
    if (issues.some(issue => issue.includes('incomplete') || issue.includes('missing'))) {
      flags.push(QualityControlFlag.INCOMPLETE_CONTENT);
    }
    
    if (issues.some(issue => issue.includes('formatting') || issue.includes('structure'))) {
      flags.push(QualityControlFlag.FORMATTING_ISSUES);
    }
  }
  
  return flags;
}

/**
 * Calculate confidence score based on metadata completeness
 */
function calculateConfidenceScore(analysis: DocumentAnalysisResponse, text: string): number {
  let score = 0.5; // Start with neutral score
  
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
function updateRoutingPriority(metadata: DocumentAnalysisResult): void {
  if (!metadata.primaryCategory) return;
  
  const categoryAttributes = getCategoryAttributes(metadata.primaryCategory);
  if (categoryAttributes && categoryAttributes.routingPriority !== undefined) {
    metadata.routingPriority = categoryAttributes.routingPriority;
  }
}

/**
 * Extract basic topics from text (fallback method)
 */
function extractBasicTopics(text: string): string[] {
  // Very basic keyword extraction - in real fallback, more sophisticated NLP would be used
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 4);
  
  const wordCounts: Record<string, number> = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Extract basic entities from text (fallback method)
 */
function extractBasicEntities(text: string): string[] {
  // Very basic entity extraction - just look for capitalized words
  const capitalizedWords = text.match(/\b[A-Z][a-zA-Z]+\b/g) || [];
  const uniqueEntities = [...new Set(capitalizedWords)];
  return uniqueEntities.slice(0, 10);
}

/**
 * Batch process multiple documents
 */
export async function batchAnalyzeDocuments(
  documents: Array<{ text: string; source: string }>,
  options: {
    useCaching?: boolean;
    model?: string;
    concurrency?: number;
  } = {}
): Promise<DocumentAnalysisResult[]> {
  const concurrency = options.concurrency || 3;
  const results: DocumentAnalysisResult[] = [];
  
  // Process in batches based on concurrency
  for (let i = 0; i < documents.length; i += concurrency) {
    const batch = documents.slice(i, i + concurrency);
    const batchPromises = batch.map(doc => 
      analyzeDocument(doc.text, doc.source, options)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
} 
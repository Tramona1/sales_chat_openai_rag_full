/**
 * Metadata Extraction Module
 * 
 * This module provides functions to extract structured metadata from documents
 * using LLMs (OpenAI/Gemini).
 */

import { openai, generateStructuredResponse } from './openaiClient';
import { logError, safeExecute } from './errorHandling';
import { getFromCache, cacheWithExpiry } from './caching';
import { 
  DocumentCategoryType, 
  QualityControlFlag, 
  ConfidenceLevel as ImportedConfidenceLevel,
  EntityType as ImportedEntityType,
  getCategoryAttributes,
  detectCategoryFromText 
} from './documentCategories';
import { generateGeminiChatCompletion, generateStructuredGeminiResponse } from './geminiClient';
import { createDefaultMetadata, EnhancedMetadata } from '../types/metadata';
import { AI_SETTINGS } from './modelConfig';

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

// Interface for the LLM extraction response
interface ExtractedMetadataResponse {
  categories: {
    primary: string;
    secondary: string[];
  };
  summary: string;
  keyTopics: string[];
  technicalLevel: number;
  keywords: string[];
  entities: {
    name: string;
    type: string;
    confidence: string;
  }[];
  qualityIssues: string[];
  containsContradictions: boolean;
  needsClarification: boolean;
  unreliableSource: boolean;
}

/**
 * Extract metadata from document text
 */
export async function extractMetadata(
  text: string, 
  source: string,
  options: {
    useCaching?: boolean;
    model?: string; 
  } = {}
): Promise<EnhancedMetadata> {
  const useCaching = options.useCaching !== false;
  const model = options.model || DEFAULT_MODEL;
  
  try {
    // Check cache first if caching is enabled
    if (useCaching) {
      const cacheKey = `${METADATA_CACHE_KEY_PREFIX}${source}`;
      const cachedMetadata = getFromCache<EnhancedMetadata>(cacheKey);
      
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
    } else {
      // Fallback to OpenAI
      llmMetadata = await extractMetadataWithLLM(textSample, model);
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`Metadata extraction completed in ${processingTime}ms`);
    
    // Convert to enhanced metadata
    const metadata: EnhancedMetadata = {
      source,
      primaryCategory: mapToDocumentCategory(llmMetadata.categories.primary) || DocumentCategoryType.GENERAL,
      secondaryCategories: llmMetadata.categories.secondary
        .map(mapToDocumentCategory)
        .filter(Boolean) as DocumentCategoryType[],
      confidenceScore: calculateConfidenceScore(llmMetadata, text),
      summary: llmMetadata.summary,
      keyTopics: llmMetadata.keyTopics || [],
      technicalLevel: llmMetadata.technicalLevel || 1,
      keywords: llmMetadata.keywords || [],
      entities: Array.isArray(llmMetadata.entities) 
        ? llmMetadata.entities.map((entity: { 
            name: string; 
            type: string; 
            confidence: string;
          }) => ({
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
      cacheWithExpiry(cacheKey, metadata, METADATA_CACHE_TTL);
    }
    
    return metadata;
  } catch (error) {
    logError('Metadata extraction failed', { source, error });
    
    // Fallback to simple metadata with rules-based categorization
    const fallbackMetadata = createDefaultMetadata(source);
    fallbackMetadata.primaryCategory = detectCategoryFromText(text)[0];
    fallbackMetadata.qualityFlags.push(QualityControlFlag.NEEDS_CLARIFICATION);
    
    return fallbackMetadata;
  }
}

/**
 * Use LLM to extract detailed metadata from text
 */
async function extractMetadataWithLLM(
  text: string,
  model: string
): Promise<ExtractedMetadataResponse> {
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
          return await generateStructuredGeminiResponse(systemPrompt, text, extractionSchema);
        } catch (error) {
          console.log('Gemini extraction failed, falling back to OpenAI:', error);
          // Fall back to OpenAI if Gemini fails
          return await generateStructuredResponse(systemPrompt, text, extractionSchema, DEFAULT_MODEL);
        }
      } else {
        // Use OpenAI
        return await generateStructuredResponse(systemPrompt, text, extractionSchema, model);
      }
    } catch (error: any) {
      // Check if it's a rate limit error (status code 429)
      const isRateLimit = error?.status === 429 || 
                          error?.code === 'rate_limit_exceeded' ||
                          (error?.message && error?.message.includes('Rate limit')) ||
                          (error?.errorDetails && error?.errorDetails.some((detail: any) => 
                            detail['@type']?.includes('QuotaFailure')));
      
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
        } else if (model.includes('gpt-4')) {
          console.log('Switching to fallback model for next attempt...');
          model = FALLBACK_MODEL;
        }
        
        continue;
      }
      
      // If it's not a rate limit error or we've run out of retries, log and throw
      logError('Error in extractMetadataWithLLM', error);
      throw error;
    }
  }
  
  // This should not be reached because the last attempt will either return or throw
  throw new Error('Failed to extract metadata after multiple attempts');
}

/**
 * Map a string category to DocumentCategoryType enum
 */
function mapToDocumentCategory(category: string): DocumentCategoryType | null {
  const normalizedCategory = category.toLowerCase().trim().replace(/\s+/g, '_');
  
  // Map to our enum values
  const categoryMap: Record<string, DocumentCategoryType> = {
    'product': DocumentCategoryType.PRODUCT,
    'pricing': DocumentCategoryType.PRICING,
    'price': DocumentCategoryType.PRICING,
    'features': DocumentCategoryType.FEATURES,
    'feature': DocumentCategoryType.FEATURES,
    'technical': DocumentCategoryType.TECHNICAL,
    'customer': DocumentCategoryType.CUSTOMER,
    'case_study': DocumentCategoryType.CASE_STUDY,
    'success_story': DocumentCategoryType.CASE_STUDY,
    'testimonial': DocumentCategoryType.TESTIMONIAL,
    'sales_process': DocumentCategoryType.SALES_PROCESS,
    'competitors': DocumentCategoryType.COMPETITORS,
    'competitor': DocumentCategoryType.COMPETITORS,
    'market': DocumentCategoryType.MARKET,
    'internal_policy': DocumentCategoryType.INTERNAL_POLICY,
    'policy': DocumentCategoryType.INTERNAL_POLICY,
    'training': DocumentCategoryType.TRAINING,
    'faq': DocumentCategoryType.FAQ,
    'general': DocumentCategoryType.GENERAL,
    'other': DocumentCategoryType.OTHER
  };
  
  return categoryMap[normalizedCategory] || null;
}

/**
 * Map a string entity type to EntityType enum
 */
function mapToEntityType(entityType: string): ImportedEntityType {
  const normalizedType = entityType.toLowerCase().trim();
  
  const typeMap: Record<string, ImportedEntityType> = {
    'person': ImportedEntityType.PERSON,
    'organization': ImportedEntityType.ORGANIZATION,
    'company': ImportedEntityType.ORGANIZATION,
    'product': ImportedEntityType.PRODUCT,
    'feature': ImportedEntityType.FEATURE,
    'price': ImportedEntityType.PRICE,
    'cost': ImportedEntityType.PRICE,
    'date': ImportedEntityType.DATE,
    'location': ImportedEntityType.LOCATION,
    'place': ImportedEntityType.LOCATION
  };
  
  return typeMap[normalizedType] || ImportedEntityType.ORGANIZATION;
}

/**
 * Map a string confidence level to ConfidenceLevel enum
 */
function mapToConfidenceLevel(confidence: string): ImportedConfidenceLevel {
  const normalizedConfidence = confidence.toLowerCase().trim();
  
  switch (normalizedConfidence) {
    case 'high':
      return ImportedConfidenceLevel.HIGH;
    case 'medium':
      return ImportedConfidenceLevel.MEDIUM;
    case 'low':
      return ImportedConfidenceLevel.LOW;
    case 'uncertain':
    default:
      return ImportedConfidenceLevel.UNCERTAIN;
  }
}

/**
 * Determine quality control flags based on LLM analysis
 */
function determineQualityFlags(llmMetadata: ExtractedMetadataResponse): QualityControlFlag[] {
  const flags: QualityControlFlag[] = [QualityControlFlag.PENDING_REVIEW];
  
  if (llmMetadata?.containsContradictions) {
    flags.push(QualityControlFlag.CONTAINS_CONTRADICTIONS);
  }
  
  if (llmMetadata?.needsClarification) {
    flags.push(QualityControlFlag.NEEDS_CLARIFICATION);
  }
  
  if (llmMetadata?.unreliableSource) {
    flags.push(QualityControlFlag.UNRELIABLE_SOURCE);
  }
  
  if (llmMetadata?.qualityIssues && Array.isArray(llmMetadata.qualityIssues) && 
      llmMetadata.qualityIssues.some(issue => issue.toLowerCase().includes('outdated'))) {
    flags.push(QualityControlFlag.OUTDATED);
  }
  
  return flags;
}

/**
 * Calculate confidence score based on metadata and text
 */
function calculateConfidenceScore(metadata: ExtractedMetadataResponse, text: string): number {
  let score = 0.5; // Start with a baseline score
  
  // Safely handle potentially undefined properties
  const keywords = Array.isArray(metadata?.keywords) ? metadata.keywords : [];
  const entities = Array.isArray(metadata?.entities) ? metadata.entities : [];
  const qualityIssues = Array.isArray(metadata?.qualityIssues) ? metadata.qualityIssues : [];
  
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
  if (metadata?.containsContradictions) {
    score -= 0.2;
  }
  
  // Reduce score if it needs clarification
  if (metadata?.needsClarification) {
    score -= 0.1;
  }
  
  // Cap the score between 0 and 1
  return Math.min(Math.max(score, 0), 1);
}

/**
 * Update routing priority based on primary category
 */
function updateRoutingPriority(metadata: EnhancedMetadata): void {
  // Get the category attributes from documentCategories module
  const categoryAttributes = getCategoryAttributes(metadata.primaryCategory);
  
  // Update routing priority based on category attributes
  if (categoryAttributes && categoryAttributes.routingPriority) {
    metadata.routingPriority = categoryAttributes.routingPriority;
  }
}

/**
 * Batch process multiple documents for metadata extraction
 */
export async function batchExtractMetadata(
  documents: Array<{ text: string; source: string }>,
  options: {
    useCaching?: boolean;
    model?: string;
    concurrency?: number;
  } = {}
): Promise<EnhancedMetadata[]> {
  const { concurrency = 3 } = options;
  
  console.log(`Batch processing ${documents.length} documents for metadata extraction with concurrency ${concurrency}`);
  
  // Process in batches to control concurrency
  const results: EnhancedMetadata[] = [];
  for (let i = 0; i < documents.length; i += concurrency) {
    const batch = documents.slice(i, i + concurrency);
    
    // Process each document in the batch concurrently
    const batchPromises = batch.map(doc => 
      extractMetadata(doc.text, doc.source, options)
    );
    
    // Wait for the current batch to complete
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    console.log(`Completed batch ${i / concurrency + 1}/${Math.ceil(documents.length / concurrency)} (${batchResults.length} documents)`);
  }
  
  return results;
}
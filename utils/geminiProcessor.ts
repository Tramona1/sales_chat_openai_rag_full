/**
 * Gemini Document Processing Utility
 * 
 * This module handles interaction with Google's Gemini API for document analysis,
 * metadata extraction, categorization, and conflict detection.
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { generateStructuredGeminiResponse } from './geminiClient';
import { logError, logInfo } from './logger';
import { DocumentCategoryType, getStandardCategories } from './documentCategories';
import { STANDARD_CATEGORIES } from './tagUtils';

// Initialize Gemini API client
const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = 'gemini-pro';

/**
 * Document analysis result from Gemini
 */
export interface GeminiDocumentAnalysis {
  summary: string;
  contentType: string;
  primaryCategory: string;
  secondaryCategories: string[];
  technicalLevel: number; // 0-3
  entities: {
    people: Array<{
      name: string;
      role?: string;
      importance: 'high' | 'medium' | 'low';
    }>;
    companies: Array<{
      name: string;
      relationship?: string;
    }>;
    products: string[];
    features: string[];
  };
  keywords: string[];
  topics: string[];
  confidenceScore: number;
}

/**
 * Enhanced document analysis with more detailed categorization and metadata
 */
export interface EnhancedGeminiDocumentAnalysis {
  summary: string;
  contentType: string;
  
  // Enhanced categorization
  primaryCategory: string;
  secondaryCategories: string[];
  industryCategories: string[];
  functionCategories: string[]; // e.g., "marketing", "sales", "technical support"
  useCases: string[];
  
  // Technical aspects
  technicalLevel: number; // 0-3
  complexityScore: number; // 0-5
  
  // Detailed topics
  topics: string[];
  subtopics: string[];
  
  // Enhanced entity recognition
  entities: {
    people: Array<{
      name: string;
      role?: string;
      importance: 'high' | 'medium' | 'low';
      sentiment?: 'positive' | 'neutral' | 'negative';
      relationships?: Array<{
        entity: string;
        relationship: string;
      }>;
    }>;
    companies: Array<{
      name: string;
      relationship?: string;
      type?: 'competitor' | 'partner' | 'customer' | 'vendor';
      importance: 'high' | 'medium' | 'low';
    }>;
    products: Array<{
      name: string;
      version?: string;
      category?: string;
    }>;
    features: Array<{
      name: string;
      product?: string;
      status?: 'current' | 'planned' | 'deprecated';
    }>;
    locations: string[];
    dates: Array<{
      date: string;
      context: string;
    }>;
  };
  
  // SEO and search enhancement
  keywords: string[];
  semanticKeywords: string[]; // Related terms for query expansion
  
  // Document quality metrics
  confidenceScore: number;
  authorityScore: number;
  recencyIndicators: {
    hasTimestamps: boolean;
    mostRecentDate?: string;
    likelyOutdated: boolean;
  };
}

/**
 * Query analysis result from Gemini
 */
export interface QueryAnalysisResult {
  intent: 'factual' | 'technical' | 'comparison' | 'overview';
  entities: Array<{
    type: string;
    name: string;
    importance: number;
  }>;
  primaryCategory?: string;
  secondaryCategories?: string[];
  suggestedFilters: Record<string, any>;
  expectedContentTypes: string[];
  confidence: number;
  technicalLevel?: number;
}

/**
 * Generate system prompt for document analysis
 */
function generateDocumentAnalysisPrompt(text: string): string {
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
  "contentType": "One of: [leadership, product, pricing, technical, company_info, feature, support, competitors, sales, other]",
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

Pay special attention to these sales-focused categories when they apply:
- CASE_STUDIES: Documents that provide detailed customer success stories
- CUSTOMER_TESTIMONIALS: Documents featuring customer quotes and feedback
- ROI_CALCULATOR: Tools or content that calculate return on investment
- PRICING_INFORMATION: Details about pricing, plans, or packages
- COMPETITIVE_ANALYSIS: Information comparing the product to competitors
- PRODUCT_COMPARISON: Direct comparisons between different products or plans
- FEATURE_BENEFITS: Detailed benefits of specific features
- SALES_ENABLEMENT: Materials created to support the sales process
- IMPLEMENTATION_PROCESS: Information about implementation and onboarding
- CONTRACT_TERMS: Information about contracts and agreements
- CUSTOMER_SUCCESS_STORIES: Stories of successful customer implementations
- PRODUCT_ROADMAP: Information about future product plans
- INDUSTRY_INSIGHTS: Knowledge about industry trends and challenges
- COST_SAVINGS_ANALYSIS: Analysis of potential cost savings
- DEMO_MATERIALS: Resources for product demonstrations
`;
}

/**
 * Generate system prompt for enhanced document analysis with more detailed categorization
 */
function generateEnhancedAnalysisPrompt(text: string): string {
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
  "contentType": "One of: [leadership, product, pricing, technical, company_info, feature, support, competitor, partner, market, training, legal, policy, sales, other]",
  
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

IMPORTANT: For the primaryCategory and secondaryCategories fields, you MUST use ONLY values from this standardized list: ${categoryValues}. Do not invent new categories.

Pay special attention to these sales-focused categories when they apply:
- CASE_STUDIES: Documents that provide detailed customer success stories
- CUSTOMER_TESTIMONIALS: Documents featuring customer quotes and feedback
- ROI_CALCULATOR: Tools or content that calculate return on investment
- PRICING_INFORMATION: Details about pricing, plans, or packages
- COMPETITIVE_ANALYSIS: Information comparing the product to competitors
- PRODUCT_COMPARISON: Direct comparisons between different products or plans
- FEATURE_BENEFITS: Detailed benefits of specific features
- SALES_ENABLEMENT: Materials created to support the sales process
- IMPLEMENTATION_PROCESS: Information about implementation and onboarding
- CONTRACT_TERMS: Information about contracts and agreements
- CUSTOMER_SUCCESS_STORIES: Stories of successful customer implementations
- PRODUCT_ROADMAP: Information about future product plans
- INDUSTRY_INSIGHTS: Knowledge about industry trends and challenges
- COST_SAVINGS_ANALYSIS: Analysis of potential cost savings
- DEMO_MATERIALS: Resources for product demonstrations

Also look for sales-related entities such as:
- Value propositions
- ROI figures
- Pricing tiers
- Competitive advantages
- Customer pain points
- Target industries or segments
- Conversion metrics
- Sales cycle information
`;
}

/**
 * Process a document using Gemini API
 * @param text Document text
 * @returns Structured analysis of the document
 */
export async function processDocumentWithGemini(
  text: string
): Promise<GeminiDocumentAnalysis> {
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
    const analysis = JSON.parse(jsonMatch[0]) as GeminiDocumentAnalysis;

    logInfo('Document processed successfully with Gemini', {
      contentType: analysis.contentType,
      primaryCategory: analysis.primaryCategory,
      confidenceScore: analysis.confidenceScore
    });

    return analysis;
  } catch (error) {
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
export async function processDocumentWithEnhancedLabels(
  text: string
): Promise<EnhancedGeminiDocumentAnalysis> {
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
    const analysis = JSON.parse(jsonMatch[0]) as EnhancedGeminiDocumentAnalysis;

    logInfo('Document processed successfully with enhanced labeling', {
      contentType: analysis.contentType,
      primaryCategory: analysis.primaryCategory,
      industryCategories: analysis.industryCategories?.length || 0,
      functionCategories: analysis.functionCategories?.length || 0,
      confidenceScore: analysis.confidenceScore
    });

    return analysis;
  } catch (error) {
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
 * Analyze a user query using Gemini to understand intent, entities, and context
 * 
 * @param query The user query string
 * @returns A promise resolving to the QueryAnalysisResult
 */
export async function analyzeQueryWithGemini(
  query: string
): Promise<QueryAnalysisResult> {
  // Get the category values from STANDARD_CATEGORIES to use in the prompt
  const categoryValues = STANDARD_CATEGORIES.map(cat => cat.value).join(', ');
  
  const systemPrompt = `You are an expert query analyzer for a RAG system. Analyze the user query and extract:
1.  **Intent**: What is the user trying to achieve? (choose one: factual, technical, comparison, overview)
2.  **Entities**: Key people, companies, products, features mentioned.
3.  **Primary Category**: The single most relevant category for this query, chosen ONLY from this list: [${categoryValues}]. Default to GENERAL if unsure.
4.  **Secondary Categories**: 1-2 additional relevant categories from the same list: [${categoryValues}].
5.  **Suggested Filters**: Any implicit filters (e.g., specific date range, technical level).
6.  **Expected Content Types**: What kind of document content would best answer this? (e.g., tutorial, API doc, case study, pricing page).
7.  **Confidence**: Your confidence (0-1) in this analysis.
8.  **Technical Level**: How technical is the query? (1=basic, 5=expert)`;

  const userPrompt = `Query: "${query}"

Return the analysis as a JSON object with fields: intent, entities (array of {type, name, importance}), primaryCategory, secondaryCategories (array), suggestedFilters (object), expectedContentTypes (array), technicalLevel (number 1-5), confidence (number).

Ensure 'primaryCategory' and 'secondaryCategories' use ONLY values from the provided list: [${categoryValues}].`;

  const responseSchema = {
    type: "object",
    properties: {
      intent: { type: "string", enum: ["factual", "technical", "comparison", "overview"] },
      entities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            name: { type: "string" },
            importance: { type: "number" }
          },
          required: ["type", "name", "importance"]
        }
      },
      primaryCategory: { type: "string", enum: [...STANDARD_CATEGORIES.map(c => c.value), "GENERAL"] },
      secondaryCategories: { type: "array", items: { type: "string", enum: STANDARD_CATEGORIES.map(c => c.value) } },
      suggestedFilters: { type: "object" },
      expectedContentTypes: { type: "array", items: { type: "string" } },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      technicalLevel: { type: "number", minimum: 1, maximum: 5 }
    },
    required: ["intent", "entities", "primaryCategory", "secondaryCategories", "suggestedFilters", "expectedContentTypes", "confidence", "technicalLevel"]
  };

  try {
    const result = await generateStructuredGeminiResponse(
      systemPrompt,
      userPrompt,
      responseSchema
    );

    // Validate and return with defaults
    return {
      intent: result?.intent || 'factual',
      entities: result?.entities || [],
      primaryCategory: result?.primaryCategory || 'GENERAL',
      secondaryCategories: result?.secondaryCategories || [],
      suggestedFilters: result?.suggestedFilters || {},
      expectedContentTypes: result?.expectedContentTypes || [],
      confidence: result?.confidence || 0.5,
      technicalLevel: result?.technicalLevel || 1
    };
  } catch (error) {
    logError('Error analyzing query with Gemini', error);
    // Return a default analysis on error
    return {
      intent: 'factual',
      entities: [],
      primaryCategory: 'GENERAL',
      secondaryCategories: [],
      suggestedFilters: {},
      expectedContentTypes: [],
      confidence: 0.1,
      technicalLevel: 1
    };
  }
}

/**
 * Check for conflicts between documents using Gemini
 * @param doc1 First document
 * @param doc2 Second document
 * @returns Analysis of potential conflicts
 */
export async function detectConflictWithGemini(
  doc1: { id: string; text: string },
  doc2: { id: string; text: string }
): Promise<{
  hasConflict: boolean;
  conflictType?: string;
  conflictDescription?: string;
  confidence: number;
  preferredDocument?: string;
}> {
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
  } catch (error) {
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
export function findStandardizedCategory(category: string): string {
  if (!category || typeof category !== 'string') {
    return 'GENERAL';
  }
  
  const standardCategories = getStandardCategories(); // Use the function to get current enum values
  const formattedCategory = category.toUpperCase().trim().replace(/\s+/g, '_');

  // Check if the formatted category is a valid value in the enum
  if (standardCategories.includes(formattedCategory as DocumentCategoryType)) {
    return formattedCategory;
  }

  // If not a direct match, check labels from STANDARD_CATEGORIES in tagUtils.ts
  const matchingStandardCategory = STANDARD_CATEGORIES.find(sc => 
    sc.label.toLowerCase() === category.toLowerCase() || 
    sc.value === formattedCategory
  );

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
export function convertAnalysisToMetadata(analysis: GeminiDocumentAnalysis): Record<string, any> {
  // Extract CEO information if present
  const ceoInfo = analysis.entities.people.find(p => 
    p.role?.toLowerCase().includes('ceo') || 
    p.role?.toLowerCase().includes('chief executive') ||
    p.role?.toLowerCase().includes('founder')
  );
  
  // Extract CTO information if present
  const ctoInfo = analysis.entities.people.find(p => 
    p.role?.toLowerCase().includes('cto') || 
    p.role?.toLowerCase().includes('chief technology') ||
    p.role?.toLowerCase().includes('tech lead')
  );

  // Extract other leadership roles
  const leadershipEntities = analysis.entities.people.filter(p => 
    p.role?.toLowerCase().includes('chief') || 
    p.role?.toLowerCase().includes('coo') ||
    p.role?.toLowerCase().includes('cfo') ||
    p.role?.toLowerCase().includes('director') ||
    p.role?.toLowerCase().includes('head of') ||
    p.role?.toLowerCase().includes('vp') ||
    p.role?.toLowerCase().includes('vice president') ||
    p.role?.toLowerCase().includes('president') ||
    p.role?.toLowerCase().includes('founder')
  );

  // Derive industry categories from content if possible
  const industryCategories: string[] = [];
  // Look for industry mentions in entities and keywords
  if (analysis.entities.companies) {
    analysis.entities.companies.forEach(company => {
      if (company.relationship?.toLowerCase().includes('industry')) {
        industryCategories.push(company.name.toUpperCase().replace(/\s+/g, '_'));
      }
    });
  }
  
  // Check keywords for industry terms
  const industryKeywords = ['restaurant', 'retail', 'healthcare', 'logistics', 'manufacturing', 'franchise', 'hospitality'];
  analysis.keywords.forEach(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    for (const industry of industryKeywords) {
      if (lowerKeyword.includes(industry)) {
        industryCategories.push(industry.toUpperCase());
        break;
      }
    }
  });

  // Derive pain points from content
  const painPointCategories: string[] = [];
  const painPointKeywords = [
    {term: 'turnover', category: 'TURNOVER_REDUCTION'},
    {term: 'retention', category: 'EMPLOYEE_RETENTION'},
    {term: 'efficiency', category: 'EFFICIENCY_IMPROVEMENT'},
    {term: 'time-saving', category: 'TIME_SAVINGS'},
    {term: 'compliance', category: 'COMPLIANCE_MANAGEMENT'},
    {term: 'regulation', category: 'COMPLIANCE_MANAGEMENT'},
    {term: 'employee experience', category: 'EMPLOYEE_EXPERIENCE'},
    {term: 'engagement', category: 'EMPLOYEE_ENGAGEMENT'}
  ];
  
  analysis.keywords.forEach(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    for (const painPoint of painPointKeywords) {
      if (lowerKeyword.includes(painPoint.term)) {
        painPointCategories.push(painPoint.category);
        break;
      }
    }
  });

  // Derive technical features from content
  const technicalFeatureCategories: string[] = [];
  const techKeywords = [
    {term: 'ai', category: 'AI_TOOLS'},
    {term: 'artificial intelligence', category: 'AI_TOOLS'},
    {term: 'machine learning', category: 'AI_TOOLS'},
    {term: 'mobile', category: 'MOBILE_SOLUTIONS'},
    {term: 'app', category: 'MOBILE_SOLUTIONS'},
    {term: 'integration', category: 'INTEGRATIONS'},
    {term: 'api', category: 'INTEGRATIONS'},
    {term: 'security', category: 'DATA_SECURITY'},
    {term: 'encryption', category: 'DATA_SECURITY'}
  ];
  
  // Check keywords and product features for technical terms
  [...analysis.keywords, ...analysis.entities.features].forEach(item => {
    const lowerItem = typeof item === 'string' 
      ? item.toLowerCase() 
      : (item as { name: string }).name.toLowerCase();
    
    for (const tech of techKeywords) {
      if (lowerItem.includes(tech.term)) {
        technicalFeatureCategories.push(tech.category);
        break;
      }
    }
  });

  // Derive value propositions from content
  const valuePropositionCategories: string[] = [];
  const valueProps = [
    {term: 'cost saving', category: 'COST_SAVINGS'},
    {term: 'roi', category: 'COST_SAVINGS'},
    {term: 'time saving', category: 'TIME_SAVINGS'},
    {term: 'faster', category: 'TIME_SAVINGS'},
    {term: 'scalability', category: 'SCALABILITY'},
    {term: 'scale', category: 'SCALABILITY'},
    {term: 'growth', category: 'SCALABILITY'},
    {term: 'employee retention', category: 'EMPLOYEE_RETENTION'},
    {term: 'reduce turnover', category: 'EMPLOYEE_RETENTION'}
  ];
  
  analysis.keywords.forEach(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    for (const valueProp of valueProps) {
      if (lowerKeyword.includes(valueProp.term)) {
        valuePropositionCategories.push(valueProp.category);
        break;
      }
    }
  });

  return {
    // Core metadata
    category: findStandardizedCategory(analysis.contentType),
    primaryCategory: findStandardizedCategory(analysis.primaryCategory),
    secondaryCategories: analysis.secondaryCategories
      .filter(category => category && category.trim() !== '') // Filter out empty categories
      .map(category => findStandardizedCategory(category))
      .filter((value, index, self) => self.indexOf(value) === index), // Remove duplicates
    technicalLevel: analysis.technicalLevel,
    
    // Derived categories from content analysis
    industryCategories: [...new Set(industryCategories)],
    painPointCategories: [...new Set(painPointCategories)],
    technicalFeatureCategories: [...new Set(technicalFeatureCategories)],
    valuePropositionCategories: [...new Set(valuePropositionCategories)],
    
    // Enhanced metadata
    summary: analysis.summary,
    keywords: analysis.keywords,
    entities: {
      people: analysis.entities.people,
      companies: analysis.entities.companies,
      products: analysis.entities.products,
      features: analysis.entities.features
    },
    
    // Leadership information
    hasCeoInfo: !!ceoInfo,
    ceoName: ceoInfo?.name || null,
    hasCtoInfo: !!ctoInfo,
    ctoName: ctoInfo?.name || null,
    leadershipTeam: leadershipEntities.map(p => p.name),
    
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
export function convertEnhancedAnalysisToMetadata(
  analysis: EnhancedGeminiDocumentAnalysis
): Record<string, any> {
  // Extract CEO information if present
  const ceoInfo = analysis.entities.people.find(p => 
    p.role?.toLowerCase().includes('ceo') || 
    p.role?.toLowerCase().includes('chief executive') ||
    p.role?.toLowerCase().includes('founder')
  );

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
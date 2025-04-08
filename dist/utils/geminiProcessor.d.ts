/**
 * Gemini Document Processing Utility
 *
 * This module handles interaction with Google's Gemini API for document analysis,
 * metadata extraction, categorization, and conflict detection.
 */
/**
 * Document analysis result from Gemini
 */
export interface GeminiDocumentAnalysis {
    summary: string;
    contentType: string;
    primaryCategory: string;
    secondaryCategories: string[];
    technicalLevel: number;
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
    primaryCategory: string;
    secondaryCategories: string[];
    industryCategories: string[];
    functionCategories: string[];
    useCases: string[];
    technicalLevel: number;
    complexityScore: number;
    topics: string[];
    subtopics: string[];
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
    keywords: string[];
    semanticKeywords: string[];
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
    suggestedFilters: Record<string, any>;
    expectedContentTypes: string[];
    confidence: number;
}
/**
 * Process a document using Gemini API
 * @param text Document text
 * @returns Structured analysis of the document
 */
export declare function processDocumentWithGemini(text: string): Promise<GeminiDocumentAnalysis>;
/**
 * Process a document with enhanced labeling capabilities
 * This expands on the basic document processing with more detailed categories,
 * better entity recognition, and hierarchical classification
 *
 * @param text Document text
 * @returns Enhanced document analysis with detailed categorization
 */
export declare function processDocumentWithEnhancedLabels(text: string): Promise<EnhancedGeminiDocumentAnalysis>;
/**
 * Analyze a user query using Gemini
 * @param query User query text
 * @returns Analysis of query intent and structure
 */
export declare function analyzeQueryWithGemini(query: string): Promise<QueryAnalysisResult>;
/**
 * Check for conflicts between documents using Gemini
 * @param doc1 First document
 * @param doc2 Second document
 * @returns Analysis of potential conflicts
 */
export declare function detectConflictWithGemini(doc1: {
    id: string;
    text: string;
}, doc2: {
    id: string;
    text: string;
}): Promise<{
    hasConflict: boolean;
    conflictType?: string;
    conflictDescription?: string;
    confidence: number;
    preferredDocument?: string;
}>;
/**
 * Convert Gemini analysis to document metadata
 * @param analysis Gemini document analysis
 * @returns Metadata suitable for storage in vector database
 */
export declare function convertAnalysisToMetadata(analysis: GeminiDocumentAnalysis): Record<string, any>;
/**
 * Convert enhanced analysis to document metadata
 * Maps the detailed Gemini analysis to metadata format suitable for storage
 *
 * @param analysis Enhanced document analysis from Gemini
 * @returns Metadata record for storage
 */
export declare function convertEnhancedAnalysisToMetadata(analysis: EnhancedGeminiDocumentAnalysis): Record<string, any>;

/**
 * Enhanced Metadata Types
 * 
 * This module defines the enhanced metadata structure for documents
 * to support smart ingestion and query routing.
 */

import { 
  DocumentCategoryType, 
  QualityControlFlag,
  ConfidenceLevel as ImportedConfidenceLevel,
  EntityType as ImportedEntityType
} from '../utils/documentCategories';

/**
 * Types related to document metadata and approval workflows
 */

// Document categories
export type DocumentCategory = 
  | 'PRODUCT' 
  | 'TECHNICAL' 
  | 'FEATURES' 
  | 'PRICING' 
  | 'COMPARISON' 
  | 'CUSTOMER_CASE' 
  | 'GENERAL';

// Entity types for extraction
export type EntityType = 
  | 'PRODUCT_NAME' 
  | 'FEATURE_NAME' 
  | 'PRICING_PLAN' 
  | 'VERSION_NUMBER' 
  | 'CUSTOMER_NAME' 
  | 'COMPETITOR_NAME';

// Confidence levels for metadata extraction
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

// Document quality flags
export type QualityFlag = 
  | 'OUTDATED' 
  | 'CONTRADICTORY' 
  | 'INCOMPLETE' 
  | 'DUPLICATE' 
  | 'NEEDS_CLARIFICATION';

// Review status of a document
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Approval decision for documents
export type ApprovalDecision = 'approve' | 'reject';

/**
 * Enhanced document metadata
 */
export interface EnhancedMetadata {
  // Basic metadata
  source: string;                   // Original source of the document
  title?: string;                   // Document title if available
  author?: string;                  // Document author if available
  createdAt?: string;               // Creation date if available
  lastModified?: string;            // Last modification date if available
  contentType?: string;             // Content MIME type (e.g., text/plain, application/pdf)
  
  // Classification metadata
  primaryCategory: DocumentCategoryType;  // Primary document category
  secondaryCategories: DocumentCategoryType[]; // Additional categories
  confidenceScore: number;          // Confidence score for categorization (0-1)
  
  // Content analysis
  summary: string;                  // Brief summary of the content
  keyTopics: string[];              // Key topics covered in the document
  technicalLevel: number;           // Technical complexity level (1-5)
  keywords: string[];               // Extracted keywords from content
  
  // Extracted entities
  entities: ExtractedEntity[];      // Entities extracted from the document
  
  // Quality control
  qualityFlags: QualityControlFlag[]; // Any quality control flags
  approved: boolean;                // Whether content is approved
  approvedBy?: string;              // Who approved the content
  approvalDate?: string;            // When content was approved
  
  // Query routing
  routingPriority: number;          // Priority for query routing (1-5)
  
  // Version control
  version?: string;                 // Version of the document
  previousVersions?: string[];      // IDs of previous versions
  
  // Document structure
  section?: string;                 // Section name if part of larger document
  pageNumber?: number;              // Page number in source document
  
  // For conflicting information
  conflictsWith?: string[];         // IDs of documents with conflicting info
  
  // Additional metadata
  confidentialityLevel?: string;    // Level of confidentiality
  expiryDate?: string;              // When content expires/needs review
  tags?: string[];                  // Custom tags
}

/**
 * Extracted entity from document content
 */
export interface ExtractedEntity {
  name: string;                     // Entity name
  type: ImportedEntityType;         // Entity type
  confidence: ImportedConfidenceLevel;      // Confidence level
  mentions: number;                 // Number of mentions in document
  metadata?: Record<string, any>;   // Additional entity metadata
  
  // Context of extraction - for disambiguation
  contextBefore?: string;           // Text before entity mention
  contextAfter?: string;            // Text after entity mention
}

/**
 * Pending document metadata - for approval workflow
 */
export interface PendingDocumentMetadata extends EnhancedMetadata {
  submittedAt: string;              // When document was submitted
  submittedBy?: string;             // Who submitted the document
  reviewStatus: 'pending' | 'under_review' | 'approved' | 'rejected';
  reviewComments?: string;          // Reviewer comments
  reviewedBy?: string;              // Who reviewed the document
  reviewedAt?: string;              // When document was reviewed
}

/**
 * Document version for tracking changes
 */
export interface DocumentVersion {
  versionId: string;                // Version identifier
  metadata: EnhancedMetadata;       // Metadata for this version
  createdAt: string;                // When this version was created
  createdBy?: string;               // Who created this version
  changeDescription?: string;       // Description of changes from previous version
}

/**
 * Category-based retrieval filter
 */
export interface CategoryFilter {
  primaryCategory?: DocumentCategoryType;
  includeCategories?: DocumentCategoryType[];
  excludeCategories?: DocumentCategoryType[];
  minConfidenceScore?: number;      // Minimum confidence score (0-1)
  onlyApproved?: boolean;           // Only retrieve approved content
  technicalLevelRange?: {min: number, max: number}; // Technical level range
}

/**
 * Query routing information
 */
export interface QueryRouting {
  detectedCategories: DocumentCategoryType[];
  detectedEntities: ExtractedEntity[];
  confidenceScore: number;          // Confidence in category assignment
  fallbackToGeneral: boolean;       // Whether to fallback to general search
  filters: CategoryFilter;          // Filters to apply to retrieval
}

/**
 * Create default enhanced metadata
 */
export function createDefaultMetadata(source: string): EnhancedMetadata {
  return {
    source,
    primaryCategory: DocumentCategoryType.GENERAL,
    secondaryCategories: [],
    confidenceScore: 0,
    summary: '',
    keyTopics: [],
    technicalLevel: 1,
    keywords: [],
    entities: [],
    qualityFlags: [QualityControlFlag.PENDING_REVIEW],
    approved: false,
    routingPriority: 5
  };
}

/**
 * Check if metadata needs manual review
 */
export function needsManualReview(metadata: EnhancedMetadata): boolean {
  // Check for quality flags that require review
  const hasReviewFlag = metadata.qualityFlags.some(flag => 
    flag === QualityControlFlag.PENDING_REVIEW ||
    flag === QualityControlFlag.NEEDS_CLARIFICATION ||
    flag === QualityControlFlag.CONTAINS_CONTRADICTIONS
  );
  
  // Check for low confidence score
  const hasLowConfidence = metadata.confidenceScore < 0.7;
  
  // Check for sensitive categories
  const hasSensitiveCategory = 
    metadata.primaryCategory === DocumentCategoryType.CUSTOMER ||
    metadata.primaryCategory === DocumentCategoryType.PRICING ||
    metadata.primaryCategory === DocumentCategoryType.COMPETITORS ||
    metadata.primaryCategory === DocumentCategoryType.INTERNAL_POLICY;
  
  return hasReviewFlag || (hasLowConfidence && hasSensitiveCategory);
}

/**
 * Merge metadata from multiple chunks of the same document
 */
export function mergeMetadata(metadataList: EnhancedMetadata[]): EnhancedMetadata {
  if (metadataList.length === 0) {
    throw new Error('Cannot merge empty metadata list');
  }
  
  if (metadataList.length === 1) {
    return metadataList[0];
  }
  
  // Use the metadata from the first chunk as the base
  const baseMetadata = { ...metadataList[0] };
  
  // Count category occurrences to find the most common one
  const categoryCount: Record<DocumentCategoryType, number> = {} as Record<DocumentCategoryType, number>;
  
  // Collect all secondary categories
  const allSecondaryCategories = new Set<DocumentCategoryType>();
  
  // Collect all entities and keywords
  const entitiesMap = new Map<string, ExtractedEntity>();
  const keywordsSet = new Set<string>();
  const topicsSet = new Set<string>();
  
  // Collect all quality flags
  const qualityFlagsSet = new Set<QualityControlFlag>();
  
  // Calculate average confidence score and technical level
  let totalConfidenceScore = 0;
  let totalTechnicalLevel = 0;
  
  // Process each metadata item
  metadataList.forEach(metadata => {
    // Count primary category occurrences
    const primaryCat = metadata.primaryCategory;
    categoryCount[primaryCat] = (categoryCount[primaryCat] || 0) + 1;
    
    // Add secondary categories to set
    metadata.secondaryCategories.forEach(cat => {
      // Also count secondary categories (with lower weight)
      categoryCount[cat] = (categoryCount[cat] || 0) + 0.5;
      allSecondaryCategories.add(cat);
    });
    
    // Add entities to map, updating mentions count
    metadata.entities.forEach(entity => {
      const key = `${entity.type}:${entity.name}`;
      if (entitiesMap.has(key)) {
        const existing = entitiesMap.get(key)!;
        existing.mentions += entity.mentions;
        
        // Upgrade confidence if new entity has higher confidence
        if (confidenceLevelValue(entity.confidence) > confidenceLevelValue(existing.confidence)) {
          existing.confidence = entity.confidence;
        }
      } else {
        entitiesMap.set(key, { ...entity });
      }
    });
    
    // Add keywords and topics to sets
    metadata.keywords.forEach(keyword => keywordsSet.add(keyword));
    metadata.keyTopics.forEach(topic => topicsSet.add(topic));
    
    // Add quality flags to set
    metadata.qualityFlags.forEach(flag => qualityFlagsSet.add(flag));
    
    // Add to confidence score and technical level totals
    totalConfidenceScore += metadata.confidenceScore;
    totalTechnicalLevel += metadata.technicalLevel;
  });
  
  // Find most common primary category
  let mostCommonCategory = baseMetadata.primaryCategory;
  let highestCount = 0;
  
  Object.entries(categoryCount).forEach(([category, count]) => {
    if (count > highestCount) {
      highestCount = count;
      mostCommonCategory = category as DocumentCategoryType;
    }
  });
  
  // Remove most common category from secondary categories
  allSecondaryCategories.delete(mostCommonCategory);
  
  // Update the merged metadata
  return {
    ...baseMetadata,
    primaryCategory: mostCommonCategory,
    secondaryCategories: Array.from(allSecondaryCategories),
    confidenceScore: totalConfidenceScore / metadataList.length,
    technicalLevel: Math.round(totalTechnicalLevel / metadataList.length),
    keywords: Array.from(keywordsSet),
    keyTopics: Array.from(topicsSet),
    entities: Array.from(entitiesMap.values()),
    qualityFlags: Array.from(qualityFlagsSet),
    // Don't merge approved status - if any chunk is not approved, the merged result is not approved
    approved: metadataList.every(metadata => metadata.approved)
  };
}

/**
 * Convert confidence level to numeric value for comparison
 */
function confidenceLevelValue(level: ImportedConfidenceLevel): number {
  switch (level) {
    case ImportedConfidenceLevel.HIGH:
      return 3;
    case ImportedConfidenceLevel.MEDIUM:
      return 2;
    case ImportedConfidenceLevel.LOW:
      return 1;
    case ImportedConfidenceLevel.UNCERTAIN:
    default:
      return 0;
  }
}

// Response from LLM for metadata extraction
export interface ExtractedMetadata {
  categories: DocumentCategory[];
  primaryCategory: DocumentCategory;
  technicalLevel: number; // 1-10 scale
  entities: {
    type: EntityType;
    value: string;
    confidence: ConfidenceLevel;
  }[];
  keywords: string[];
  summary: string;
  qualityFlags: QualityFlag[];
}

// Approval options for documents
export interface ApprovalOptions {
  decision: ApprovalDecision;
  reason: string;
  reviewerId: string;
  reviewDate: string;
  updateVectorStore: boolean;
  updateBM25Stats: boolean;
}

// Document pending approval
export interface StoredPendingDocument {
  reviewStatus: ReviewStatus;
  submittedDate: string;
  submittedBy?: string;
  reviewDate?: string;
  reviewerId?: string;
  rejectionReason?: string;
  metadata: EnhancedMetadata;
}

// Internal conflict check result
export interface ContentConflictResult {
  hasConflicts: boolean;
  conflictingDocIds: string[];
}

/**
 * Metadata Types
 * 
 * Defines standard metadata types for documents in the system.
 */

// Entity type for document metadata
export interface DocumentEntity {
  name: string;
  type: string;
  relevance: number; // 0-1 relevance score
}

// Document metadata structure
export interface DocumentMetadata {
  // Content classification
  title?: string;
  summary?: string;
  categories: DocumentCategory[];
  primaryCategory: DocumentCategory;
  
  // Technical aspects
  technicalLevel: number; // 1-10 scale
  lastUpdated?: string; // ISO date string
  
  // Source information
  source?: string;
  author?: string;
  
  // Semantic enrichment
  keywords: string[];
  entities: DocumentEntity[];
  
  // Additional metadata
  language?: string;
  contentType?: string;
  wordCount?: number;
}

// Search filter options
export interface MetadataFilter {
  categories?: DocumentCategory[];
  strictCategoryMatch?: boolean;
  technicalLevelMin?: number;
  technicalLevelMax?: number;
  lastUpdatedAfter?: string;
  entities?: string[];
  keywords?: string[];
}

// Document with its metadata
export interface Document {
  id: string;
  text: string;
  metadata?: DocumentMetadata;
}

// Search result with source document and relevance score
export interface SearchResult {
  item: Document;
  score: number;
  vectorScore?: number;
  bm25Score?: number;
} 
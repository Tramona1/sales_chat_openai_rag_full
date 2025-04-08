/**
 * Enhanced Metadata Types
 *
 * This module defines the enhanced metadata structure for documents
 * to support smart ingestion and query routing.
 */
import { DocumentCategoryType, QualityControlFlag, ConfidenceLevel as ImportedConfidenceLevel, EntityType as ImportedEntityType } from '../utils/documentCategories';
/**
 * Types related to document metadata and approval workflows
 */
export type DocumentCategory = 'PRODUCT' | 'TECHNICAL' | 'FEATURES' | 'PRICING' | 'COMPARISON' | 'CUSTOMER_CASE' | 'GENERAL';
export type EntityType = 'PRODUCT_NAME' | 'FEATURE_NAME' | 'PRICING_PLAN' | 'VERSION_NUMBER' | 'CUSTOMER_NAME' | 'COMPETITOR_NAME';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type QualityFlag = 'OUTDATED' | 'CONTRADICTORY' | 'INCOMPLETE' | 'DUPLICATE' | 'NEEDS_CLARIFICATION';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ApprovalDecision = 'approve' | 'reject';
/**
 * Enhanced document metadata
 */
export interface EnhancedMetadata {
    source: string;
    title?: string;
    author?: string;
    createdAt?: string;
    lastModified?: string;
    contentType?: string;
    primaryCategory: DocumentCategoryType;
    secondaryCategories: DocumentCategoryType[];
    confidenceScore: number;
    summary: string;
    keyTopics: string[];
    technicalLevel: number;
    keywords: string[];
    entities: ExtractedEntity[];
    qualityFlags: QualityControlFlag[];
    approved: boolean;
    approvedBy?: string;
    approvalDate?: string;
    routingPriority: number;
    version?: string;
    previousVersions?: string[];
    section?: string;
    pageNumber?: number;
    conflictsWith?: string[];
    confidentialityLevel?: string;
    expiryDate?: string;
    tags?: string[];
}
/**
 * Extracted entity from document content
 */
export interface ExtractedEntity {
    name: string;
    type: ImportedEntityType;
    confidence: ImportedConfidenceLevel;
    mentions: number;
    metadata?: Record<string, any>;
    contextBefore?: string;
    contextAfter?: string;
}
/**
 * Pending document metadata - for approval workflow
 */
export interface PendingDocumentMetadata extends EnhancedMetadata {
    submittedAt: string;
    submittedBy?: string;
    reviewStatus: 'pending' | 'under_review' | 'approved' | 'rejected';
    reviewComments?: string;
    reviewedBy?: string;
    reviewedAt?: string;
}
/**
 * Document version for tracking changes
 */
export interface DocumentVersion {
    versionId: string;
    metadata: EnhancedMetadata;
    createdAt: string;
    createdBy?: string;
    changeDescription?: string;
}
/**
 * Category-based retrieval filter
 */
export interface CategoryFilter {
    primaryCategory?: DocumentCategoryType;
    includeCategories?: DocumentCategoryType[];
    excludeCategories?: DocumentCategoryType[];
    minConfidenceScore?: number;
    onlyApproved?: boolean;
    technicalLevelRange?: {
        min: number;
        max: number;
    };
}
/**
 * Query routing information
 */
export interface QueryRouting {
    detectedCategories: DocumentCategoryType[];
    detectedEntities: ExtractedEntity[];
    confidenceScore: number;
    fallbackToGeneral: boolean;
    filters: CategoryFilter;
}
/**
 * Create default enhanced metadata
 */
export declare function createDefaultMetadata(source: string): EnhancedMetadata;
/**
 * Check if metadata needs manual review
 */
export declare function needsManualReview(metadata: EnhancedMetadata): boolean;
/**
 * Merge metadata from multiple chunks of the same document
 */
export declare function mergeMetadata(metadataList: EnhancedMetadata[]): EnhancedMetadata;
export interface ExtractedMetadata {
    categories: DocumentCategory[];
    primaryCategory: DocumentCategory;
    technicalLevel: number;
    entities: {
        type: EntityType;
        value: string;
        confidence: ConfidenceLevel;
    }[];
    keywords: string[];
    summary: string;
    qualityFlags: QualityFlag[];
}
export interface ApprovalOptions {
    decision: ApprovalDecision;
    reason: string;
    reviewerId: string;
    reviewDate: string;
    updateVectorStore: boolean;
    updateBM25Stats: boolean;
}
export interface StoredPendingDocument {
    reviewStatus: ReviewStatus;
    submittedDate: string;
    submittedBy?: string;
    reviewDate?: string;
    reviewerId?: string;
    rejectionReason?: string;
    metadata: EnhancedMetadata;
}
export interface ContentConflictResult {
    hasConflicts: boolean;
    conflictingDocIds: string[];
}
/**
 * Metadata Types
 *
 * Defines standard metadata types for documents in the system.
 */
export interface DocumentEntity {
    name: string;
    type: string;
    relevance: number;
}
export interface DocumentMetadata {
    title?: string;
    summary?: string;
    categories: DocumentCategory[];
    primaryCategory: DocumentCategory;
    technicalLevel: number;
    lastUpdated?: string;
    source?: string;
    author?: string;
    keywords: string[];
    entities: DocumentEntity[];
    language?: string;
    contentType?: string;
    wordCount?: number;
}
export interface MetadataFilter {
    categories?: DocumentCategory[];
    strictCategoryMatch?: boolean;
    technicalLevelMin?: number;
    technicalLevelMax?: number;
    lastUpdatedAfter?: string;
    entities?: string[];
    keywords?: string[];
}
export interface Document {
    id: string;
    text: string;
    metadata?: DocumentMetadata;
}
export interface SearchResult {
    item: Document;
    score: number;
    vectorScore?: number;
    bm25Score?: number;
}

/**
 * Document Categories Definition
 *
 * This module defines the document categories used for classifying content
 * and enabling smart query routing.
 */
/**
 * Document category types
 */
export declare enum DocumentCategoryType {
    PRODUCT = "product",
    PRICING = "pricing",
    FEATURES = "features",
    TECHNICAL = "technical",
    CUSTOMER = "customer",
    CASE_STUDY = "case_study",
    TESTIMONIAL = "testimonial",
    SALES_PROCESS = "sales_process",
    COMPETITORS = "competitors",
    MARKET = "market",
    INTERNAL_POLICY = "internal_policy",
    TRAINING = "training",
    FAQ = "faq",
    GENERAL = "general",
    OTHER = "other"
}
/**
 * Category attributes for additional metadata
 */
export interface CategoryAttributes {
    displayName: string;
    description: string;
    associatedKeywords: string[];
    potentiallySensitive: boolean;
    requiresApproval: boolean;
    color: string;
    routingPriority: number;
}
/**
 * Map of category attributes for each document category
 */
export declare const CATEGORY_ATTRIBUTES: Record<DocumentCategoryType, CategoryAttributes>;
/**
 * Get all available document categories
 */
export declare function getAllCategories(): DocumentCategoryType[];
/**
 * Get categories that potentially contain sensitive information
 */
export declare function getSensitiveCategories(): DocumentCategoryType[];
/**
 * Get categories that require approval
 */
export declare function getApprovalRequiredCategories(): DocumentCategoryType[];
/**
 * Get high priority categories for routing
 */
export declare function getHighPriorityCategories(): DocumentCategoryType[];
/**
 * Get category attributes for a specific category
 */
export declare function getCategoryAttributes(category: DocumentCategoryType): CategoryAttributes;
/**
 * Find categories that match a set of keywords
 */
export declare function findCategoriesByKeywords(keywords: string[]): DocumentCategoryType[];
/**
 * Determine if a text likely belongs to a specific category
 */
export declare function detectCategoryFromText(text: string): DocumentCategoryType[];
/**
 * Quality control flags for content
 */
export declare enum QualityControlFlag {
    APPROVED = "approved",
    PENDING_REVIEW = "pending_review",
    NEEDS_CLARIFICATION = "needs_clarification",
    CONTAINS_CONTRADICTIONS = "contains_contradictions",
    OUTDATED = "outdated",
    UNRELIABLE_SOURCE = "unreliable_source"
}
/**
 * Determines if a flag requires human review
 */
export declare function requiresHumanReview(flag: QualityControlFlag): boolean;
/**
 * Document confidence level
 */
export declare enum ConfidenceLevel {
    HIGH = "high",
    MEDIUM = "medium",
    LOW = "low",
    UNCERTAIN = "uncertain"
}
/**
 * Entity types that can be extracted from documents
 */
export declare enum EntityType {
    PERSON = "person",
    ORGANIZATION = "organization",
    PRODUCT = "product",
    FEATURE = "feature",
    PRICE = "price",
    DATE = "date",
    LOCATION = "location"
}

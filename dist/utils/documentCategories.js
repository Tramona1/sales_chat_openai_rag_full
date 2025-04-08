"use strict";
/**
 * Document Categories Definition
 *
 * This module defines the document categories used for classifying content
 * and enabling smart query routing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityType = exports.ConfidenceLevel = exports.QualityControlFlag = exports.CATEGORY_ATTRIBUTES = exports.DocumentCategoryType = void 0;
exports.getAllCategories = getAllCategories;
exports.getSensitiveCategories = getSensitiveCategories;
exports.getApprovalRequiredCategories = getApprovalRequiredCategories;
exports.getHighPriorityCategories = getHighPriorityCategories;
exports.getCategoryAttributes = getCategoryAttributes;
exports.findCategoriesByKeywords = findCategoriesByKeywords;
exports.detectCategoryFromText = detectCategoryFromText;
exports.requiresHumanReview = requiresHumanReview;
/**
 * Document category types
 */
var DocumentCategoryType;
(function (DocumentCategoryType) {
    // Company and product information
    DocumentCategoryType["PRODUCT"] = "product";
    DocumentCategoryType["PRICING"] = "pricing";
    DocumentCategoryType["FEATURES"] = "features";
    DocumentCategoryType["TECHNICAL"] = "technical";
    // Customer information
    DocumentCategoryType["CUSTOMER"] = "customer";
    DocumentCategoryType["CASE_STUDY"] = "case_study";
    DocumentCategoryType["TESTIMONIAL"] = "testimonial";
    // Sales information
    DocumentCategoryType["SALES_PROCESS"] = "sales_process";
    DocumentCategoryType["COMPETITORS"] = "competitors";
    DocumentCategoryType["MARKET"] = "market";
    // Internal information
    DocumentCategoryType["INTERNAL_POLICY"] = "internal_policy";
    DocumentCategoryType["TRAINING"] = "training";
    // Miscellaneous
    DocumentCategoryType["FAQ"] = "faq";
    DocumentCategoryType["GENERAL"] = "general";
    DocumentCategoryType["OTHER"] = "other";
})(DocumentCategoryType || (exports.DocumentCategoryType = DocumentCategoryType = {}));
/**
 * Map of category attributes for each document category
 */
exports.CATEGORY_ATTRIBUTES = {
    [DocumentCategoryType.PRODUCT]: {
        displayName: 'Product Information',
        description: 'General product information, overviews, and capabilities',
        associatedKeywords: ['product', 'offering', 'solution', 'platform', 'service'],
        potentiallySensitive: false,
        requiresApproval: false,
        color: '#4285F4',
        routingPriority: 1
    },
    [DocumentCategoryType.PRICING]: {
        displayName: 'Pricing Information',
        description: 'Pricing plans, tiers, and special offers',
        associatedKeywords: ['pricing', 'cost', 'subscription', 'plan', 'tier', 'discount'],
        potentiallySensitive: true,
        requiresApproval: true,
        color: '#34A853',
        routingPriority: 1
    },
    [DocumentCategoryType.FEATURES]: {
        displayName: 'Product Features',
        description: 'Information about specific features and functionality',
        associatedKeywords: [
            'feature', 'features', 'functionality', 'capabilities', 'function',
            'new', 'latest', 'recent', 'update', 'updated', 'upgrade',
            'launch', 'launched', 'release', 'released', 'rollout',
            'quarter', 'quarterly', 'month', 'monthly', 'year', 'annual',
            'enhancement', 'improvement', 'addition'
        ],
        potentiallySensitive: false,
        requiresApproval: false,
        color: '#3B82F6',
        routingPriority: 5
    },
    [DocumentCategoryType.TECHNICAL]: {
        displayName: 'Technical Documentation',
        description: 'Technical specifications, APIs, and implementation details',
        associatedKeywords: ['technical', 'api', 'integration', 'architecture', 'spec'],
        potentiallySensitive: false,
        requiresApproval: false,
        color: '#1A73E8',
        routingPriority: 2
    },
    [DocumentCategoryType.CUSTOMER]: {
        displayName: 'Customer Information',
        description: 'Customer profiles, demographics, and needs',
        associatedKeywords: ['customer', 'client', 'buyer', 'demographic', 'segment'],
        potentiallySensitive: true,
        requiresApproval: true,
        color: '#EA4335',
        routingPriority: 1
    },
    [DocumentCategoryType.CASE_STUDY]: {
        displayName: 'Case Studies',
        description: 'Success stories and customer implementations',
        associatedKeywords: ['case study', 'success story', 'implementation', 'results', 'roi'],
        potentiallySensitive: false,
        requiresApproval: true,
        color: '#9C27B0',
        routingPriority: 2
    },
    [DocumentCategoryType.TESTIMONIAL]: {
        displayName: 'Testimonials',
        description: 'Customer quotes and testimonials',
        associatedKeywords: ['testimonial', 'quote', 'review', 'feedback', 'endorsement'],
        potentiallySensitive: false,
        requiresApproval: true,
        color: '#FF9800',
        routingPriority: 3
    },
    [DocumentCategoryType.SALES_PROCESS]: {
        displayName: 'Sales Process',
        description: 'Information on sales methodologies and processes',
        associatedKeywords: ['sales process', 'methodology', 'pipeline', 'stages', 'closing'],
        potentiallySensitive: true,
        requiresApproval: false,
        color: '#607D8B',
        routingPriority: 2
    },
    [DocumentCategoryType.COMPETITORS]: {
        displayName: 'Competitor Analysis',
        description: 'Information about competitors and competitive positioning',
        associatedKeywords: ['competitor', 'competition', 'vs', 'comparison', 'alternative'],
        potentiallySensitive: true,
        requiresApproval: true,
        color: '#F44336',
        routingPriority: 2
    },
    [DocumentCategoryType.MARKET]: {
        displayName: 'Market Information',
        description: 'Market trends, analysis, and industry information',
        associatedKeywords: ['market', 'industry', 'trend', 'analysis', 'forecast', 'growth'],
        potentiallySensitive: false,
        requiresApproval: false,
        color: '#3F51B5',
        routingPriority: 3
    },
    [DocumentCategoryType.INTERNAL_POLICY]: {
        displayName: 'Internal Policies',
        description: 'Company policies and procedures',
        associatedKeywords: ['policy', 'procedure', 'guideline', 'compliance', 'regulation'],
        potentiallySensitive: true,
        requiresApproval: true,
        color: '#795548',
        routingPriority: 4
    },
    [DocumentCategoryType.TRAINING]: {
        displayName: 'Training Materials',
        description: 'Training content and onboarding materials',
        associatedKeywords: ['training', 'onboarding', 'lesson', 'course', 'learning'],
        potentiallySensitive: false,
        requiresApproval: false,
        color: '#009688',
        routingPriority: 3
    },
    [DocumentCategoryType.FAQ]: {
        displayName: 'FAQs',
        description: 'Frequently asked questions and answers',
        associatedKeywords: ['faq', 'question', 'answer', 'common question', 'how to'],
        potentiallySensitive: false,
        requiresApproval: false,
        color: '#00BCD4',
        routingPriority: 2
    },
    [DocumentCategoryType.GENERAL]: {
        displayName: 'General Information',
        description: 'General information that doesn\'t fit other categories',
        associatedKeywords: ['general', 'information', 'about', 'misc'],
        potentiallySensitive: false,
        requiresApproval: false,
        color: '#9E9E9E',
        routingPriority: 5
    },
    [DocumentCategoryType.OTHER]: {
        displayName: 'Other',
        description: 'Uncategorized content that requires review',
        associatedKeywords: ['other', 'miscellaneous', 'unclassified'],
        potentiallySensitive: false,
        requiresApproval: true,
        color: '#757575',
        routingPriority: 5
    }
};
/**
 * Get all available document categories
 */
function getAllCategories() {
    return Object.values(DocumentCategoryType);
}
/**
 * Get categories that potentially contain sensitive information
 */
function getSensitiveCategories() {
    return Object.entries(exports.CATEGORY_ATTRIBUTES)
        .filter(([_, attributes]) => attributes.potentiallySensitive)
        .map(([category]) => category);
}
/**
 * Get categories that require approval
 */
function getApprovalRequiredCategories() {
    return Object.entries(exports.CATEGORY_ATTRIBUTES)
        .filter(([_, attributes]) => attributes.requiresApproval)
        .map(([category]) => category);
}
/**
 * Get high priority categories for routing
 */
function getHighPriorityCategories() {
    return Object.entries(exports.CATEGORY_ATTRIBUTES)
        .filter(([_, attributes]) => attributes.routingPriority <= 2)
        .map(([category]) => category);
}
/**
 * Get category attributes for a specific category
 */
function getCategoryAttributes(category) {
    return exports.CATEGORY_ATTRIBUTES[category];
}
/**
 * Find categories that match a set of keywords
 */
function findCategoriesByKeywords(keywords) {
    const normalizedKeywords = keywords.map(k => k.toLowerCase().trim());
    return Object.entries(exports.CATEGORY_ATTRIBUTES)
        .filter(([_, attributes]) => {
        return attributes.associatedKeywords.some(keyword => normalizedKeywords.some(nk => nk.includes(keyword) || keyword.includes(nk)));
    })
        .map(([category]) => category);
}
/**
 * Determine if a text likely belongs to a specific category
 */
function detectCategoryFromText(text) {
    const normalizedText = text.toLowerCase();
    // Calculate "score" for each category based on keyword matches
    const scores = Object.entries(exports.CATEGORY_ATTRIBUTES).map(([category, attributes]) => {
        const matchCount = attributes.associatedKeywords.filter(keyword => normalizedText.includes(keyword.toLowerCase())).length;
        // Calculate score based on number of matches and keyword length (longer = more specific)
        const score = attributes.associatedKeywords.reduce((total, keyword) => {
            if (normalizedText.includes(keyword.toLowerCase())) {
                return total + keyword.length;
            }
            return total;
        }, 0);
        return {
            category: category,
            matchCount,
            score,
            priority: attributes.routingPriority
        };
    });
    // Sort by score (descending) and filter out zero matches
    const sortedScores = scores
        .filter(item => item.matchCount > 0)
        .sort((a, b) => {
        // First sort by match count
        if (b.matchCount !== a.matchCount) {
            return b.matchCount - a.matchCount;
        }
        // Then by score (keyword length)
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        // Finally by priority
        return a.priority - b.priority;
    });
    // If we have matches, return the top categories (up to 3)
    if (sortedScores.length > 0) {
        return sortedScores.slice(0, 3).map(item => item.category);
    }
    // Default to GENERAL if no matches
    return [DocumentCategoryType.GENERAL];
}
/**
 * Quality control flags for content
 */
var QualityControlFlag;
(function (QualityControlFlag) {
    QualityControlFlag["APPROVED"] = "approved";
    QualityControlFlag["PENDING_REVIEW"] = "pending_review";
    QualityControlFlag["NEEDS_CLARIFICATION"] = "needs_clarification";
    QualityControlFlag["CONTAINS_CONTRADICTIONS"] = "contains_contradictions";
    QualityControlFlag["OUTDATED"] = "outdated";
    QualityControlFlag["UNRELIABLE_SOURCE"] = "unreliable_source";
})(QualityControlFlag || (exports.QualityControlFlag = QualityControlFlag = {}));
/**
 * Determines if a flag requires human review
 */
function requiresHumanReview(flag) {
    return [
        QualityControlFlag.PENDING_REVIEW,
        QualityControlFlag.NEEDS_CLARIFICATION,
        QualityControlFlag.CONTAINS_CONTRADICTIONS,
        QualityControlFlag.UNRELIABLE_SOURCE
    ].includes(flag);
}
/**
 * Document confidence level
 */
var ConfidenceLevel;
(function (ConfidenceLevel) {
    ConfidenceLevel["HIGH"] = "high";
    ConfidenceLevel["MEDIUM"] = "medium";
    ConfidenceLevel["LOW"] = "low";
    ConfidenceLevel["UNCERTAIN"] = "uncertain";
})(ConfidenceLevel || (exports.ConfidenceLevel = ConfidenceLevel = {}));
/**
 * Entity types that can be extracted from documents
 */
var EntityType;
(function (EntityType) {
    EntityType["PERSON"] = "person";
    EntityType["ORGANIZATION"] = "organization";
    EntityType["PRODUCT"] = "product";
    EntityType["FEATURE"] = "feature";
    EntityType["PRICE"] = "price";
    EntityType["DATE"] = "date";
    EntityType["LOCATION"] = "location";
})(EntityType || (exports.EntityType = EntityType = {}));

/**
 * Document Categories Definition
 * 
 * This module defines the document categories used for classifying content
 * and enabling smart query routing.
 */

/**
 * Document category types
 */
export enum DocumentCategoryType {
  // Company and product information
  PRODUCT = 'product',
  PRICING = 'pricing',
  FEATURES = 'features',
  TECHNICAL = 'technical',
  
  // Customer information
  CUSTOMER = 'customer',
  CASE_STUDY = 'case_study',
  TESTIMONIAL = 'testimonial',
  
  // Sales information
  SALES_PROCESS = 'sales_process',
  COMPETITORS = 'competitors',
  MARKET = 'market',
  
  // Internal information
  INTERNAL_POLICY = 'internal_policy',
  TRAINING = 'training',
  
  // Miscellaneous
  FAQ = 'faq',
  GENERAL = 'general',
  OTHER = 'other'
}

/**
 * Category attributes for additional metadata
 */
export interface CategoryAttributes {
  // Display name for the UI
  displayName: string;
  
  // Description of the category
  description: string;
  
  // Keywords commonly associated with this category
  associatedKeywords: string[];
  
  // Whether this category typically contains sensitive information
  potentiallySensitive: boolean;
  
  // Whether this category requires managerial approval
  requiresApproval: boolean;
  
  // UI color for visual identification (hex code)
  color: string;
  
  // Priority for query routing (1-5, where 1 is highest)
  routingPriority: number;
}

/**
 * Map of category attributes for each document category
 */
export const CATEGORY_ATTRIBUTES: Record<DocumentCategoryType, CategoryAttributes> = {
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
export function getAllCategories(): DocumentCategoryType[] {
  return Object.values(DocumentCategoryType);
}

/**
 * Get categories that potentially contain sensitive information
 */
export function getSensitiveCategories(): DocumentCategoryType[] {
  return Object.entries(CATEGORY_ATTRIBUTES)
    .filter(([_, attributes]) => attributes.potentiallySensitive)
    .map(([category]) => category as DocumentCategoryType);
}

/**
 * Get categories that require approval
 */
export function getApprovalRequiredCategories(): DocumentCategoryType[] {
  return Object.entries(CATEGORY_ATTRIBUTES)
    .filter(([_, attributes]) => attributes.requiresApproval)
    .map(([category]) => category as DocumentCategoryType);
}

/**
 * Get high priority categories for routing
 */
export function getHighPriorityCategories(): DocumentCategoryType[] {
  return Object.entries(CATEGORY_ATTRIBUTES)
    .filter(([_, attributes]) => attributes.routingPriority <= 2)
    .map(([category]) => category as DocumentCategoryType);
}

/**
 * Get category attributes for a specific category
 */
export function getCategoryAttributes(category: DocumentCategoryType): CategoryAttributes {
  return CATEGORY_ATTRIBUTES[category];
}

/**
 * Find categories that match a set of keywords
 */
export function findCategoriesByKeywords(keywords: string[]): DocumentCategoryType[] {
  const normalizedKeywords = keywords.map(k => k.toLowerCase().trim());
  
  return Object.entries(CATEGORY_ATTRIBUTES)
    .filter(([_, attributes]) => {
      return attributes.associatedKeywords.some(keyword => 
        normalizedKeywords.some(nk => nk.includes(keyword) || keyword.includes(nk))
      );
    })
    .map(([category]) => category as DocumentCategoryType);
}

/**
 * Determine if a text likely belongs to a specific category
 */
export function detectCategoryFromText(text: string): DocumentCategoryType[] {
  const normalizedText = text.toLowerCase();
  
  // Calculate "score" for each category based on keyword matches
  const scores = Object.entries(CATEGORY_ATTRIBUTES).map(([category, attributes]) => {
    const matchCount = attributes.associatedKeywords.filter(keyword => 
      normalizedText.includes(keyword.toLowerCase())
    ).length;
    
    // Calculate score based on number of matches and keyword length (longer = more specific)
    const score = attributes.associatedKeywords.reduce((total, keyword) => {
      if (normalizedText.includes(keyword.toLowerCase())) {
        return total + keyword.length;
      }
      return total;
    }, 0);
    
    return { 
      category: category as DocumentCategoryType, 
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
export enum QualityControlFlag {
  APPROVED = 'approved',
  PENDING_REVIEW = 'pending_review',
  NEEDS_CLARIFICATION = 'needs_clarification',
  CONTAINS_CONTRADICTIONS = 'contains_contradictions',
  OUTDATED = 'outdated',
  UNRELIABLE_SOURCE = 'unreliable_source'
}

/**
 * Determines if a flag requires human review
 */
export function requiresHumanReview(flag: QualityControlFlag): boolean {
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
export enum ConfidenceLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  UNCERTAIN = 'uncertain'
}

/**
 * Entity types that can be extracted from documents
 */
export enum EntityType {
  PERSON = 'person',
  ORGANIZATION = 'organization',
  PRODUCT = 'product',
  FEATURE = 'feature',
  PRICE = 'price',
  DATE = 'date',
  LOCATION = 'location'
} 
/**
 * Tag Utilities
 * 
 * Provides standardized functions for handling tags, categories, and search filters
 * across the application.
 * 
 * IMPORTANT: All components that handle document tags, categories, or keywords should use 
 * these utility functions to ensure consistency across the platform. This includes:
 * 
 * - Admin interfaces (PendingDocuments, DocumentManagement)
 * - Search functionality (hybridSearch)
 * - API endpoints that process document metadata
 * 
 * Using these utilities ensures that tags are consistently normalized, deduplicated,
 * and properly formatted, which improves search accuracy and user experience.
 */

import { Tag } from '@/types/tags';
import { HybridSearchFilter } from './hybridSearch';
import { DocumentCategoryType } from './documentCategories'; // Import the enum

/**
 * Standardized category options for use across all components
 * IMPORTANT: This is the central source of truth for all category options
 */
export const STANDARD_CATEGORIES = [
  // Primary Categories (Based on User Input)
  { value: 'HIRING', label: 'Hiring' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'HR_MANAGEMENT', label: 'HR Management' },
  { value: 'PAYROLL', label: 'Payroll' },
  { value: 'COMPLIANCE', label: 'Compliance' }, 
  { value: 'SCHEDULING', label: 'Scheduling' }, // Note: Merged Time & Scheduling
  { value: 'RETENTION', label: 'Employee Retention' },
  { value: 'OPTIMIZATION', label: 'Workforce Optimization' },
  { value: 'AUTOMATION', label: 'Automation' },
  { value: 'AI_TOOLS', label: 'AI-Powered Tools' },
  { value: 'JOB_POSTING', label: 'Job Posting' },
  { value: 'CANDIDATE_SCREENING', label: 'Candidate Screening' },
  { value: 'INTERVIEW_SCHEDULING', label: 'Interview Scheduling' },
  { value: 'REPORTING', label: 'Reporting & Analytics' },
  { value: 'MOBILE_SOLUTIONS', label: 'Mobile-Friendly Solutions' },
  { value: 'DOCUMENTS', label: 'Document Management' },
  { value: 'TIME_TRACKING', label: 'Time Tracking' },
  { value: 'TAX_COMPLIANCE', label: 'Tax Forms & Compliance' }, // e.g., WOTC, I-9
  { value: 'ENGAGEMENT', label: 'Employee Engagement' },
  { value: 'SECURITY_PRIVACY', label: 'Security & Privacy' },

  // Secondary Categories (Based on User Input)
  { value: 'TEXT_TO_APPLY', label: 'Text-to-Apply Features' },
  { value: 'TWO_WAY_SMS', label: 'Two-Way SMS Communication' },
  { value: 'BACKGROUND_CHECKS', label: 'Background Checks Integration' },
  { value: 'SHIFT_MANAGEMENT', label: 'Shift Management Tools' },
  { value: 'DIGITAL_SIGNATURES', label: 'Digital Signatures Collection' },
  { value: 'CUSTOMIZABLE_TEMPLATES', label: 'Customizable Templates' }, // e.g., Offer Letters
  { value: 'FRANCHISE_MANAGEMENT', label: 'Franchise Management Solutions' },
  { value: 'SMALL_BUSINESS_TOOLS', label: 'Small Business Hiring Tools' },
  { value: 'REMOTE_WORKFORCE', label: 'Remote Workforce Management' },
  { value: 'DESKLESS_WORKFORCE', label: 'Deskless Workforce Solutions' },
  { value: 'DIVERSITY_INCLUSION', label: 'Diversity and Inclusion Initiatives' },
  { value: 'TEAM_COLLABORATION', label: 'Team Collaboration Tools' },
  { value: 'CROSS_DEPT_COORDINATION', label: 'Cross-Department Coordination' },
  { value: 'LEADERSHIP_DEV', label: 'Leadership Development Resources' },
  { value: 'SCALABILITY', label: 'Scalability for Growing Businesses' },
  { value: 'TRAINING_MODULES', label: 'Training Programs & Development Modules' },
  { value: 'PERFORMANCE_TRACKING', label: 'Performance Metrics Tracking (KPIs)' },
  { value: 'CUSTOMER_SUPPORT_INTEGRATION', label: 'Customer Support Integration' }, // e.g., Zendesk
  { value: 'JOB_BOARD_INTEGRATIONS', label: 'Job Board Integrations' }, // e.g., Indeed, ZipRecruiter
  { value: 'CALENDAR_INTEGRATIONS', label: 'Calendar Integrations' }, // e.g., Google Calendar

  // Foundational / Other
  { value: 'GENERAL', label: 'General / Other' } // Catch-all
];

/**
 * Helper function to get category display label from value
 */
export function getCategoryLabel(value: string): string {
  const category = STANDARD_CATEGORIES.find(cat => cat.value === value);
  return category ? category.label : value;
}

/**
 * Helper function to get category options for filtering
 * Includes an "All Categories" option at the beginning
 */
export function getCategoryFilterOptions() {
  return [
    { value: 'all', label: 'All Categories' },
    ...STANDARD_CATEGORIES
  ];
}

/**
 * Standard document metadata structure that all components should use
 */
export interface StandardDocumentMetadata {
  primaryCategory?: string; // Keep as string here if source data might not be enum yet
  secondaryCategories?: string[]; // Keep as string here if source data might not be enum yet
  technicalLevel?: number;
  keywords?: string[];
  entities?: { name: string; type: string }[];
  summary?: string;
  [key: string]: any; // For extensibility
}

/**
 * Standardized search filter structure that all components should use
 */
export interface StandardSearchFilter {
  // Categories - Use the DocumentCategoryType enum now
  primaryCategory?: DocumentCategoryType;
  secondaryCategories?: DocumentCategoryType[];
  
  // Technical level
  technicalLevelMin?: number;
  technicalLevelMax?: number;
  
  // Keywords and entities
  keywords?: string[];
  entities?: { type: string, names: string[] }[];
  
  // Other filters
  lastUpdatedAfter?: string;
  customFilters?: Record<string, any>;
}

/**
 * Convert standard search filter to HybridSearchFilter used by the search system
 */
export function toHybridSearchFilter(filter: StandardSearchFilter): HybridSearchFilter {
  const hybridFilter: HybridSearchFilter = {};
  
  // Handle categories - No type error should occur now
  if (filter.primaryCategory || (filter.secondaryCategories && filter.secondaryCategories.length > 0)) {
    hybridFilter.primaryCategory = filter.primaryCategory;
    hybridFilter.secondaryCategories = filter.secondaryCategories;
  }
  
  // Handle technical level
  if (filter.technicalLevelMin !== undefined) {
    hybridFilter.technicalLevelMin = filter.technicalLevelMin;
  }
  if (filter.technicalLevelMax !== undefined) {
    hybridFilter.technicalLevelMax = filter.technicalLevelMax;
  }
  
  // Handle keywords
  if (filter.keywords && filter.keywords.length > 0) {
    hybridFilter.keywords = filter.keywords;
  }
  
  // Handle entities
  if (filter.entities && filter.entities.length > 0) {
    // Convert entities to required entities format
    const requiredEntities = filter.entities.flatMap(
      entityGroup => entityGroup.names.map(name => `${entityGroup.type}:${name}`)
    );
    
    if (requiredEntities.length > 0) {
      hybridFilter.requiredEntities = requiredEntities;
    }
  }
  
  // Handle custom filters
  if (filter.customFilters) {
    hybridFilter.customFilters = filter.customFilters;
  }
  
  return hybridFilter;
}

/**
 * Normalize tags/keywords - handles whitespace, duplicate removal, and sorting
 */
export function normalizeTags(tags: string[]): string[] {
  // Remove empty tags, trim whitespace, convert to lowercase for consistency
  const normalizedTags = tags
    .filter(tag => tag && tag.trim() !== '')
    .map(tag => tag.trim().toLowerCase());
  
  // Remove duplicates and sort alphabetically
  return [...new Set(normalizedTags)].sort();
}

/**
 * Parse comma-separated tag input into an array of tags
 */
export function parseTagInput(input: string): string[] {
  if (!input || input.trim() === '') {
    return [];
  }
  
  // Split by commas and normalize
  const tags = input.split(',');
  return normalizeTags(tags);
}

/**
 * Extract metadata in a standardized format from a document object
 */
export function extractStandardMetadata(document: any): StandardDocumentMetadata {
  // Handle both direct properties and metadata sub-object
  const metadata = document.metadata || {};
  
  return {
    primaryCategory: metadata.primaryCategory || document.primaryCategory || '',
    secondaryCategories: metadata.secondaryCategories || document.secondaryCategories || [],
    technicalLevel: metadata.technicalLevel || document.technicalLevel || 5,
    keywords: metadata.keywords || document.keywords || [],
    entities: metadata.entities || document.entities || [],
    summary: metadata.summary || document.summary || '',
  };
}

/**
 * Extract tags from search results
 * @param results Array of search results, each potentially containing metadata with tags
 * @returns Object containing arrays of topic tags, audience tags, entity tags, and technical level tags
 */
export function extractTagsFromResults(results: any[]): {
  topicTags: Tag[];
  audienceTags: Tag[];
  entityTags: Tag[];
  technicalTags: Tag[];
} {
  const topicSet = new Map<string, number>();
  const audienceSet = new Map<string, number>();
  const entitySet = new Map<string, number>();
  const technicalSet = new Map<string, number>();
  
  // Process each result to extract tags
  results.forEach(result => {
    const metadata = result.metadata || {};
    const item = result.item || result;
    const itemMetadata = item.metadata || {};
    
    // Combine metadata from both levels (if nested)
    const combinedMetadata = { ...metadata, ...itemMetadata };
    
    // Extract topics
    const topics = getTopicsFromMetadata(combinedMetadata);
    topics.forEach(topic => {
      topicSet.set(topic, (topicSet.get(topic) || 0) + 1);
    });
    
    // Extract audience types
    const audience = getAudienceFromMetadata(combinedMetadata);
    audience.forEach(type => {
      audienceSet.set(type, (audienceSet.get(type) || 0) + 1);
    });
    
    // Extract entities
    const entities = getEntitiesFromMetadata(combinedMetadata);
    entities.forEach(entity => {
      entitySet.set(entity, (entitySet.get(entity) || 0) + 1);
    });
    
    // Extract technical level
    const technicalLevel = getTechnicalLevelFromMetadata(combinedMetadata);
    if (technicalLevel) {
      const levelLabel = getLevelLabel(technicalLevel);
      technicalSet.set(levelLabel, (technicalSet.get(levelLabel) || 0) + 1);
    }
  });
  
  // Convert to Tag arrays
  const topicTags: Tag[] = Array.from(topicSet.entries()).map(([value, count]) => ({
    value,
    count,
    type: 'topic'
  }));
  
  const audienceTags: Tag[] = Array.from(audienceSet.entries()).map(([value, count]) => ({
    value,
    count,
    type: 'audience'
  }));
  
  const entityTags: Tag[] = Array.from(entitySet.entries()).map(([value, count]) => ({
    value,
    count,
    type: 'entity'
  }));
  
  const technicalTags: Tag[] = Array.from(technicalSet.entries()).map(([value, count]) => ({
    value,
    count,
    type: 'technical'
  }));
  
  return {
    topicTags: sortTagsByCount(topicTags),
    audienceTags: sortTagsByCount(audienceTags),
    entityTags: sortTagsByCount(entityTags),
    technicalTags: sortTagsByCount(technicalTags)
  };
}

/**
 * Sort tags by count in descending order
 */
function sortTagsByCount(tags: Tag[]): Tag[] {
  return [...tags].sort((a, b) => (b.count || 0) - (a.count || 0));
}

/**
 * Get topic tags from metadata
 */
export function getTopicsFromMetadata(metadata: Record<string, any>): string[] {
  let topics: string[] = [];
  
  // Look for topics in various possible fields
  if (Array.isArray(metadata.tags)) {
    topics = topics.concat(metadata.tags);
  }
  
  if (Array.isArray(metadata.primary_topics)) {
    topics = topics.concat(metadata.primary_topics);
  }
  
  if (Array.isArray(metadata.topics)) {
    topics = topics.concat(metadata.topics);
  }
  
  if (metadata.context && Array.isArray(metadata.context.topics)) {
    topics = topics.concat(metadata.context.topics);
  }
  
  // Deduplicate
  return [...new Set(topics)];
}

/**
 * Get audience tags from metadata
 */
export function getAudienceFromMetadata(metadata: Record<string, any>): string[] {
  let audience: string[] = [];
  
  // Look for audience in various possible fields
  if (Array.isArray(metadata.audience)) {
    audience = audience.concat(metadata.audience);
  }
  
  if (Array.isArray(metadata.audience_type)) {
    audience = audience.concat(metadata.audience_type);
  }
  
  if (metadata.context && Array.isArray(metadata.context.audience)) {
    audience = audience.concat(metadata.context.audience);
  }
  
  // Deduplicate
  return [...new Set(audience)];
}

/**
 * Get entity tags from metadata
 */
export function getEntitiesFromMetadata(metadata: Record<string, any>): string[] {
  let entities: string[] = [];
  
  // Handle different entity storage formats
  if (metadata.entities) {
    if (Array.isArray(metadata.entities)) {
      entities = entities.concat(metadata.entities);
    } else if (typeof metadata.entities === 'object') {
      // Handle the entity_0, entity_1 format
      Object.values(metadata.entities).forEach(value => {
        if (typeof value === 'string') {
          entities.push(value);
        }
      });
    }
  }
  
  if (metadata.context && Array.isArray(metadata.context.entities)) {
    entities = entities.concat(metadata.context.entities);
  }
  
  // Deduplicate
  return [...new Set(entities)];
}

/**
 * Get technical level from metadata
 */
export function getTechnicalLevelFromMetadata(metadata: Record<string, any>): number | null {
  // Look for technical level in various possible fields
  const level = metadata.technical_level || 
                (metadata.context ? metadata.context.technical_level : null);
  
  if (typeof level === 'number') {
    return level;
  }
  
  return null;
}

/**
 * Convert technical level number to a readable label
 */
export function getLevelLabel(level: number): string {
  switch (level) {
    case 1:
      return 'Beginner';
    case 2:
      return 'Intermediate';
    case 3:
      return 'Advanced';
    default:
      return `Level ${level}`;
  }
}

/**
 * Filter search results based on selected tags
 */
export function filterResultsByTags(results: any[], selectedTags: string[]): any[] {
  if (!selectedTags.length) {
    return results;
  }
  
  return results.filter(result => {
    const metadata = result.metadata || {};
    const item = result.item || result;
    const itemMetadata = item.metadata || {};
    
    // Combine metadata from both levels (if nested)
    const combinedMetadata = { ...metadata, ...itemMetadata };
    
    // Extract all tags from this result
    const topics = getTopicsFromMetadata(combinedMetadata);
    const audience = getAudienceFromMetadata(combinedMetadata);
    const entities = getEntitiesFromMetadata(combinedMetadata);
    const technicalLevel = getTechnicalLevelFromMetadata(combinedMetadata);
    const technicalTag = technicalLevel ? getLevelLabel(technicalLevel) : null;
    
    // Check if any selected tag is in any of these categories
    return selectedTags.some(tag => 
      topics.includes(tag) || 
      audience.includes(tag) || 
      entities.includes(tag) || 
      (technicalTag && technicalTag === tag)
    );
  });
}

/**
 * Find tags that match the user's query
 */
export function findTagsInQuery(query: string, availableTags: Tag[]): string[] {
  const lowerQuery = query.toLowerCase();
  const queryWords = lowerQuery.split(/\s+/).filter(word => word.length > 2);
  
  return availableTags
    .filter(tag => {
      const lowerTag = tag.value.toLowerCase();
      // Check for exact match
      if (lowerQuery.includes(lowerTag)) return true;
      
      // Check for word matches
      return queryWords.some(word => lowerTag.includes(word) || word.includes(lowerTag));
    })
    .map(tag => tag.value);
}

/**
 * Parse explicit tag filters from query
 * Example: "topic:recruitment entity:Workstream"
 */
export function parseTagFiltersFromQuery(query: string): { 
  cleanQuery: string; 
  tagFilters: string[]; 
} {
  const tagFilterPattern = /(topic|entity|audience|level):([a-zA-Z0-9_\-]+)/g;
  const tagFilters: string[] = [];
  
  // Find all tag filters
  const matches = [...query.matchAll(tagFilterPattern)];
  
  // Extract tag values
  matches.forEach(match => {
    const tagValue = match[2];
    if (tagValue) {
      tagFilters.push(tagValue);
    }
  });
  
  // Remove tag filters from query
  const cleanQuery = query.replace(tagFilterPattern, '').trim();
  
  return { cleanQuery, tagFilters };
} 
import { Tag } from '@/types/tags';

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
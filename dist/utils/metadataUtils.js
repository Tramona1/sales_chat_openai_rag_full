/**
 * Metadata Utilities
 *
 * This module provides utility functions for handling metadata consistently,
 * especially for serializing and deserializing entities between storage and usage.
 */
import { EntityType, ConfidenceLevel } from './documentCategories';
/**
 * Parse entities from a vector store item's metadata
 * Handles both string and object representations
 *
 * @param entities The entities value from metadata.entities (could be string or object)
 * @returns Parsed array of ExtractedEntity objects, or empty array if invalid
 */
export function parseEntities(entities) {
    try {
        // If it's undefined or null, return empty array
        if (!entities) {
            return [];
        }
        // If it's already an array, return it
        if (Array.isArray(entities)) {
            return entities;
        }
        // If it's a string, try to parse it as JSON
        if (typeof entities === 'string') {
            try {
                const parsed = JSON.parse(entities);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
                else {
                    // If parsed but not an array, it might be an older format
                    // with nested properties like { people: [], companies: [] }
                    const extractedEntities = [];
                    // Handle older format with categorized entities
                    if (parsed.people && Array.isArray(parsed.people)) {
                        parsed.people.forEach((person) => {
                            if (typeof person === 'string') {
                                extractedEntities.push({
                                    name: person,
                                    type: EntityType.PERSON,
                                    confidence: ConfidenceLevel.MEDIUM,
                                    mentions: 1
                                });
                            }
                            else if (person && typeof person === 'object' && person.name) {
                                extractedEntities.push({
                                    name: person.name,
                                    type: EntityType.PERSON,
                                    confidence: person.confidence || ConfidenceLevel.MEDIUM,
                                    mentions: person.mentions || 1
                                });
                            }
                        });
                    }
                    if (parsed.companies && Array.isArray(parsed.companies)) {
                        parsed.companies.forEach((company) => {
                            if (typeof company === 'string') {
                                extractedEntities.push({
                                    name: company,
                                    type: EntityType.ORGANIZATION,
                                    confidence: ConfidenceLevel.MEDIUM,
                                    mentions: 1
                                });
                            }
                            else if (company && typeof company === 'object' && company.name) {
                                extractedEntities.push({
                                    name: company.name,
                                    type: EntityType.ORGANIZATION,
                                    confidence: company.confidence || ConfidenceLevel.MEDIUM,
                                    mentions: company.mentions || 1
                                });
                            }
                        });
                    }
                    if (parsed.products && Array.isArray(parsed.products)) {
                        parsed.products.forEach((product) => {
                            if (typeof product === 'string') {
                                extractedEntities.push({
                                    name: product,
                                    type: EntityType.PRODUCT,
                                    confidence: ConfidenceLevel.MEDIUM,
                                    mentions: 1
                                });
                            }
                            else if (product && typeof product === 'object' && product.name) {
                                extractedEntities.push({
                                    name: product.name,
                                    type: EntityType.PRODUCT,
                                    confidence: product.confidence || ConfidenceLevel.MEDIUM,
                                    mentions: product.mentions || 1
                                });
                            }
                        });
                    }
                    return extractedEntities;
                }
            }
            catch (e) {
                console.error('Error parsing entities string:', e);
                return [];
            }
        }
        // If we get here, the format is unknown
        console.warn('Unknown entity format:', entities);
        return [];
    }
    catch (error) {
        console.error('Failed to parse entities:', error);
        return [];
    }
}
/**
 * Serialize entities to a consistent format for storage
 *
 * @param entities Array of ExtractedEntity objects
 * @returns JSON string representation of entities
 */
export function serializeEntities(entities) {
    if (!entities || entities.length === 0) {
        return undefined;
    }
    try {
        return JSON.stringify(entities);
    }
    catch (error) {
        console.error('Failed to serialize entities:', error);
        return undefined;
    }
}
/**
 * Get a count of entity types from an array of entities
 *
 * @param entities Array of ExtractedEntity objects
 * @returns Record with counts by entity type
 */
export function getEntityTypeCounts(entities) {
    const counts = {};
    if (!entities || entities.length === 0) {
        return counts;
    }
    entities.forEach(entity => {
        const type = entity.type || 'UNKNOWN';
        counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
}

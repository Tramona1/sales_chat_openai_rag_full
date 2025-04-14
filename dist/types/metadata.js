/**
 * Enhanced Metadata Types
 *
 * This module defines the enhanced metadata structure for documents
 * to support smart ingestion and query routing.
 */
import { DocumentCategoryType, QualityControlFlag as ImportedQualityFlag, ConfidenceLevel as ImportedConfidenceLevel } from '../utils/documentCategories';
/**
 * Create default enhanced metadata
 */
export function createDefaultMetadata(source) {
    return {
        source,
        primaryCategory: DocumentCategoryType.GENERAL,
        secondaryCategories: [],
        confidenceScore: 0,
        summary: '',
        keyTopics: [],
        technicalLevel: 5, // Default technical level (mid-range on 1-10 scale)
        keywords: [],
        entities: [],
        qualityFlags: [ImportedQualityFlag.PENDING_REVIEW],
        approved: false,
        routingPriority: 5
    };
}
/**
 * Check if metadata needs manual review
 */
export function needsManualReview(metadata) {
    // Check for quality flags that require review
    const hasReviewFlag = metadata.qualityFlags.some(flag => flag === ImportedQualityFlag.PENDING_REVIEW ||
        flag === ImportedQualityFlag.NEEDS_CLARIFICATION ||
        flag === ImportedQualityFlag.CONTAINS_CONTRADICTIONS ||
        flag === ImportedQualityFlag.UNRELIABLE_SOURCE ||
        flag === ImportedQualityFlag.OUTDATED ||
        flag === ImportedQualityFlag.OUTDATED_CONTENT ||
        flag === ImportedQualityFlag.INCOMPLETE_CONTENT);
    // Check for low confidence score
    const hasLowConfidence = metadata.confidenceScore < 0.7;
    // Check for sensitive categories based on the updated list from CATEGORY_ATTRIBUTES
    const sensitiveCategories = [
        DocumentCategoryType.PAYROLL,
        DocumentCategoryType.COMPLIANCE,
        DocumentCategoryType.TAX_COMPLIANCE,
        DocumentCategoryType.SECURITY_PRIVACY,
        DocumentCategoryType.HR_MANAGEMENT, // Often contains sensitive employee data
        DocumentCategoryType.DOCUMENTS, // Can contain sensitive contracts/info
        DocumentCategoryType.BACKGROUND_CHECKS,
        DocumentCategoryType.DIGITAL_SIGNATURES,
        DocumentCategoryType.PERFORMANCE_TRACKING // Performance data is sensitive
        // Add others if CATEGORY_ATTRIBUTES defines them as potentiallySensitive
    ];
    const hasSensitiveCategory = sensitiveCategories.includes(metadata.primaryCategory);
    return hasReviewFlag || (hasLowConfidence && hasSensitiveCategory);
}
/**
 * Merge metadata from multiple chunks of the same document
 */
export function mergeMetadata(metadataList) {
    if (metadataList.length === 0) {
        throw new Error('Cannot merge empty metadata list');
    }
    if (metadataList.length === 1) {
        return metadataList[0];
    }
    // Use the metadata from the first chunk as the base
    const baseMetadata = { ...metadataList[0] };
    // Count category occurrences to find the most common one
    const categoryCount = {};
    // Collect all secondary categories
    const allSecondaryCategories = new Set();
    // Collect all entities and keywords
    const entitiesMap = new Map();
    const keywordsSet = new Set();
    const topicsSet = new Set();
    // Collect all quality flags
    const qualityFlagsSet = new Set();
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
                const existing = entitiesMap.get(key);
                existing.mentions += entity.mentions;
                // Upgrade confidence if new entity has higher confidence
                if (confidenceLevelValue(entity.confidence) > confidenceLevelValue(existing.confidence)) {
                    existing.confidence = entity.confidence;
                }
            }
            else {
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
            mostCommonCategory = category;
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
function confidenceLevelValue(level) {
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

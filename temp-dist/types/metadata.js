"use strict";
/**
 * Enhanced Metadata Types
 *
 * This module defines the enhanced metadata structure for documents
 * to support smart ingestion and query routing.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultMetadata = createDefaultMetadata;
exports.needsManualReview = needsManualReview;
exports.mergeMetadata = mergeMetadata;
var documentCategories_1 = require("../utils/documentCategories");
/**
 * Create default enhanced metadata
 */
function createDefaultMetadata(source) {
    return {
        source: source,
        primaryCategory: documentCategories_1.DocumentCategoryType.GENERAL,
        secondaryCategories: [],
        confidenceScore: 0,
        summary: '',
        keyTopics: [],
        technicalLevel: 5, // Default technical level (mid-range on 1-10 scale)
        keywords: [],
        entities: [],
        qualityFlags: [documentCategories_1.QualityControlFlag.PENDING_REVIEW],
        approved: false,
        routingPriority: 5
    };
}
/**
 * Check if metadata needs manual review
 */
function needsManualReview(metadata) {
    // Check for quality flags that require review
    var hasReviewFlag = metadata.qualityFlags.some(function (flag) {
        return flag === documentCategories_1.QualityControlFlag.PENDING_REVIEW ||
            flag === documentCategories_1.QualityControlFlag.NEEDS_CLARIFICATION ||
            flag === documentCategories_1.QualityControlFlag.CONTAINS_CONTRADICTIONS ||
            flag === documentCategories_1.QualityControlFlag.UNRELIABLE_SOURCE ||
            flag === documentCategories_1.QualityControlFlag.OUTDATED ||
            flag === documentCategories_1.QualityControlFlag.OUTDATED_CONTENT ||
            flag === documentCategories_1.QualityControlFlag.INCOMPLETE_CONTENT;
    });
    // Check for low confidence score
    var hasLowConfidence = metadata.confidenceScore < 0.7;
    // Check for sensitive categories based on the updated list from CATEGORY_ATTRIBUTES
    var sensitiveCategories = [
        documentCategories_1.DocumentCategoryType.PAYROLL,
        documentCategories_1.DocumentCategoryType.COMPLIANCE,
        documentCategories_1.DocumentCategoryType.TAX_COMPLIANCE,
        documentCategories_1.DocumentCategoryType.SECURITY_PRIVACY,
        documentCategories_1.DocumentCategoryType.HR_MANAGEMENT, // Often contains sensitive employee data
        documentCategories_1.DocumentCategoryType.DOCUMENTS, // Can contain sensitive contracts/info
        documentCategories_1.DocumentCategoryType.BACKGROUND_CHECKS,
        documentCategories_1.DocumentCategoryType.DIGITAL_SIGNATURES,
        documentCategories_1.DocumentCategoryType.PERFORMANCE_TRACKING // Performance data is sensitive
        // Add others if CATEGORY_ATTRIBUTES defines them as potentiallySensitive
    ];
    var hasSensitiveCategory = sensitiveCategories.includes(metadata.primaryCategory);
    return hasReviewFlag || (hasLowConfidence && hasSensitiveCategory);
}
/**
 * Merge metadata from multiple chunks of the same document
 */
function mergeMetadata(metadataList) {
    if (metadataList.length === 0) {
        throw new Error('Cannot merge empty metadata list');
    }
    if (metadataList.length === 1) {
        return metadataList[0];
    }
    // Use the metadata from the first chunk as the base
    var baseMetadata = __assign({}, metadataList[0]);
    // Count category occurrences to find the most common one
    var categoryCount = {};
    // Collect all secondary categories
    var allSecondaryCategories = new Set();
    // Collect all entities and keywords
    var entitiesMap = new Map();
    var keywordsSet = new Set();
    var topicsSet = new Set();
    // Collect all quality flags
    var qualityFlagsSet = new Set();
    // Calculate average confidence score and technical level
    var totalConfidenceScore = 0;
    var totalTechnicalLevel = 0;
    // Process each metadata item
    metadataList.forEach(function (metadata) {
        // Count primary category occurrences
        var primaryCat = metadata.primaryCategory;
        categoryCount[primaryCat] = (categoryCount[primaryCat] || 0) + 1;
        // Add secondary categories to set
        metadata.secondaryCategories.forEach(function (cat) {
            // Also count secondary categories (with lower weight)
            categoryCount[cat] = (categoryCount[cat] || 0) + 0.5;
            allSecondaryCategories.add(cat);
        });
        // Add entities to map, updating mentions count
        metadata.entities.forEach(function (entity) {
            var key = "".concat(entity.type, ":").concat(entity.name);
            if (entitiesMap.has(key)) {
                var existing = entitiesMap.get(key);
                existing.mentions += entity.mentions;
                // Upgrade confidence if new entity has higher confidence
                if (confidenceLevelValue(entity.confidence) > confidenceLevelValue(existing.confidence)) {
                    existing.confidence = entity.confidence;
                }
            }
            else {
                entitiesMap.set(key, __assign({}, entity));
            }
        });
        // Add keywords and topics to sets
        metadata.keywords.forEach(function (keyword) { return keywordsSet.add(keyword); });
        metadata.keyTopics.forEach(function (topic) { return topicsSet.add(topic); });
        // Add quality flags to set
        metadata.qualityFlags.forEach(function (flag) { return qualityFlagsSet.add(flag); });
        // Add to confidence score and technical level totals
        totalConfidenceScore += metadata.confidenceScore;
        totalTechnicalLevel += metadata.technicalLevel;
    });
    // Find most common primary category
    var mostCommonCategory = baseMetadata.primaryCategory;
    var highestCount = 0;
    Object.entries(categoryCount).forEach(function (_a) {
        var category = _a[0], count = _a[1];
        if (count > highestCount) {
            highestCount = count;
            mostCommonCategory = category;
        }
    });
    // Remove most common category from secondary categories
    allSecondaryCategories.delete(mostCommonCategory);
    // Update the merged metadata
    return __assign(__assign({}, baseMetadata), { primaryCategory: mostCommonCategory, secondaryCategories: Array.from(allSecondaryCategories), confidenceScore: totalConfidenceScore / metadataList.length, technicalLevel: Math.round(totalTechnicalLevel / metadataList.length), keywords: Array.from(keywordsSet), keyTopics: Array.from(topicsSet), entities: Array.from(entitiesMap.values()), qualityFlags: Array.from(qualityFlagsSet), 
        // Don't merge approved status - if any chunk is not approved, the merged result is not approved
        approved: metadataList.every(function (metadata) { return metadata.approved; }) });
}
/**
 * Convert confidence level to numeric value for comparison
 */
function confidenceLevelValue(level) {
    switch (level) {
        case documentCategories_1.ConfidenceLevel.HIGH:
            return 3;
        case documentCategories_1.ConfidenceLevel.MEDIUM:
            return 2;
        case documentCategories_1.ConfidenceLevel.LOW:
            return 1;
        case documentCategories_1.ConfidenceLevel.UNCERTAIN:
        default:
            return 0;
    }
}

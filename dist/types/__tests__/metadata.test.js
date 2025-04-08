"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Unit tests for Enhanced Metadata Types
 */
const metadata_1 = require("../metadata");
const documentCategories_1 = require("../../utils/documentCategories");
describe('Enhanced Metadata Types', () => {
    describe('createDefaultMetadata', () => {
        test('creates metadata with expected default values', () => {
            const source = 'test-document.pdf';
            const metadata = (0, metadata_1.createDefaultMetadata)(source);
            expect(metadata.source).toBe(source);
            expect(metadata.primaryCategory).toBe(documentCategories_1.DocumentCategoryType.GENERAL);
            expect(metadata.secondaryCategories).toEqual([]);
            expect(metadata.confidenceScore).toBe(0);
            expect(metadata.summary).toBe('');
            expect(metadata.keyTopics).toEqual([]);
            expect(metadata.technicalLevel).toBe(1);
            expect(metadata.keywords).toEqual([]);
            expect(metadata.entities).toEqual([]);
            expect(metadata.qualityFlags).toContain(documentCategories_1.QualityControlFlag.PENDING_REVIEW);
            expect(metadata.approved).toBe(false);
            expect(metadata.routingPriority).toBe(5);
        });
    });
    describe('needsManualReview', () => {
        test('returns true for metadata with review flags', () => {
            const metadata = (0, metadata_1.createDefaultMetadata)('test.pdf');
            metadata.qualityFlags = [documentCategories_1.QualityControlFlag.PENDING_REVIEW];
            expect((0, metadata_1.needsManualReview)(metadata)).toBe(true);
        });
        test('returns true for sensitive categories with low confidence', () => {
            const metadata = (0, metadata_1.createDefaultMetadata)('test.pdf');
            metadata.qualityFlags = []; // No review flags
            metadata.primaryCategory = documentCategories_1.DocumentCategoryType.CUSTOMER;
            metadata.confidenceScore = 0.6; // Low confidence
            expect((0, metadata_1.needsManualReview)(metadata)).toBe(true);
        });
        test('returns false for non-sensitive categories with no review flags', () => {
            const metadata = (0, metadata_1.createDefaultMetadata)('test.pdf');
            metadata.qualityFlags = []; // No review flags
            metadata.primaryCategory = documentCategories_1.DocumentCategoryType.GENERAL;
            metadata.confidenceScore = 0.6; // Low confidence, but not sensitive
            expect((0, metadata_1.needsManualReview)(metadata)).toBe(false);
        });
        test('returns false for sensitive categories with high confidence and no review flags', () => {
            const metadata = (0, metadata_1.createDefaultMetadata)('test.pdf');
            metadata.qualityFlags = []; // No review flags
            metadata.primaryCategory = documentCategories_1.DocumentCategoryType.CUSTOMER;
            metadata.confidenceScore = 0.8; // High confidence
            expect((0, metadata_1.needsManualReview)(metadata)).toBe(false);
        });
    });
    describe('mergeMetadata', () => {
        // Helper function to create test metadata
        function createTestMetadata(source, category, secondaryCategories, confidenceScore, technicalLevel, entities = [], keywords = [], keyTopics = [], qualityFlags = [documentCategories_1.QualityControlFlag.PENDING_REVIEW], approved = false) {
            return {
                source,
                primaryCategory: category,
                secondaryCategories,
                confidenceScore,
                technicalLevel,
                entities,
                keywords,
                keyTopics,
                summary: '',
                qualityFlags,
                approved,
                routingPriority: 1
            };
        }
        test('returns the only item when list has single metadata', () => {
            const metadata = createTestMetadata('test.pdf', documentCategories_1.DocumentCategoryType.PRODUCT, [documentCategories_1.DocumentCategoryType.FEATURES], 0.8, 2);
            const result = (0, metadata_1.mergeMetadata)([metadata]);
            expect(result).toEqual(metadata);
        });
        test('throws error when list is empty', () => {
            expect(() => (0, metadata_1.mergeMetadata)([])).toThrow('Cannot merge empty metadata list');
        });
        test('merges multiple metadata items correctly', () => {
            const metadata1 = createTestMetadata('test.pdf', documentCategories_1.DocumentCategoryType.PRODUCT, [documentCategories_1.DocumentCategoryType.FEATURES], 0.8, 2, [
                { name: 'ProductX', type: documentCategories_1.EntityType.PRODUCT, confidence: documentCategories_1.ConfidenceLevel.HIGH, mentions: 2 }
            ], ['product', 'software'], ['cloud', 'saas'], [documentCategories_1.QualityControlFlag.APPROVED], true);
            const metadata2 = createTestMetadata('test.pdf', documentCategories_1.DocumentCategoryType.FEATURES, [documentCategories_1.DocumentCategoryType.PRODUCT, documentCategories_1.DocumentCategoryType.TECHNICAL], 0.9, 3, [
                { name: 'ProductX', type: documentCategories_1.EntityType.PRODUCT, confidence: documentCategories_1.ConfidenceLevel.MEDIUM, mentions: 3 },
                { name: 'Feature1', type: documentCategories_1.EntityType.FEATURE, confidence: documentCategories_1.ConfidenceLevel.HIGH, mentions: 1 }
            ], ['feature', 'capability'], ['functionality', 'tools'], [documentCategories_1.QualityControlFlag.PENDING_REVIEW], false);
            // Add a third metadata with FEATURES as primary to make it the most common category
            const metadata3 = createTestMetadata('test.pdf', documentCategories_1.DocumentCategoryType.FEATURES, [documentCategories_1.DocumentCategoryType.TECHNICAL], 0.85, 3, [
                { name: 'Feature2', type: documentCategories_1.EntityType.FEATURE, confidence: documentCategories_1.ConfidenceLevel.HIGH, mentions: 2 }
            ], ['function', 'api'], ['interface', 'endpoints'], [documentCategories_1.QualityControlFlag.PENDING_REVIEW], false);
            console.log('Test data - Primary categories:', {
                metadata1: metadata1.primaryCategory,
                metadata2: metadata2.primaryCategory,
                metadata3: metadata3.primaryCategory
            });
            const merged = (0, metadata_1.mergeMetadata)([metadata1, metadata2, metadata3]);
            console.log('Merged result - Primary category:', merged.primaryCategory);
            // Check that the most common category is used as primary
            expect(merged.primaryCategory).toBe(documentCategories_1.DocumentCategoryType.FEATURES);
            // Check that secondary categories include others without duplicates
            expect(merged.secondaryCategories).toContain(documentCategories_1.DocumentCategoryType.PRODUCT);
            expect(merged.secondaryCategories).toContain(documentCategories_1.DocumentCategoryType.TECHNICAL);
            expect(merged.secondaryCategories).not.toContain(documentCategories_1.DocumentCategoryType.FEATURES);
            // Check that confidence score is averaged
            expect(merged.confidenceScore).toBeCloseTo((0.8 + 0.9 + 0.85) / 3);
            // Check that technical level is rounded average
            expect(merged.technicalLevel).toBe(3); // (2 + 3 + 3) / 3 = 2.67, rounded to 3
            // Check that entities are merged with combined mentions
            expect(merged.entities.length).toBe(3);
            const productEntity = merged.entities.find(e => e.name === 'ProductX' && e.type === documentCategories_1.EntityType.PRODUCT);
            expect(productEntity).toBeDefined();
            expect(productEntity === null || productEntity === void 0 ? void 0 : productEntity.mentions).toBe(5); // 2 + 3
            expect(productEntity === null || productEntity === void 0 ? void 0 : productEntity.confidence).toBe(documentCategories_1.ConfidenceLevel.HIGH); // Higher confidence wins
            // Check that keywords are merged without duplicates
            expect(merged.keywords).toContain('product');
            expect(merged.keywords).toContain('software');
            expect(merged.keywords).toContain('feature');
            expect(merged.keywords).toContain('capability');
            // Check that key topics are merged without duplicates
            expect(merged.keyTopics).toContain('cloud');
            expect(merged.keyTopics).toContain('saas');
            expect(merged.keyTopics).toContain('functionality');
            expect(merged.keyTopics).toContain('tools');
            // Check that quality flags are merged without duplicates
            expect(merged.qualityFlags).toContain(documentCategories_1.QualityControlFlag.APPROVED);
            expect(merged.qualityFlags).toContain(documentCategories_1.QualityControlFlag.PENDING_REVIEW);
            // Check that approved is only true if all items are approved
            expect(merged.approved).toBe(false);
        });
        test('merges metadata and handles approved status correctly', () => {
            const metadata1 = createTestMetadata('test.pdf', documentCategories_1.DocumentCategoryType.PRODUCT, [], 0.8, 2, [], [], [], [documentCategories_1.QualityControlFlag.APPROVED], true);
            const metadata2 = createTestMetadata('test.pdf', documentCategories_1.DocumentCategoryType.PRODUCT, [], 0.9, 2, [], [], [], [documentCategories_1.QualityControlFlag.APPROVED], true);
            const merged = (0, metadata_1.mergeMetadata)([metadata1, metadata2]);
            // All items are approved, so merged should be approved
            expect(merged.approved).toBe(true);
            // Now add one that's not approved
            const metadata3 = createTestMetadata('test.pdf', documentCategories_1.DocumentCategoryType.PRODUCT, [], 0.7, 2, [], [], [], [documentCategories_1.QualityControlFlag.PENDING_REVIEW], false);
            const mergedWithUnapproved = (0, metadata_1.mergeMetadata)([metadata1, metadata2, metadata3]);
            // Not all items are approved, so merged should not be approved
            expect(mergedWithUnapproved.approved).toBe(false);
        });
    });
});

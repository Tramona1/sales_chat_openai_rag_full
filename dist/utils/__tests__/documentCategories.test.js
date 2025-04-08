"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Unit tests for Document Categories module
 */
const documentCategories_1 = require("../documentCategories");
describe('Document Categories Module', () => {
    describe('Category Lists', () => {
        test('getAllCategories returns all defined categories', () => {
            const allCategories = (0, documentCategories_1.getAllCategories)();
            expect(allCategories.length).toBe(Object.keys(documentCategories_1.DocumentCategoryType).length);
            // Verify that each value in DocumentCategoryType is included
            Object.values(documentCategories_1.DocumentCategoryType).forEach(category => {
                expect(allCategories).toContain(category);
            });
        });
        test('getSensitiveCategories returns only sensitive categories', () => {
            const sensitiveCategories = (0, documentCategories_1.getSensitiveCategories)();
            // Check each returned category is actually marked as sensitive
            sensitiveCategories.forEach(category => {
                expect(documentCategories_1.CATEGORY_ATTRIBUTES[category].potentiallySensitive).toBe(true);
            });
            // Check that all categories marked as sensitive are included
            const allSensitiveCategories = Object.entries(documentCategories_1.CATEGORY_ATTRIBUTES)
                .filter(([_, attrs]) => attrs.potentiallySensitive)
                .map(([cat]) => cat);
            expect(sensitiveCategories.length).toBe(allSensitiveCategories.length);
        });
        test('getApprovalRequiredCategories returns categories requiring approval', () => {
            const approvalCategories = (0, documentCategories_1.getApprovalRequiredCategories)();
            // Check each returned category actually requires approval
            approvalCategories.forEach(category => {
                expect(documentCategories_1.CATEGORY_ATTRIBUTES[category].requiresApproval).toBe(true);
            });
        });
        test('getHighPriorityCategories returns categories with priority <= 2', () => {
            const highPriorityCategories = (0, documentCategories_1.getHighPriorityCategories)();
            highPriorityCategories.forEach(category => {
                expect(documentCategories_1.CATEGORY_ATTRIBUTES[category].routingPriority).toBeLessThanOrEqual(2);
            });
        });
    });
    describe('Category Attributes', () => {
        test('getCategoryAttributes returns correct attributes for a category', () => {
            const attributes = (0, documentCategories_1.getCategoryAttributes)(documentCategories_1.DocumentCategoryType.CUSTOMER);
            expect(attributes).toBeDefined();
            expect(attributes.displayName).toBe('Customer Information');
            expect(attributes.potentiallySensitive).toBe(true);
            expect(attributes.requiresApproval).toBe(true);
        });
    });
    describe('Category Detection', () => {
        test('findCategoriesByKeywords returns matching categories', () => {
            const keywords = ['pricing', 'cost', 'subscription'];
            const categories = (0, documentCategories_1.findCategoriesByKeywords)(keywords);
            expect(categories).toContain(documentCategories_1.DocumentCategoryType.PRICING);
        });
        test('findCategoriesByKeywords handles partial matches', () => {
            const keywords = ['price', 'subscription plan'];
            const categories = (0, documentCategories_1.findCategoriesByKeywords)(keywords);
            expect(categories).toContain(documentCategories_1.DocumentCategoryType.PRICING);
        });
        test('detectCategoryFromText identifies the correct category from text', () => {
            const pricingText = 'Our pricing plans start at $10 per month for the basic subscription.';
            const categories = (0, documentCategories_1.detectCategoryFromText)(pricingText);
            expect(categories).toContain(documentCategories_1.DocumentCategoryType.PRICING);
        });
        test('detectCategoryFromText returns multiple relevant categories', () => {
            const mixedText = 'Our product features robust pricing plans tailored for enterprise customers.';
            const categories = (0, documentCategories_1.detectCategoryFromText)(mixedText);
            // Should detect product, features, pricing, and customer
            expect(categories.length).toBeGreaterThanOrEqual(2);
            // The categories should include at least some of these
            const expectedCategories = [
                documentCategories_1.DocumentCategoryType.PRODUCT,
                documentCategories_1.DocumentCategoryType.FEATURES,
                documentCategories_1.DocumentCategoryType.PRICING,
                documentCategories_1.DocumentCategoryType.CUSTOMER
            ];
            // At least 2 of the expected categories should be included
            const matchCount = categories.filter(c => expectedCategories.includes(c)).length;
            expect(matchCount).toBeGreaterThanOrEqual(2);
        });
        test('detectCategoryFromText returns GENERAL for unclassifiable text', () => {
            const generalText = 'XYZ 123 abc def ghi jkl mno pqr stu vwx yz.';
            const categories = (0, documentCategories_1.detectCategoryFromText)(generalText);
            console.log('Test case - Detected categories:', categories);
            console.log('Expected GENERAL (case-sensitive comparison):', documentCategories_1.DocumentCategoryType.GENERAL);
            console.log('Case insensitive check:', categories.map(c => c.toLowerCase()).includes(documentCategories_1.DocumentCategoryType.GENERAL.toLowerCase()));
            expect(categories).toContain(documentCategories_1.DocumentCategoryType.GENERAL);
            expect(categories.length).toBe(1);
        });
    });
    describe('Quality Control', () => {
        test('requiresHumanReview correctly identifies flags needing review', () => {
            expect((0, documentCategories_1.requiresHumanReview)(documentCategories_1.QualityControlFlag.PENDING_REVIEW)).toBe(true);
            expect((0, documentCategories_1.requiresHumanReview)(documentCategories_1.QualityControlFlag.NEEDS_CLARIFICATION)).toBe(true);
            expect((0, documentCategories_1.requiresHumanReview)(documentCategories_1.QualityControlFlag.CONTAINS_CONTRADICTIONS)).toBe(true);
            expect((0, documentCategories_1.requiresHumanReview)(documentCategories_1.QualityControlFlag.UNRELIABLE_SOURCE)).toBe(true);
            expect((0, documentCategories_1.requiresHumanReview)(documentCategories_1.QualityControlFlag.APPROVED)).toBe(false);
            expect((0, documentCategories_1.requiresHumanReview)(documentCategories_1.QualityControlFlag.OUTDATED)).toBe(false);
        });
    });
});

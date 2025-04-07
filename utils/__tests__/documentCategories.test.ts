/**
 * Unit tests for Document Categories module
 */
import {
  DocumentCategoryType,
  QualityControlFlag,
  ConfidenceLevel,
  EntityType,
  CATEGORY_ATTRIBUTES,
  getAllCategories,
  getSensitiveCategories,
  getApprovalRequiredCategories,
  getHighPriorityCategories,
  getCategoryAttributes,
  findCategoriesByKeywords,
  detectCategoryFromText,
  requiresHumanReview
} from '../documentCategories';

describe('Document Categories Module', () => {
  describe('Category Lists', () => {
    test('getAllCategories returns all defined categories', () => {
      const allCategories = getAllCategories();
      expect(allCategories.length).toBe(Object.keys(DocumentCategoryType).length);
      
      // Verify that each value in DocumentCategoryType is included
      Object.values(DocumentCategoryType).forEach(category => {
        expect(allCategories).toContain(category);
      });
    });
    
    test('getSensitiveCategories returns only sensitive categories', () => {
      const sensitiveCategories = getSensitiveCategories();
      
      // Check each returned category is actually marked as sensitive
      sensitiveCategories.forEach(category => {
        expect(CATEGORY_ATTRIBUTES[category].potentiallySensitive).toBe(true);
      });
      
      // Check that all categories marked as sensitive are included
      const allSensitiveCategories = Object.entries(CATEGORY_ATTRIBUTES)
        .filter(([_, attrs]) => attrs.potentiallySensitive)
        .map(([cat]) => cat as DocumentCategoryType);
        
      expect(sensitiveCategories.length).toBe(allSensitiveCategories.length);
    });
    
    test('getApprovalRequiredCategories returns categories requiring approval', () => {
      const approvalCategories = getApprovalRequiredCategories();
      
      // Check each returned category actually requires approval
      approvalCategories.forEach(category => {
        expect(CATEGORY_ATTRIBUTES[category].requiresApproval).toBe(true);
      });
    });
    
    test('getHighPriorityCategories returns categories with priority <= 2', () => {
      const highPriorityCategories = getHighPriorityCategories();
      
      highPriorityCategories.forEach(category => {
        expect(CATEGORY_ATTRIBUTES[category].routingPriority).toBeLessThanOrEqual(2);
      });
    });
  });
  
  describe('Category Attributes', () => {
    test('getCategoryAttributes returns correct attributes for a category', () => {
      const attributes = getCategoryAttributes(DocumentCategoryType.CUSTOMER);
      
      expect(attributes).toBeDefined();
      expect(attributes.displayName).toBe('Customer Information');
      expect(attributes.potentiallySensitive).toBe(true);
      expect(attributes.requiresApproval).toBe(true);
    });
  });
  
  describe('Category Detection', () => {
    test('findCategoriesByKeywords returns matching categories', () => {
      const keywords = ['pricing', 'cost', 'subscription'];
      const categories = findCategoriesByKeywords(keywords);
      
      expect(categories).toContain(DocumentCategoryType.PRICING);
    });
    
    test('findCategoriesByKeywords handles partial matches', () => {
      const keywords = ['price', 'subscription plan'];
      const categories = findCategoriesByKeywords(keywords);
      
      expect(categories).toContain(DocumentCategoryType.PRICING);
    });
    
    test('detectCategoryFromText identifies the correct category from text', () => {
      const pricingText = 'Our pricing plans start at $10 per month for the basic subscription.';
      const categories = detectCategoryFromText(pricingText);
      
      expect(categories).toContain(DocumentCategoryType.PRICING);
    });
    
    test('detectCategoryFromText returns multiple relevant categories', () => {
      const mixedText = 'Our product features robust pricing plans tailored for enterprise customers.';
      const categories = detectCategoryFromText(mixedText);
      
      // Should detect product, features, pricing, and customer
      expect(categories.length).toBeGreaterThanOrEqual(2);
      
      // The categories should include at least some of these
      const expectedCategories = [
        DocumentCategoryType.PRODUCT,
        DocumentCategoryType.FEATURES,
        DocumentCategoryType.PRICING,
        DocumentCategoryType.CUSTOMER
      ];
      
      // At least 2 of the expected categories should be included
      const matchCount = categories.filter(c => expectedCategories.includes(c)).length;
      expect(matchCount).toBeGreaterThanOrEqual(2);
    });
    
    test('detectCategoryFromText returns GENERAL for unclassifiable text', () => {
      const generalText = 'XYZ 123 abc def ghi jkl mno pqr stu vwx yz.';
      const categories = detectCategoryFromText(generalText);
      
      console.log('Test case - Detected categories:', categories);
      console.log('Expected GENERAL (case-sensitive comparison):', DocumentCategoryType.GENERAL);
      console.log('Case insensitive check:', categories.map(c => c.toLowerCase()).includes(DocumentCategoryType.GENERAL.toLowerCase()));
      
      expect(categories).toContain(DocumentCategoryType.GENERAL);
      expect(categories.length).toBe(1);
    });
  });
  
  describe('Quality Control', () => {
    test('requiresHumanReview correctly identifies flags needing review', () => {
      expect(requiresHumanReview(QualityControlFlag.PENDING_REVIEW)).toBe(true);
      expect(requiresHumanReview(QualityControlFlag.NEEDS_CLARIFICATION)).toBe(true);
      expect(requiresHumanReview(QualityControlFlag.CONTAINS_CONTRADICTIONS)).toBe(true);
      expect(requiresHumanReview(QualityControlFlag.UNRELIABLE_SOURCE)).toBe(true);
      
      expect(requiresHumanReview(QualityControlFlag.APPROVED)).toBe(false);
      expect(requiresHumanReview(QualityControlFlag.OUTDATED)).toBe(false);
    });
  });
}); 
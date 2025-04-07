/**
 * Unit tests for Enhanced Metadata Types
 */
import {
  EnhancedMetadata,
  createDefaultMetadata,
  needsManualReview,
  mergeMetadata,
  ExtractedEntity
} from '../metadata';
import {
  DocumentCategoryType,
  QualityControlFlag,
  ConfidenceLevel,
  EntityType
} from '../../utils/documentCategories';

describe('Enhanced Metadata Types', () => {
  describe('createDefaultMetadata', () => {
    test('creates metadata with expected default values', () => {
      const source = 'test-document.pdf';
      const metadata = createDefaultMetadata(source);
      
      expect(metadata.source).toBe(source);
      expect(metadata.primaryCategory).toBe(DocumentCategoryType.GENERAL);
      expect(metadata.secondaryCategories).toEqual([]);
      expect(metadata.confidenceScore).toBe(0);
      expect(metadata.summary).toBe('');
      expect(metadata.keyTopics).toEqual([]);
      expect(metadata.technicalLevel).toBe(1);
      expect(metadata.keywords).toEqual([]);
      expect(metadata.entities).toEqual([]);
      expect(metadata.qualityFlags).toContain(QualityControlFlag.PENDING_REVIEW);
      expect(metadata.approved).toBe(false);
      expect(metadata.routingPriority).toBe(5);
    });
  });
  
  describe('needsManualReview', () => {
    test('returns true for metadata with review flags', () => {
      const metadata = createDefaultMetadata('test.pdf');
      metadata.qualityFlags = [QualityControlFlag.PENDING_REVIEW];
      
      expect(needsManualReview(metadata)).toBe(true);
    });
    
    test('returns true for sensitive categories with low confidence', () => {
      const metadata = createDefaultMetadata('test.pdf');
      metadata.qualityFlags = []; // No review flags
      metadata.primaryCategory = DocumentCategoryType.CUSTOMER;
      metadata.confidenceScore = 0.6; // Low confidence
      
      expect(needsManualReview(metadata)).toBe(true);
    });
    
    test('returns false for non-sensitive categories with no review flags', () => {
      const metadata = createDefaultMetadata('test.pdf');
      metadata.qualityFlags = []; // No review flags
      metadata.primaryCategory = DocumentCategoryType.GENERAL;
      metadata.confidenceScore = 0.6; // Low confidence, but not sensitive
      
      expect(needsManualReview(metadata)).toBe(false);
    });
    
    test('returns false for sensitive categories with high confidence and no review flags', () => {
      const metadata = createDefaultMetadata('test.pdf');
      metadata.qualityFlags = []; // No review flags
      metadata.primaryCategory = DocumentCategoryType.CUSTOMER;
      metadata.confidenceScore = 0.8; // High confidence
      
      expect(needsManualReview(metadata)).toBe(false);
    });
  });
  
  describe('mergeMetadata', () => {
    // Helper function to create test metadata
    function createTestMetadata(
      source: string,
      category: DocumentCategoryType,
      secondaryCategories: DocumentCategoryType[],
      confidenceScore: number,
      technicalLevel: number,
      entities: ExtractedEntity[] = [],
      keywords: string[] = [],
      keyTopics: string[] = [],
      qualityFlags: QualityControlFlag[] = [QualityControlFlag.PENDING_REVIEW],
      approved: boolean = false
    ): EnhancedMetadata {
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
      const metadata = createTestMetadata(
        'test.pdf',
        DocumentCategoryType.PRODUCT,
        [DocumentCategoryType.FEATURES],
        0.8,
        2
      );
      
      const result = mergeMetadata([metadata]);
      expect(result).toEqual(metadata);
    });
    
    test('throws error when list is empty', () => {
      expect(() => mergeMetadata([])).toThrow('Cannot merge empty metadata list');
    });
    
    test('merges multiple metadata items correctly', () => {
      const metadata1 = createTestMetadata(
        'test.pdf',
        DocumentCategoryType.PRODUCT,
        [DocumentCategoryType.FEATURES],
        0.8,
        2,
        [
          { name: 'ProductX', type: EntityType.PRODUCT, confidence: ConfidenceLevel.HIGH, mentions: 2 }
        ],
        ['product', 'software'],
        ['cloud', 'saas'],
        [QualityControlFlag.APPROVED],
        true
      );
      
      const metadata2 = createTestMetadata(
        'test.pdf',
        DocumentCategoryType.FEATURES,
        [DocumentCategoryType.PRODUCT, DocumentCategoryType.TECHNICAL],
        0.9,
        3,
        [
          { name: 'ProductX', type: EntityType.PRODUCT, confidence: ConfidenceLevel.MEDIUM, mentions: 3 },
          { name: 'Feature1', type: EntityType.FEATURE, confidence: ConfidenceLevel.HIGH, mentions: 1 }
        ],
        ['feature', 'capability'],
        ['functionality', 'tools'],
        [QualityControlFlag.PENDING_REVIEW],
        false
      );
      
      // Add a third metadata with FEATURES as primary to make it the most common category
      const metadata3 = createTestMetadata(
        'test.pdf',
        DocumentCategoryType.FEATURES,
        [DocumentCategoryType.TECHNICAL],
        0.85,
        3,
        [
          { name: 'Feature2', type: EntityType.FEATURE, confidence: ConfidenceLevel.HIGH, mentions: 2 }
        ],
        ['function', 'api'],
        ['interface', 'endpoints'],
        [QualityControlFlag.PENDING_REVIEW],
        false
      );
      
      console.log('Test data - Primary categories:', {
        metadata1: metadata1.primaryCategory,
        metadata2: metadata2.primaryCategory,
        metadata3: metadata3.primaryCategory
      });
      
      const merged = mergeMetadata([metadata1, metadata2, metadata3]);
      
      console.log('Merged result - Primary category:', merged.primaryCategory);
      
      // Check that the most common category is used as primary
      expect(merged.primaryCategory).toBe(DocumentCategoryType.FEATURES);
      
      // Check that secondary categories include others without duplicates
      expect(merged.secondaryCategories).toContain(DocumentCategoryType.PRODUCT);
      expect(merged.secondaryCategories).toContain(DocumentCategoryType.TECHNICAL);
      expect(merged.secondaryCategories).not.toContain(DocumentCategoryType.FEATURES);
      
      // Check that confidence score is averaged
      expect(merged.confidenceScore).toBeCloseTo((0.8 + 0.9 + 0.85) / 3);
      
      // Check that technical level is rounded average
      expect(merged.technicalLevel).toBe(3); // (2 + 3 + 3) / 3 = 2.67, rounded to 3
      
      // Check that entities are merged with combined mentions
      expect(merged.entities.length).toBe(3);
      
      const productEntity = merged.entities.find(e => 
        e.name === 'ProductX' && e.type === EntityType.PRODUCT);
      expect(productEntity).toBeDefined();
      expect(productEntity?.mentions).toBe(5); // 2 + 3
      expect(productEntity?.confidence).toBe(ConfidenceLevel.HIGH); // Higher confidence wins
      
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
      expect(merged.qualityFlags).toContain(QualityControlFlag.APPROVED);
      expect(merged.qualityFlags).toContain(QualityControlFlag.PENDING_REVIEW);
      
      // Check that approved is only true if all items are approved
      expect(merged.approved).toBe(false);
    });
    
    test('merges metadata and handles approved status correctly', () => {
      const metadata1 = createTestMetadata(
        'test.pdf',
        DocumentCategoryType.PRODUCT,
        [],
        0.8,
        2,
        [],
        [],
        [],
        [QualityControlFlag.APPROVED],
        true
      );
      
      const metadata2 = createTestMetadata(
        'test.pdf',
        DocumentCategoryType.PRODUCT,
        [],
        0.9,
        2,
        [],
        [],
        [],
        [QualityControlFlag.APPROVED],
        true
      );
      
      const merged = mergeMetadata([metadata1, metadata2]);
      
      // All items are approved, so merged should be approved
      expect(merged.approved).toBe(true);
      
      // Now add one that's not approved
      const metadata3 = createTestMetadata(
        'test.pdf',
        DocumentCategoryType.PRODUCT,
        [],
        0.7,
        2,
        [],
        [],
        [],
        [QualityControlFlag.PENDING_REVIEW],
        false
      );
      
      const mergedWithUnapproved = mergeMetadata([metadata1, metadata2, metadata3]);
      
      // Not all items are approved, so merged should not be approved
      expect(mergedWithUnapproved.approved).toBe(false);
    });
  });
}); 
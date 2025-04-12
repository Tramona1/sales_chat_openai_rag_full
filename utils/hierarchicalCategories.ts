/**
 * Hierarchical Categories Management
 * 
 * This module implements hierarchical category management for document classification
 * and navigation. It allows building parent-child relationships between categories
 * and navigating document collections through topic hierarchies.
 */

// Define interfaces first to avoid circular dependencies
export interface CategoryHierarchy {
  id: string;
  displayName: string;
  documentCount: number;
  children: CategoryHierarchy[];
  // Optional properties
  name?: string;
  color?: string;
  description?: string;
  parentId?: string;
}

// Import dependencies after interface definitions
import { 
  DocumentCategoryType, 
  CATEGORY_ATTRIBUTES, 
  getAllCategories 
} from './documentCategories';
import { VectorStoreItem } from './vectorStore';
import { parseEntities } from './metadataUtils';

// Define a default BASE_CATEGORY_HIERARCHY if the import fails
export const DEFAULT_CATEGORY_HIERARCHY: CategoryHierarchy[] = [
  {
    id: 'product',
    displayName: 'Product',
    documentCount: 0,
    children: []
  },
  {
    id: 'industry',
    displayName: 'Industry',
    documentCount: 0,
    children: []
  },
  {
    id: 'function',
    displayName: 'Function',
    documentCount: 0,
    children: []
  }
];

// Try to import BASE_CATEGORY_HIERARCHY, but use default if it fails
let BASE_CATEGORY_HIERARCHY: CategoryHierarchy[];
try {
  const importedHierarchy = require('./categoryHierarchyData').BASE_CATEGORY_HIERARCHY;
  BASE_CATEGORY_HIERARCHY = importedHierarchy;
} catch (e) {
  console.warn('Could not import BASE_CATEGORY_HIERARCHY, using default hierarchy');
  BASE_CATEGORY_HIERARCHY = DEFAULT_CATEGORY_HIERARCHY;
}

/**
 * Category path representation
 */
export interface CategoryPath {
  path: string[];
  displayPath: string[];
}

/**
 * Document with category information
 */
interface DocumentWithCategories {
  id: string;
  categories: string[];
  primaryCategory?: string;
  metadata?: Record<string, any>;
}

/**
 * Pre-defined hierarchy relationships between categories
 * This defines which categories are children of others
 */
const CATEGORY_HIERARCHY: Record<string, string[]> = {
  // Product information hierarchy
  [DocumentCategoryType.PRODUCT]: [
    DocumentCategoryType.FEATURES,
    DocumentCategoryType.TECHNICAL,
    DocumentCategoryType.PRICING
  ],
  
  // Customer information hierarchy
  [DocumentCategoryType.CUSTOMER]: [
    DocumentCategoryType.CASE_STUDY,
    DocumentCategoryType.TESTIMONIAL
  ],
  
  // Market information hierarchy
  [DocumentCategoryType.MARKET]: [
    DocumentCategoryType.COMPETITORS
  ]
};

/**
 * Build a full category hierarchy from all available categories
 */
export function buildFullCategoryHierarchy(): CategoryHierarchy[] {
  const allCategories = getAllCategories();
  const rootCategories: CategoryHierarchy[] = [];
  const categoryMap: Record<string, CategoryHierarchy> = {};
  
  // First pass: create all category nodes
  allCategories.forEach(category => {
    const attributes = CATEGORY_ATTRIBUTES[category];
    categoryMap[category] = {
      id: category,
      name: category,
      displayName: attributes.displayName,
      children: [],
      documentCount: 0,
      color: attributes.color,
      description: attributes.description
    };
  });
  
  // Second pass: establish parent-child relationships
  Object.entries(CATEGORY_HIERARCHY).forEach(([parentId, childIds]) => {
    if (categoryMap[parentId]) {
      childIds.forEach(childId => {
        if (categoryMap[childId]) {
          categoryMap[childId].parentId = parentId;
          categoryMap[parentId].children.push(categoryMap[childId]);
        }
      });
    }
  });
  
  // Third pass: collect root categories (those without parents)
  allCategories.forEach(category => {
    if (!categoryMap[category].parentId) {
      rootCategories.push(categoryMap[category]);
    }
  });
  
  return rootCategories;
}

/**
 * Extend VectorStoreItem metadata to clarify the metadata structure
 */
export interface EnhancedMetadata {
  source?: string;
  page?: number;
  batch?: string;
  isStructured?: boolean;
  infoType?: string;
  priority?: string;
  category?: string;
  technicalLevel?: number;
  entities?: string | Record<string, any[]>;
  keywords?: string;
  summary?: string;
  lastUpdated?: string;
  timestamp?: string;
  createdAt?: string;
  approvedAt?: string;
  isAuthoritative?: string;
  isDeprecated?: string;
  deprecatedBy?: string;
  deprecatedAt?: string;
  
  // Extended properties from Gemini processing
  primaryCategory?: string;
  secondaryCategories?: string[];
  industryCategories?: string[];
  functionCategories?: string[];
  useCases?: string[];
}

/**
 * Define enhanced vector store item without conflicting with base interface
 */
export type EnhancedVectorStoreItem = VectorStoreItem & {
  metadata?: EnhancedMetadata;
};

/**
 * Flattens a category hierarchy into a single-level array
 */
export function flattenHierarchy(categories: CategoryHierarchy[]): CategoryHierarchy[] {
  let flattened: CategoryHierarchy[] = [];
  
  for (const category of categories) {
    flattened.push(category);
    flattened = flattened.concat(flattenHierarchy(category.children));
  }
  
  return flattened;
}

/**
 * Rolls up counts from child categories to their parents
 */
export function rollUpCounts(categories: CategoryHierarchy[]): void {
  for (const category of categories) {
    // First roll up counts in children
    rollUpCounts(category.children);
    
    // Then add children counts to parent
    for (const child of category.children) {
      category.documentCount += child.documentCount;
    }
  }
}

/**
 * Build category hierarchy with document counts from a set of documents
 */
export function buildCategoryHierarchyWithCounts(
  documents: VectorStoreItem[]
): CategoryHierarchy[] {
  // Create a deep copy of the base hierarchy
  const categoryHierarchy = JSON.parse(JSON.stringify(BASE_CATEGORY_HIERARCHY)) as CategoryHierarchy[];
  
  // Create a map for quick lookup
  const categoryMap: Record<string, CategoryHierarchy> = {};
  flattenHierarchy(categoryHierarchy).forEach(category => {
    categoryMap[category.id] = category;
  });
  
  // Count documents for each category
  documents.forEach(doc => {
    // Check primary category first
    const primaryCategory = (doc.metadata as any)?.primaryCategory as string | undefined;
    if (primaryCategory && categoryMap[primaryCategory]) {
      categoryMap[primaryCategory].documentCount++;
    }
    
    // Check secondary categories
    const secondaryCategories = (doc.metadata as any)?.secondaryCategories || [];
    if (Array.isArray(secondaryCategories)) {
      secondaryCategories.forEach(category => {
        if (category && categoryMap[category]) {
          categoryMap[category].documentCount++;
        }
      });
    }
    
    // Check industry categories
    const industryCategories = (doc.metadata as any)?.industryCategories || [];
    if (Array.isArray(industryCategories)) {
      industryCategories.forEach(category => {
        // Industry categories might not be in our predefined hierarchy
        if (category && categoryMap[category]) {
          categoryMap[category].documentCount++;
        }
      });
    }
    
    // Check function categories
    const functionCategories = (doc.metadata as any)?.functionCategories || [];
    if (Array.isArray(functionCategories)) {
      functionCategories.forEach(category => {
        if (category && categoryMap[category]) {
          categoryMap[category].documentCount++;
        }
      });
    }
  });
  
  // Roll up counts to parent categories
  rollUpCounts(categoryHierarchy);
  
  return categoryHierarchy;
}

/**
 * Get category path from category ID
 */
export function getCategoryPath(categoryId: string): CategoryPath {
  const allCategories = getAllCategories();
  const categoryMap: Record<string, {
    id: string, 
    parentId?: string,
    displayName: string
  }> = {};
  
  // Build a map of categories for easy lookup
  allCategories.forEach(category => {
    categoryMap[category] = {
      id: category,
      displayName: CATEGORY_ATTRIBUTES[category].displayName
    };
  });
  
  // Establish parent-child relationships
  Object.entries(CATEGORY_HIERARCHY).forEach(([parentId, childIds]) => {
    childIds.forEach(childId => {
      if (categoryMap[childId]) {
        categoryMap[childId].parentId = parentId;
      }
    });
  });
  
  // Build path from target to root
  const path: string[] = [];
  const displayPath: string[] = [];
  let currentId = categoryId;
  
  while (currentId && categoryMap[currentId]) {
    path.unshift(currentId);
    displayPath.unshift(categoryMap[currentId].displayName);
    currentId = categoryMap[currentId].parentId || '';
  }
  
  return { path, displayPath };
}

/**
 * Extract category IDs from a path string (e.g., "product/features")
 */
export function parseCategoryPath(pathString: string): string[] {
  if (!pathString) return [];
  return pathString.split('/').filter(segment => segment.length > 0);
}

/**
 * Filter documents by category path
 */
export function filterDocumentsByCategoryPath(
  documents: VectorStoreItem[],
  categoryPath: string[]
): VectorStoreItem[] {
  if (!categoryPath || categoryPath.length === 0) {
    return documents;
  }
  
  const targetCategory = categoryPath[categoryPath.length - 1];
  
  return documents.filter(doc => {
    // Check primary category
    if ((doc.metadata as any)?.primaryCategory === targetCategory) {
      return true;
    }
    
    // Check secondary categories
    const secondaryCategories = (doc.metadata as any)?.secondaryCategories || [];
    if (Array.isArray(secondaryCategories) && secondaryCategories.includes(targetCategory)) {
      return true;
    }
    
    // Check additional category fields
    const additionalCategories = [
      ...(Array.isArray((doc.metadata as any)?.industryCategories) ? (doc.metadata as any)?.industryCategories : []),
      ...(Array.isArray((doc.metadata as any)?.functionCategories) ? (doc.metadata as any)?.functionCategories : [])
    ];
    
    if (additionalCategories.includes(targetCategory)) {
      return true;
    }
    
    return false;
  });
}

/**
 * Get all entity types from documents
 */
export function getAllEntitiesFromDocuments(
  documents: VectorStoreItem[]
): Record<string, { name: string, count: number }[]> {
  const entityTypes: Record<string, Map<string, number>> = {
    people: new Map<string, number>(),
    companies: new Map<string, number>(),
    products: new Map<string, number>(),
    features: new Map<string, number>()
  };
  
  documents.forEach(doc => {
    if (!doc.metadata?.entities) return;
    
    // Use our parseEntities utility function to handle different formats
    const parsedEntities = parseEntities(doc.metadata.entities);
    
    // Process all entities by their type
    parsedEntities.forEach(entity => {
      if (!entity || !entity.name || !entity.type) return;
      
      const entityName = entity.name;
      const type = entity.type.toLowerCase();
      
      // Map entity types to our collection categories
      if (type === 'person') {
        const count = entityTypes.people.get(entityName) || 0;
        entityTypes.people.set(entityName, count + entity.mentions || count + 1);
      } else if (type === 'organization' || type === 'company') {
        const count = entityTypes.companies.get(entityName) || 0;
        entityTypes.companies.set(entityName, count + entity.mentions || count + 1);
      } else if (type === 'product') {
        const count = entityTypes.products.get(entityName) || 0;
        entityTypes.products.set(entityName, count + entity.mentions || count + 1);
      } else if (type === 'feature') {
        const count = entityTypes.features.get(entityName) || 0;
        entityTypes.features.set(entityName, count + entity.mentions || count + 1);
      }
    });
  });
  
  // Convert maps to sorted arrays
  return {
    people: [...entityTypes.people.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    companies: [...entityTypes.companies.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    products: [...entityTypes.products.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    features: [...entityTypes.features.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  };
}

/**
 * Get technical level distribution from documents
 */
export function getTechnicalLevelDistribution(
  documents: VectorStoreItem[]
): { level: number, count: number }[] {
  const levelCounts = new Map<number, number>();
  
  // Initialize with all possible levels (1-10)
  for (let i = 1; i <= 10; i++) {
    levelCounts.set(i, 0);
  }
  
  // Count occurrences of each technical level
  documents.forEach(doc => {
    if (doc.metadata?.technicalLevel) {
      let level: number;
      if (typeof doc.metadata.technicalLevel === 'string') {
        level = parseInt(doc.metadata.technicalLevel, 10);
      } else {
        level = doc.metadata.technicalLevel as number;
      }
      
      if (!isNaN(level) && level >= 1 && level <= 10) {
        levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
      }
    }
  });
  
  // Convert to array and sort by level
  return Array.from(levelCounts.entries())
    .map(([level, count]) => ({ level, count }))
    .sort((a, b) => a.level - b.level);
}

/**
 * Perform hierarchical search with facets
 */
export async function hierarchicalSearch(
  query: string,
  options: {
    limit?: number;
    categoryPath?: string[];
    includeFacets?: boolean;
    technicalLevelRange?: { min: number; max: number };
    entityFilters?: Record<string, string[]>;
  } = {}
): Promise<{
  results: VectorStoreItem[];
  facets?: {
    categories: { id: string; name: string; count: number; path: string[] }[];
    entities: Record<string, { name: string; count: number }[]>;
    technicalLevels: { level: number; count: number }[];
  };
}> {
  const { hybridSearch } = await import('./hybridSearch');
  
  // Call the hybrid search with hierarchical options
  const searchResponse = await hybridSearch(query, {
    limit: options.limit || 20,
    categoryPath: options.categoryPath,
    includeFacets: options.includeFacets,
    technicalLevelRange: options.technicalLevelRange,
    entityFilters: options.entityFilters
  });
  
  // Extract just the items from results
  const results = searchResponse.results;
  
  // If facets not requested, return just the results
  if (!options.includeFacets) {
    return { results };
  }
  
  // Convert CategoryHierarchy format to the expected return format
  const convertedCategories = searchResponse.facets?.categories ? 
    flattenHierarchy(searchResponse.facets.categories).map(cat => ({
      id: cat.id,
      name: cat.displayName,
      count: cat.documentCount,
      path: [cat.id] // This is simplified - in a real implementation we'd need to build proper paths
    })) : [];
  
  // Return results with transformed facets
  return {
    results,
    facets: {
      categories: convertedCategories,
      entities: searchResponse.facets?.entities || {},
      technicalLevels: searchResponse.facets?.technicalLevels || []
    }
  };
} 
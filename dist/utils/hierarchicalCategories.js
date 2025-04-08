"use strict";
/**
 * Hierarchical Categories Management
 *
 * This module implements hierarchical category management for document classification
 * and navigation. It allows building parent-child relationships between categories
 * and navigating document collections through topic hierarchies.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CATEGORY_HIERARCHY = void 0;
exports.buildFullCategoryHierarchy = buildFullCategoryHierarchy;
exports.flattenHierarchy = flattenHierarchy;
exports.rollUpCounts = rollUpCounts;
exports.buildCategoryHierarchyWithCounts = buildCategoryHierarchyWithCounts;
exports.getCategoryPath = getCategoryPath;
exports.parseCategoryPath = parseCategoryPath;
exports.filterDocumentsByCategoryPath = filterDocumentsByCategoryPath;
exports.getAllEntitiesFromDocuments = getAllEntitiesFromDocuments;
exports.getTechnicalLevelDistribution = getTechnicalLevelDistribution;
exports.hierarchicalSearch = hierarchicalSearch;
// Import dependencies after interface definitions
const documentCategories_1 = require("./documentCategories");
// Define a default BASE_CATEGORY_HIERARCHY if the import fails
exports.DEFAULT_CATEGORY_HIERARCHY = [
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
let BASE_CATEGORY_HIERARCHY;
try {
    const importedHierarchy = require('./categoryHierarchyData').BASE_CATEGORY_HIERARCHY;
    BASE_CATEGORY_HIERARCHY = importedHierarchy;
}
catch (e) {
    console.warn('Could not import BASE_CATEGORY_HIERARCHY, using default hierarchy');
    BASE_CATEGORY_HIERARCHY = exports.DEFAULT_CATEGORY_HIERARCHY;
}
/**
 * Pre-defined hierarchy relationships between categories
 * This defines which categories are children of others
 */
const CATEGORY_HIERARCHY = {
    // Product information hierarchy
    [documentCategories_1.DocumentCategoryType.PRODUCT]: [
        documentCategories_1.DocumentCategoryType.FEATURES,
        documentCategories_1.DocumentCategoryType.TECHNICAL,
        documentCategories_1.DocumentCategoryType.PRICING
    ],
    // Customer information hierarchy
    [documentCategories_1.DocumentCategoryType.CUSTOMER]: [
        documentCategories_1.DocumentCategoryType.CASE_STUDY,
        documentCategories_1.DocumentCategoryType.TESTIMONIAL
    ],
    // Market information hierarchy
    [documentCategories_1.DocumentCategoryType.MARKET]: [
        documentCategories_1.DocumentCategoryType.COMPETITORS
    ]
};
/**
 * Build a full category hierarchy from all available categories
 */
function buildFullCategoryHierarchy() {
    const allCategories = (0, documentCategories_1.getAllCategories)();
    const rootCategories = [];
    const categoryMap = {};
    // First pass: create all category nodes
    allCategories.forEach(category => {
        const attributes = documentCategories_1.CATEGORY_ATTRIBUTES[category];
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
 * Flattens a category hierarchy into a single-level array
 */
function flattenHierarchy(categories) {
    let flattened = [];
    for (const category of categories) {
        flattened.push(category);
        flattened = flattened.concat(flattenHierarchy(category.children));
    }
    return flattened;
}
/**
 * Rolls up counts from child categories to their parents
 */
function rollUpCounts(categories) {
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
function buildCategoryHierarchyWithCounts(documents) {
    // Create a deep copy of the base hierarchy
    const categoryHierarchy = JSON.parse(JSON.stringify(BASE_CATEGORY_HIERARCHY));
    // Create a map for quick lookup
    const categoryMap = {};
    flattenHierarchy(categoryHierarchy).forEach(category => {
        categoryMap[category.id] = category;
    });
    // Count documents for each category
    documents.forEach(doc => {
        var _a, _b, _c, _d;
        // Check primary category first
        const primaryCategory = (_a = doc.metadata) === null || _a === void 0 ? void 0 : _a.primaryCategory;
        if (primaryCategory && categoryMap[primaryCategory]) {
            categoryMap[primaryCategory].documentCount++;
        }
        // Check secondary categories
        const secondaryCategories = ((_b = doc.metadata) === null || _b === void 0 ? void 0 : _b.secondaryCategories) || [];
        if (Array.isArray(secondaryCategories)) {
            secondaryCategories.forEach(category => {
                if (category && categoryMap[category]) {
                    categoryMap[category].documentCount++;
                }
            });
        }
        // Check industry categories
        const industryCategories = ((_c = doc.metadata) === null || _c === void 0 ? void 0 : _c.industryCategories) || [];
        if (Array.isArray(industryCategories)) {
            industryCategories.forEach(category => {
                // Industry categories might not be in our predefined hierarchy
                if (category && categoryMap[category]) {
                    categoryMap[category].documentCount++;
                }
            });
        }
        // Check function categories
        const functionCategories = ((_d = doc.metadata) === null || _d === void 0 ? void 0 : _d.functionCategories) || [];
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
function getCategoryPath(categoryId) {
    const allCategories = (0, documentCategories_1.getAllCategories)();
    const categoryMap = {};
    // Build a map of categories for easy lookup
    allCategories.forEach(category => {
        categoryMap[category] = {
            id: category,
            displayName: documentCategories_1.CATEGORY_ATTRIBUTES[category].displayName
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
    const path = [];
    const displayPath = [];
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
function parseCategoryPath(pathString) {
    if (!pathString)
        return [];
    return pathString.split('/').filter(segment => segment.length > 0);
}
/**
 * Filter documents by category path
 */
function filterDocumentsByCategoryPath(documents, categoryPath) {
    if (!categoryPath || categoryPath.length === 0) {
        return documents;
    }
    const targetCategory = categoryPath[categoryPath.length - 1];
    return documents.filter(doc => {
        var _a, _b, _c, _d, _e, _f;
        // Check primary category
        if (((_a = doc.metadata) === null || _a === void 0 ? void 0 : _a.primaryCategory) === targetCategory) {
            return true;
        }
        // Check secondary categories
        const secondaryCategories = ((_b = doc.metadata) === null || _b === void 0 ? void 0 : _b.secondaryCategories) || [];
        if (Array.isArray(secondaryCategories) && secondaryCategories.includes(targetCategory)) {
            return true;
        }
        // Check additional category fields
        const additionalCategories = [
            ...(Array.isArray((_c = doc.metadata) === null || _c === void 0 ? void 0 : _c.industryCategories) ? (_d = doc.metadata) === null || _d === void 0 ? void 0 : _d.industryCategories : []),
            ...(Array.isArray((_e = doc.metadata) === null || _e === void 0 ? void 0 : _e.functionCategories) ? (_f = doc.metadata) === null || _f === void 0 ? void 0 : _f.functionCategories : [])
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
function getAllEntitiesFromDocuments(documents) {
    const entityTypes = {
        people: new Map(),
        companies: new Map(),
        products: new Map(),
        features: new Map()
    };
    documents.forEach(doc => {
        var _a;
        if (!((_a = doc.metadata) === null || _a === void 0 ? void 0 : _a.entities))
            return;
        // Entities might be stored as a JSON string or already as an object
        let entities;
        if (typeof doc.metadata.entities === 'string') {
            try {
                entities = JSON.parse(doc.metadata.entities);
            }
            catch (e) {
                // If parsing fails, skip this document
                return;
            }
        }
        else {
            entities = doc.metadata.entities;
        }
        // Process people entities
        if (entities && entities.people && Array.isArray(entities.people)) {
            entities.people.forEach((person) => {
                if (typeof person === 'string') {
                    const count = entityTypes.people.get(person) || 0;
                    entityTypes.people.set(person, count + 1);
                }
                else if (person && typeof person === 'object' && person.name) {
                    const count = entityTypes.people.get(person.name) || 0;
                    entityTypes.people.set(person.name, count + 1);
                }
            });
        }
        // Process company entities
        if (entities && entities.companies && Array.isArray(entities.companies)) {
            entities.companies.forEach((company) => {
                if (typeof company === 'string') {
                    const count = entityTypes.companies.get(company) || 0;
                    entityTypes.companies.set(company, count + 1);
                }
                else if (company && typeof company === 'object' && company.name) {
                    const count = entityTypes.companies.get(company.name) || 0;
                    entityTypes.companies.set(company.name, count + 1);
                }
            });
        }
        // Process product entities
        if (entities && entities.products && Array.isArray(entities.products)) {
            entities.products.forEach((product) => {
                if (typeof product === 'string') {
                    const count = entityTypes.products.get(product) || 0;
                    entityTypes.products.set(product, count + 1);
                }
                else if (product && typeof product === 'object' && product.name) {
                    const count = entityTypes.products.get(product.name) || 0;
                    entityTypes.products.set(product.name, count + 1);
                }
            });
        }
        // Process feature entities
        if (entities && entities.features && Array.isArray(entities.features)) {
            entities.features.forEach((feature) => {
                if (typeof feature === 'string') {
                    const count = entityTypes.features.get(feature) || 0;
                    entityTypes.features.set(feature, count + 1);
                }
                else if (feature && typeof feature === 'object' && feature.name) {
                    const count = entityTypes.features.get(feature.name) || 0;
                    entityTypes.features.set(feature.name, count + 1);
                }
            });
        }
    });
    // Convert maps to arrays and sort by count
    const result = {};
    for (const [type, countMap] of Object.entries(entityTypes)) {
        result[type] = Array.from(countMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }
    return result;
}
/**
 * Get technical level distribution from documents
 */
function getTechnicalLevelDistribution(documents) {
    const levelCounts = new Map();
    // Initialize with all possible levels (1-10)
    for (let i = 1; i <= 10; i++) {
        levelCounts.set(i, 0);
    }
    // Count occurrences of each technical level
    documents.forEach(doc => {
        var _a;
        if ((_a = doc.metadata) === null || _a === void 0 ? void 0 : _a.technicalLevel) {
            let level;
            if (typeof doc.metadata.technicalLevel === 'string') {
                level = parseInt(doc.metadata.technicalLevel, 10);
            }
            else {
                level = doc.metadata.technicalLevel;
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
async function hierarchicalSearch(query, options = {}) {
    var _a, _b, _c;
    const { hybridSearch } = await Promise.resolve().then(() => __importStar(require('./hybridSearch')));
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
    const convertedCategories = ((_a = searchResponse.facets) === null || _a === void 0 ? void 0 : _a.categories) ?
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
            entities: ((_b = searchResponse.facets) === null || _b === void 0 ? void 0 : _b.entities) || {},
            technicalLevels: ((_c = searchResponse.facets) === null || _c === void 0 ? void 0 : _c.technicalLevels) || []
        }
    };
}

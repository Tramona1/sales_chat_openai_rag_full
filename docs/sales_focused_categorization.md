# Sales-Focused Categorization

## Overview

This document outlines the sales-focused categorization enhancements implemented in the RAG system to better support sales use cases. These enhancements include new category types, improved document analysis prompts, and more detailed metadata extraction specifically targeting sales-relevant information.

## New Sales-Focused Categories

Fifteen new sales-focused categories have been added to the `DocumentCategoryType` enum and the `STANDARD_CATEGORIES` array:

1. **CASE_STUDIES**: Documents that provide detailed customer success stories showing implementation and results.
2. **CUSTOMER_TESTIMONIALS**: Quotes and statements from customers about their experience.
3. **ROI_CALCULATOR**: Tools and information for calculating return on investment.
4. **PRICING_INFORMATION**: Pricing details, plans, and package information.
5. **COMPETITIVE_ANALYSIS**: Information comparing the product to competitors.
6. **PRODUCT_COMPARISON**: Direct comparisons between different products or plans.
7. **FEATURE_BENEFITS**: Detailed benefits and value propositions of specific features.
8. **SALES_ENABLEMENT**: Materials specifically created to support the sales process.
9. **IMPLEMENTATION_PROCESS**: Information about how the product is implemented and onboarded.
10. **CONTRACT_TERMS**: Information about contracts, agreements, and terms of service.
11. **CUSTOMER_SUCCESS_STORIES**: Stories and examples of successful customer implementations.
12. **PRODUCT_ROADMAP**: Information about future product plans and development.
13. **INDUSTRY_INSIGHTS**: Knowledge and information about industry trends and challenges.
14. **COST_SAVINGS_ANALYSIS**: Analysis of potential cost savings from using the product.
15. **DEMO_MATERIALS**: Resources and information for demonstrating the product.

## Document Analysis Improvements

The Gemini document analysis prompts have been enhanced to better identify and categorize sales-relevant content:

1. **Category Recognition**: The analysis prompts now explicitly mention and describe the sales-focused categories, making it more likely that appropriate categorization will occur.

2. **Sales Entity Extraction**: The enhanced analysis prompt now specifically looks for sales-related entities such as:
   - Value propositions
   - ROI figures
   - Pricing tiers
   - Competitive advantages
   - Customer pain points
   - Target industries or segments
   - Conversion metrics
   - Sales cycle information

3. **Content Type Recognition**: The `contentType` field can now explicitly identify "sales" as a content type, further improving categorization.

## Affected Files

The following files have been modified to implement these enhancements:

1. **utils/documentCategories.ts**: Added sales-focused categories to the `DocumentCategoryType` enum and the `CATEGORY_ATTRIBUTES` object.

2. **utils/tagUtils.ts**: Added sales-focused categories to the `STANDARD_CATEGORIES` array to ensure consistency across the application.

3. **utils/geminiProcessor.ts**: Updated both the standard and enhanced document analysis prompts to provide better guidance for identifying and categorizing sales-focused content.

## Benefits for Sales Use Cases

These enhancements provide several benefits for sales-related use cases:

1. **Better Content Discovery**: Sales representatives can now more easily find relevant content by filtering on sales-specific categories.

2. **Enhanced Categorization**: The system now more accurately identifies and categorizes sales-focused content, including materials that may have previously been categorized too broadly.

3. **Richer Metadata**: The enhanced analysis now extracts more sales-relevant entities and information, improving the context available for the RAG system.

4. **Targeted Search Results**: The hybrid search system can now provide more targeted results for sales queries by leveraging the enhanced categorization.

## Usage in Hybrid Search

To filter search results to include only sales-focused categories:

```typescript
// Example: Filter for sales enablement and competitive analysis
const filter: HybridSearchFilter = {
  secondaryCategories: [
    DocumentCategoryType.SALES_ENABLEMENT,
    DocumentCategoryType.COMPETITIVE_ANALYSIS
  ]
};

// Perform search with filter
const results = await hybridSearch("product advantages", { 
  filter, 
  limit: 10 
});
```

## Future Improvements

Potential future improvements to the sales-focused categorization:

1. **Sales Intent Detection**: Enhance query analysis to better detect when a user has sales-focused intent.

2. **Category Weighting**: Implement weighted scoring for sales categories based on query context.

3. **Auto-Classification Auditing**: Set up periodic auditing of auto-classified sales content to ensure accuracy.

4. **Custom Sales Embeddings**: Train custom embeddings for sales-specific terminology and contexts.

5. **Sales Persona Adaptation**: Create different response patterns based on detected sales personas (e.g., SDR, Account Executive, Customer Success Manager). 
# Document Categories and Tagging System

Our application uses a standardized categorization and tagging system to organize content and improve search relevance. This document outlines the complete approach to document categorization, tagging, and how these elements are used in search.

## Primary Categories

Our system uses the following primary categories to classify documents:

### Content Types
- **API_DOCUMENTATION**: Technical documentation about APIs, endpoints, and integration details
- **BLOG**: Blog posts, articles, and thought leadership content
- **COMPANY_INFO**: Information about the company, team, mission, and values
- **COMPETITORS**: Information about competing products or services
- **CUSTOMER_STORIES**: Case studies and success stories from customers
- **FEATURES**: Detailed descriptions of product features and capabilities
- **GUIDES**: Step-by-step guides, tutorials, and how-to content
- **LEGAL**: Terms of service, privacy policies, and other legal documents
- **PRODUCT_OVERVIEW**: General product information, homepage content, and platform overviews
- **PRICING**: Pricing information, plans, and packaging details
- **SECURITY**: Security features, compliance information, and best practices
- **SUPPORT**: FAQs, troubleshooting guides, and support resources

### Product Categories
- **HIRING**: Hiring and recruitment features
- **ONBOARDING**: Employee onboarding capabilities  
- **HR_MANAGEMENT**: HR management tools and features
- **PAYROLL**: Payroll processing and management
- **COMPLIANCE**: Compliance and regulatory features
- **SCHEDULING**: Shift scheduling and management
- **RETENTION**: Employee retention features
- **TIME_TRACKING**: Time tracking capabilities
- **MOBILE_SOLUTIONS**: Mobile app features and capabilities

### Sales-Focused Categories
- **CASE_STUDIES**: Detailed customer success stories
- **CUSTOMER_TESTIMONIALS**: Customer testimonials and reviews
- **ROI_CALCULATOR**: ROI and value calculation tools
- **PRICING_INFORMATION**: Pricing details and comparisons
- **COMPETITIVE_ANALYSIS**: Analysis comparing to competitor solutions
- **PRODUCT_COMPARISON**: Direct feature/product comparisons
- **FEATURE_BENEFITS**: Descriptions of feature benefits
- **SALES_ENABLEMENT**: Sales enablement resources
- **IMPLEMENTATION_PROCESS**: Details on implementation process
- **CONTRACT_TERMS**: Contract and terms information
- **INDUSTRY_INSIGHTS**: Industry-specific information

## Category Selection Process

The system employs a sophisticated category selection process that intelligently combines categories derived from different sources:

### Primary Category Selection Logic

The system prioritizes categories using the following decision tree:

1. **URL-derived categories** are given highest priority
   - Explicit path segments (e.g., `/payroll/`, `/onboarding/`)
   - Homepage URL automatically categorized as `PRODUCT_OVERVIEW`
2. **LLM-derived categories with high confidence** (sales relevance score ≥ 7) are used if URL doesn't provide clear category
3. **Default to first LLM category** if available, otherwise use `GENERAL`

### Secondary Category Selection

Secondary categories are intelligently combined from multiple sources:

1. All URL-derived secondary categories are included
2. LLM-suggested categories (except the selected primary) are added
3. Duplicates are automatically removed
4. Empty or blank categories are filtered out

This multi-faceted approach ensures documents appear in relevant searches even when the query doesn't exactly match the primary category.

## Enhanced Entity Extraction

The system extracts and stores the following entity types for each document:

### Standard Entity Types
- **PERSON**: People mentioned in the document (e.g., CEOs, founders)
- **ORGANIZATION**: Organizations mentioned (e.g., companies, partners)
- **PRODUCT**: Products mentioned (e.g., specific solutions)
- **FEATURE**: Features mentioned (e.g., Text-to-Apply, Shift Scheduling)
- **LOCATION**: Locations mentioned (e.g., countries, cities)
- **DATE**: Important dates mentioned

### Sales-Focused Entity Types
- **INDUSTRY**: Target industries (e.g., Restaurant, Retail, Healthcare)
- **COMPETITOR**: Competitor products or services (e.g., ADP, Gusto)
- **INTEGRATION_PARTNER**: Integration partners (e.g., QuickBooks, Google Calendar)
- **TECHNOLOGY**: Technologies mentioned (e.g., AI, SMS, API)
- **REGULATION**: Regulatory items (e.g., I-9, WOTC, HIPAA)
- **BENEFIT**: Business benefits (e.g., Cost Savings, Efficiency)
- **PRICING**: Pricing information, costs, ROI indicators
- **USE_CASE**: Specific use cases or customer scenarios
- **SALES_POINT**: Key selling points and value propositions

## URL Path Segment Handling

The system now extracts and uses URL path segments for improved categorization and search:

1. **Path Segment Extraction**: All segments of the document URL are extracted (e.g., `/blog/payroll/new-features` → `["blog", "payroll", "new-features"]`)
2. **Storage in Metadata**: Path segments are stored in both document and chunk metadata
3. **Search Filtering**: Path segments can be used for precise filtering in searches
4. **Entity-to-Path Mapping**: Entities in queries are mapped to relevant URL paths

This approach allows for more targeted retrieval, especially when users are looking for content in specific sections of the documentation or website.

## Search Filtering with Categories and Tags

The hybrid search system leverages categories, entities, and path segments for improved search relevance:

### Filter Components
- **Primary Category**: Filters for documents with a specific primary category
- **Secondary Categories**: Filters for documents with any of the specified secondary categories
- **URL Path Segments**: Filters for documents with specific URL paths
- **Technical Level**: Filters for specific technical complexity (range from 1-10)
- **Required Entities**: Filters for documents containing specific entities
- **Keywords**: Filters for documents with specific keywords

### Special Treatment for Sales Categories

Sales-focused categories receive special treatment in the search algorithm:

```typescript
function isSalesFocusedCategory(category?: string): boolean {
  if (!category) return false;
  
  const salesCategories = [
    'CASE_STUDIES',
    'CUSTOMER_TESTIMONIALS',
    'ROI_CALCULATOR',
    'PRICING_INFORMATION',
    'COMPETITIVE_ANALYSIS',
    // ... other sales categories
  ];
  
  return salesCategories.includes(category);
}
```

When a search includes sales-focused categories, additional boosting is applied to ensure sales-relevant content appears higher in results.

## Balanced Category Handling

Our system now includes functionality to ensure a balanced distribution of content categories in search results, particularly preventing over-representation of sales-focused content for non-sales queries:

### Automatic Category Balancing

For queries that don't have an explicit sales focus, the system will:

1. **Detect Sales-Focus**: Evaluate if the query has a sales focus based on intent and entities
2. **Check Category Alignment**: Identify if the primary category aligns with the query intent
3. **Adjust Primary Category**: If a sales-focused category is assigned to a non-sales query, substitute with a more appropriate non-sales category
4. **Monitor Results Ratio**: Track the ratio of sales vs. non-sales content in search results

This ensures that users receive the most relevant content type based on their actual query intent, rather than biasing toward sales content.

## Chain-of-Thought Tracking

All search decisions are now comprehensively logged to enable detailed analysis of the system's decision-making process:

### Search Trace Components

Each search query generates a detailed trace containing:

1. **Query Analysis**: Details about query intent, categories, entities, and technical level
2. **Search Decisions**: Records of initial filter, applied filter, and filter relaxation decisions
3. **Category Balancing**: Before/after stats when category adjustments are made
4. **Result Statistics**: Counts of results from different categories and sales content ratio 
5. **Timing Information**: Performance metrics for each step of the process

### Trace Visualization

A new admin dashboard provides visualization of search traces, enabling:

1. **Category Distribution**: View how queries are distributed across different categories
2. **Sales vs. Non-Sales Ratio**: Monitor the balance between sales and non-sales content in results
3. **Query Intent Analysis**: Track the types of queries users are making
4. **Detailed Trace Exploration**: Examine the full decision chain for any specific query

### Database Storage

Search traces are stored in a dedicated `search_traces` table with:

- JSON fields for structured data storage
- Indexes for efficient querying
- SQL functions for aggregate analysis

## Smart Fallback Mechanisms

The system includes intelligent fallback mechanisms when strict filtering returns no results:

1. **Filter Relaxation**: If no results are found with strict filters, the system automatically relaxes filters
2. **Category Broadening**: If specific categories yield no results, the system broadens to related categories
3. **Keyword Fallback**: If semantic search fails, the system falls back to keyword-based search
4. **Zero Results Handling**: Detailed logging of zero-result searches to improve future performance

## Implementation

The categorization and tagging system is implemented across several components:

### Document Processing
- `scripts/process_crawl_and_store.ts`: Handles initial document categorization during ingestion
- `utils/documentProcessing.ts`: Manages chunking and metadata propagation
- `utils/geminiProcessor.ts`: Provides LLM-based entity extraction and categorization

### Search Implementation
- `utils/hybridSearch.ts`: Implements the hybrid search with category filtering
- `utils/queryRouter.ts`: Routes queries to appropriate search mechanisms based on intent
- `utils/queryAnalysis.ts`: Analyzes queries for entities, categories, and intent
- `utils/reranking.ts`: Handles reranking of results with metadata consideration

### Database Integration
- PostgreSQL functions in Supabase handle efficient filtering based on metadata
- Additional indexes on categories and URL path segments improve search performance
- The `hybrid_search` RPC function supports all filtering mechanisms

### Analytics & Monitoring
- `components/admin/SearchAnalyticsTab.tsx`: Admin dashboard for analyzing search patterns
- `db_migrations/add_search_traces_table.sql`: Database structure for storing search traces
- `scripts/apply_migrations.ts`: Script for applying database migrations

## Logging and Debugging

The system logs detailed information about the category selection process for each document:

- URL-derived categories
- LLM-suggested categories
- Final selected primary category
- Final combined secondary categories
- Filter application during search
- Search performance metrics
- Category balancing adjustments
- Sales content ratio in results

This enhanced logging facilitates debugging, quality assessment, and continuous improvement of the categorization system.

## Future Enhancements

Planned improvements to the tagging system include:

- Fine-tuned models specifically for document categorization
- User feedback loops to improve tagging accuracy
- Additional metadata fields for more granular filtering
- Integration with domain-specific taxonomies
- Adaptive search parameters based on result quality 
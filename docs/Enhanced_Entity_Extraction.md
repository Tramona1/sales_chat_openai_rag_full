# Enhanced Entity Extraction and Categorization for Sales Assistant

This document outlines the improvements made to the document processing pipeline to enhance entity extraction and categorization for the sales assistant RAG system.

## 1. URL-Based Primary Categorization

The most significant improvement is ensuring that the primary category always comes from the URL path when available. This guarantees that documents are correctly categorized based on their location in the site structure.

### Implementation Details

- **Priority to URL Path Segments**: The system first checks for explicit path segments (e.g., `/payroll/`, `/onboarding/`), which provide the strongest signal about content category.
- **Fallback to Partial Matches**: If no explicit path segment is found, the system falls back to partial matches in the URL (e.g., if "payroll" appears anywhere in the URL).
- **LLM as Final Fallback**: Only if the URL provides no useful categorization does the system use LLM-suggested categories.

This approach ensures that, for example, all content under `/payroll/` will be correctly tagged as `PAYROLL`, making it easily retrievable for sales-related queries about payroll functionality.

### Category Precedence

1. Explicit path segments (`/payroll/`, `/onboarding/`, etc.)
2. Partial URL matches ("payroll", "onboarding", etc.)
3. LLM-suggested categories
4. Default to `GENERAL` if no specific category can be determined

## 2. Enhanced Secondary Categories

The system now maintains up to three secondary categories for each document, combining insights from:

1. URL-derived secondary topics that weren't chosen as the primary category
2. LLM-suggested secondary categories (that don't duplicate the primary)

This multi-faceted approach ensures documents appear in relevant searches even when the query doesn't exactly match the primary category.

## 3. Sales-Optimized Entity Extraction

The LLM prompt for entity extraction has been significantly enhanced to support sales use cases:

### New Entity Types Added

- `INDUSTRY` - Target industries like Restaurant, Retail, Healthcare
- `COMPETITOR` - Competitor products or services like ADP, Gusto, Indeed Hire
- `INTEGRATION` - Integration partners or technologies like QuickBooks, Google Calendar
- `BENEFIT` - Business benefits like Cost Savings, Efficiency, Compliance
- `PRICING` - Pricing information, costs, ROI indicators
- `USE_CASE` - Specific use cases or customer scenarios
- `SALES_POINT` - Key selling points and value propositions

### Enhanced Prompt Design

The prompt now explicitly instructs the LLM to be comprehensive rather than minimal in entity extraction, ensuring it captures all entities that would be valuable in a sales conversation.

## 4. Sales-Focused Keyword Generation

The keyword generation process has been updated to focus on terms that would be used in customer conversations and sales enablement, making the content more discoverable in a sales context.

## 5. Categorization with Sales Context

The LLM is now prompted to identify both a primary document category and at least 2-3 secondary categories from a predefined list, ensuring consistent categorization with a focus on sales relevance.

## 6. Implementation Benefits

These enhancements deliver significant improvements to the sales assistant RAG system:

1. **More Predictable Retrieval**: URL-based categorization ensures consistent tagging, making content retrieval more predictable.
2. **Richer Metadata**: Each document now carries more comprehensive sales-relevant entity information.
3. **Better Matching**: Multiple categorization signals improve the chances of matching diverse user queries.
4. **Sales Focus**: All aspects of entity extraction are now optimized for sales conversations.

## 7. Example

For a document at URL `https://example.com/payroll/employee-experience`:

- **Primary Category**: `PAYROLL` (derived directly from URL path)
- **Secondary Categories**: May include `EMPLOYEE_EXPERIENCE`, `HR_MANAGEMENT`, etc.
- **Entities**: Will extract payroll-related organizations, features, benefits, competitors, etc.
- **Keywords**: Will focus on sales-relevant terms related to payroll features and benefits

This enhanced metadata ensures that when a sales representative asks "What are our payroll features?" or "How does our payroll compare to ADP?", the relevant content will be retrieved. 
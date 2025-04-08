# Document Management Playbook for Workstream Knowledge Assistant

## Overview

This playbook provides a comprehensive guide for adding, managing, and maintaining documents in the Workstream Knowledge Assistant. Following these procedures ensures that new knowledge is properly ingested, indexed, and made available for customer inquiries.

## Document Lifecycle

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Preparation  │────>│    Upload     │────>│    Approval   │────>│   Indexing    │
└───────────────┘     └───────────────┘     └───────────────┘     └───────────────┘
                                                                          │
┌───────────────┐     ┌───────────────┐     ┌───────────────┐            │
│  Maintenance  │<────│  Verification │<────│  Activation   │<───────────┘
└───────────────┘     └───────────────┘     └───────────────┘
```

## 1. Document Preparation

### Document Types

The knowledge base supports the following document types:
- Product documentation
- Feature specifications
- Pricing information
- Implementation guides
- Case studies
- FAQs
- Competitor comparisons
- Integration documentation
- Training materials

### Formatting Guidelines

All documents should follow these formatting standards:

1. **File Format**
   - Preferred: Markdown (.md)
   - Supported: PDF, DOCX, TXT, HTML

2. **Document Structure**
   - Clear, hierarchical headings (H1 > H2 > H3)
   - Short, focused paragraphs (3-5 sentences)
   - Bulleted lists for features and specifications
   - Tables for comparative information

3. **Metadata Requirements**
   Each document should include:
   - Title: Clear, descriptive title
   - Category: Primary classification
   - Technical Level: 1-10 scale (1=basic, 10=highly technical)
   - Last Updated: Date of last revision
   - Keywords: 5-10 relevant terms
   - Target Audience: e.g., "Sales Team", "Implementation Specialists"

### Content Best Practices

1. **Be Clear and Specific**
   - Use precise language and avoid ambiguity
   - Include specific values, prices, and measurements

2. **Prioritize Searchability**
   - Front-load important information
   - Use natural language for features and benefits
   - Include common question phrasings in FAQs

3. **Include Distinguishing Features**
   - Highlight unique selling points
   - Include competitive advantages
   - Specify industry-specific benefits

### Example Document Template

```markdown
# [Product/Feature Name]

## Overview
Brief description (2-3 sentences)

## Key Features
- Feature 1: Description and benefits
- Feature 2: Description and benefits
- Feature 3: Description and benefits

## Technical Specifications
| Specification | Value |
|---------------|-------|
| Capacity      | X     |
| Integrations  | Y     |
| Compliance    | Z     |

## Pricing Information
- Tier 1: $X/month (features included)
- Tier 2: $Y/month (features included)
- Enterprise: Custom pricing

## Implementation Details
Brief overview of implementation process and timeline

## Case Studies/Examples
Short example of successful implementation

## FAQ
Common questions and answers

## Related Documents
Links to related resources
```

## 2. Document Upload

### In-App Upload Process

1. **Access the Admin Portal**
   - Navigate to `/admin` in the application
   - Authenticate with admin credentials

2. **Navigate to Document Management**
   - Select "Knowledge Base" from the main menu
   - Click "Add New Document"

3. **Upload Document**
   - Drag and drop file or click to browse
   - Select document type
   - Wait for upload confirmation

4. **Add Metadata**
   Complete the required metadata fields:
   - Title
   - Category (select from dropdown)
   - Technical Level (1-10)
   - Target Audience
   - Keywords (comma-separated)
   - Description (brief summary)

5. **Submit for Review**
   - Click "Submit for Review"
   - System will confirm submission

### Bulk Upload Process

For multiple documents (5+):

1. **Prepare Metadata CSV**
   Create a CSV file with columns:
   - `filename` (must match exactly)
   - `title`
   - `category`
   - `technical_level`
   - `target_audience`
   - `keywords`
   - `description`

2. **Package Documents**
   - Create a ZIP file containing all documents
   - Include the metadata CSV file

3. **Bulk Upload**
   - In the admin portal, select "Bulk Upload"
   - Upload the ZIP file
   - Review the validation report
   - Confirm submission

## 3. Document Approval

### Approval Workflow

1. **Notification**
   - Reviewers receive notification of pending documents
   - Dashboard shows pending count

2. **Review Process**
   - Access document review queue in admin portal
   - Review document content and metadata
   - Use preview mode to see how document will appear

3. **Approval Checklist**
   - [ ] Content is accurate and up-to-date
   - [ ] Formatting follows guidelines
   - [ ] All required metadata is provided
   - [ ] No sensitive/confidential information included
   - [ ] Content aligns with current messaging
   - [ ] No duplicate content exists in system

4. **Decision Options**
   - Approve: Document moves to indexing
   - Request Changes: Returns to submitter with comments
   - Reject: Document is archived with reason

5. **Approval Comments**
   - Add any necessary comments for the record
   - Specify any special handling instructions

## 4. Document Indexing

### Automatic Indexing Process

Once approved, documents undergo automated processing:

1. **Document Chunking**
   - Text is extracted and divided into semantic chunks
   - Each chunk is processed separately while maintaining relationships

2. **Metadata Extraction**
   - AI systems extract and enhance document metadata
   - Entities, keywords, and categories are identified

3. **Embedding Generation**
   - Vector embeddings are created for each chunk
   - These embeddings enable semantic search functionality

4. **BM25 Index Update**
   - Text is indexed for keyword search capabilities
   - Term frequencies and importance are calculated

5. **Relationship Mapping**
   - Cross-references to related documents are established
   - Hierarchical relationships are mapped

### Technical Execution

The system executes these scripts:

```bash
# For individual documents
npm run index-document -- --file=path/to/document

# For rebuilding corpus statistics
npm run build-corpus

# For full reindexing (rare)
npm run reindex-all
```

## 5. Activation

### Making Documents Searchable

1. **Publish Step**
   - In the admin portal, navigate to "Pending Activation"
   - Review the indexing report
   - Click "Publish" to make document available

2. **Testing Period**
   - New documents enter a 24-hour testing period
   - Available in search but flagged as "New"

3. **Monitoring Initial Queries**
   - System tracks queries that match new documents
   - Review dashboard for new document performance

## 6. Verification

### Testing Document Findability

1. **Structured Testing**
   - Run predefined test queries that should find the document
   - Use the test console in admin portal

2. **Manual Testing**
   - Perform natural language queries related to the document
   - Test variations of key questions

3. **Verification Checklist**
   - [ ] Document appears in relevant search results
   - [ ] Correct sections are retrieved for specific queries
   - [ ] Summary information is accurate
   - [ ] Product details (pricing, features) are correctly returned
   - [ ] Document shows up in "Related Documents" where appropriate

4. **Result Analysis**
   - Check "Query Test Results" in admin dashboard
   - Review relevance scores and ranking

## 7. Maintenance

### Ongoing Document Management

1. **Scheduled Reviews**
   - Each document has a "Review By" date
   - System flags documents needing review
   - Priority based on importance and usage metrics

2. **Usage Analytics**
   - Monitor document retrieval frequency
   - Track effectiveness in answering queries
   - Identify information gaps from failed queries

3. **Update Process**
   - Follow same upload process for updated versions
   - System maintains version history
   - Previous versions remain available in admin portal

4. **Archiving**
   - Outdated documents should be archived, not deleted
   - Mark documents as "Historical" when replaced
   - Set "Successor Document" when applicable

## Special Document Types

### Product Documentation

Product docs require additional fields:
- Product Name
- Version/Release
- Feature Status (GA, Beta, Deprecated)
- Target Industries

### Pricing Information

Pricing docs require extra verification:
- Current as of Date
- Approval by Finance
- Expiration Date

### API Documentation

API docs need technical validation:
- Endpoint Testing
- Example Validation
- Schema Accuracy Check

## Troubleshooting

### Common Issues and Solutions

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Document not appearing in search | Indexing incomplete | Check indexing status in admin portal |
| Wrong sections retrieved | Poor document structure | Improve headings and chunking |
| Outdated information shown | Multiple versions exist | Archive old versions |
| Incorrect metadata | Extraction errors | Manually update metadata |
| Duplicated content | Similar documents | Use "Merge Documents" function |

### Getting Help

For issues with document management:
- Internal: #knowledge-base-support Slack channel
- Email: kb-admin@workstream.com
- Urgent: Contact Knowledge Base Manager

## Best Practices Summary

1. **Quality over Quantity**
   - Fewer well-structured documents > many poor ones
   - Focus on addressing specific customer questions

2. **Keep Information Current**
   - Update documents when products/policies change
   - Set calendar reminders for periodic reviews

3. **Monitor and Improve**
   - Review search logs for missed questions
   - Use feedback to refine document structure

4. **Be Customer-Question-Oriented**
   - Write from the perspective of answering questions
   - Include actual customer questions when possible

5. **Maintain Consistent Style**
   - Follow the style guide for all documents
   - Use templates for common document types

## Appendix

### Metadata Categories Reference

**Primary Categories:**
- PRODUCT
- PRICING
- TECHNICAL
- IMPLEMENTATION
- CASE_STUDY
- COMPARISON
- GENERAL
- TRAINING
- POLICY
- SUPPORT

**Technical Levels:**
- 1-3: General audience
- 4-6: Business/admin users
- 7-8: Technical implementers
- 9-10: Developers/engineers

### Script Reference

```bash
# Rebuild corpus statistics after adding multiple documents
npm run build-corpus

# Check document indexing status
npm run check-index -- --doc-id=<document_id>

# Test document retrievability
npm run test-query -- --query="<test query>" --expected-doc=<document_id>

# Export document metadata report
npm run export-metadata -- --output=report.csv
```

### Quick Reference: Document Lifecycle Status Codes

- `DRAFT`: Initial upload, not submitted
- `PENDING`: Submitted, awaiting review
- `CHANGES_REQUESTED`: Returned to submitter
- `APPROVED`: Passed review, awaiting indexing
- `INDEXING`: Being processed
- `PUBLISHED`: Active in knowledge base
- `ARCHIVED`: No longer active
- `DEPRECATED`: Replaced by newer version 
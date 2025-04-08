/**
 * Rebuild Test Data Script
 * 
 * This script updates test data to use Workstream information instead of SalesBuddy.
 * It ensures test documents, queries, and other references are consistent with the
 * actual company information we're building for (Workstream).
 */

import fs from 'fs/promises';
import path from 'path';
import { extractMetadata } from '../utils/metadataExtractor';
import { embedText } from '../utils/openaiClient';
import { addToVectorStore } from '../utils/vectorStore';
import { calculateCorpusStatistics, saveCorpusStatistics } from '../utils/bm25';

// Constants
const TEST_DATA_DIR = path.join(process.cwd(), 'test_data');
const DOCS_DIR = path.join(TEST_DATA_DIR, 'documents');
const TEST_QUERIES_PATH = path.join(TEST_DATA_DIR, 'test_queries.json');

/**
 * Update test queries to reference Workstream instead of SalesBuddy
 */
async function updateTestQueries(): Promise<void> {
  console.log('Updating test queries...');
  
  try {
    // Create default Workstream-focused test queries
    const workstreamQueries = {
      queries: [
        { text: "What are the main features of Workstream?", category: "PRODUCT", complexity: 1 },
        { text: "How do I authenticate API requests with Workstream?", category: "TECHNICAL", complexity: 3 },
        { text: "What's included in the Professional pricing tier at Workstream?", category: "PRICING", complexity: 2 },
        { text: "Tell me about Workstream's implementation timeline", category: "PRODUCT", complexity: 2 },
        { text: "How does Workstream help with hiring?", category: "FEATURES", complexity: 1 },
        { text: "What types of businesses use Workstream?", category: "CUSTOMER_CASE", complexity: 2 }
      ]
    };
    
    // Write updated queries to file
    await fs.writeFile(
      TEST_QUERIES_PATH, 
      JSON.stringify(workstreamQueries, null, 2)
    );
    
    console.log(`✅ Updated test queries at ${TEST_QUERIES_PATH}`);
  } catch (error) {
    console.error('Error updating test queries:', error);
  }
}

/**
 * Update product_overview.md to reference Workstream instead of SalesBuddy
 */
async function updateProductOverview(): Promise<void> {
  console.log('Updating product overview document...');
  
  const productOverviewPath = path.join(DOCS_DIR, 'product_overview.md');
  
  try {
    // Read existing content to see what might need to be preserved
    let existingContent = '';
    try {
      existingContent = await fs.readFile(productOverviewPath, 'utf-8');
    } catch (err) {
      console.log('No existing product overview found, will create new one.');
    }
    
    // Create updated Workstream product overview
    const workstreamOverview = `# Workstream: Platform Overview

## Company Overview

Workstream is a leading HR, Payroll, and Hiring platform designed specifically for the hourly workforce. Our mission is to help businesses streamline HR tasks, reduce labor costs, and simplify operations through smart technology. We work with many top quick-service restaurant brands, such as Burger King, Jimmy John's, and Taco Bell, to help them hire, retain, and pay their teams.

## Core Features

### 1. Hiring and Applicant Tracking
- Text-to-apply functionality for faster applicant engagement
- Automated screening and scheduling
- Mobile-first application process
- Custom hiring workflows
- Multi-location management

### 2. HR Management
- Digital onboarding and paperwork
- Document storage and compliance
- Employee self-service portal
- Time-off management
- Performance tracking

### 3. Payroll Management
- Fast and accurate payroll processing
- Tax filing and compliance
- Multiple pay rates and earning codes
- Integrations with timekeeping systems
- Direct deposit and pay card options

### 4. Communications
- Team messaging and announcements
- Automated reminders and notifications
- Shift coverage and scheduling tools
- Employee feedback collection

## Technical Architecture

Workstream is built on a modern, secure cloud infrastructure:
- Fully cloud-based SaaS platform
- Enterprise-grade security (SOC 2 compliant)
- REST API for integrations
- Mobile apps for iOS and Android
- SSO capabilities for enterprise clients

## Pricing Tiers

### Starter Plan
- $699/month (up to 100 employees)
- Core hiring functionality
- Basic HR tools
- Email support

### Professional Plan
- $1,299/month (up to 250 employees)
- Full hiring suite
- Complete HR toolkit
- Payroll processing
- Priority support

### Enterprise Plan
- $2,499/month (unlimited users)
- All Professional features
- Advanced analytics
- Custom integrations
- Dedicated account management
- 24/7 premium support

## Implementation Timeline

A typical Workstream implementation follows this timeline:
1. **Week 1**: Account setup and configuration
2. **Week 2**: Data migration and integration
3. **Week 3**: User training and testing
4. **Week 4**: Go-live and optimization

For enterprise customers, we offer a more comprehensive implementation process with additional customization.

## Customer Success Stories

### Quick Service Restaurant Chain
A national QSR chain with 200+ locations reduced time-to-hire by 65% and saw a 45% increase in applicant conversion rates within 3 months of implementing Workstream.

### Retail Brand
A retail brand with 50 locations cut HR administrative time by 70% and reduced payroll errors by 98% after switching to Workstream's integrated platform.

### Healthcare Provider
A healthcare provider with 300+ hourly employees reduced onboarding time from 2 days to 4 hours and improved employee satisfaction scores by 35%.

*Note: This document is for internal training and testing purposes only.*`;
    
    // Write updated overview to file
    await fs.writeFile(productOverviewPath, workstreamOverview);
    
    console.log(`✅ Updated product overview at ${productOverviewPath}`);
  } catch (error) {
    console.error('Error updating product overview:', error);
  }
}

/**
 * Update API documentation to reference Workstream instead of SalesBuddy
 */
async function updateApiDocumentation(): Promise<void> {
  console.log('Updating API documentation...');
  
  const apiDocPath = path.join(DOCS_DIR, 'api_documentation.md');
  
  try {
    // Create updated Workstream API documentation
    const workstreamApiDoc = `# Workstream API Documentation

## Overview

The Workstream API allows you to integrate our HR, hiring, and payroll functionality into your existing systems. This document provides details on authentication, endpoints, and example requests.

## Authentication

All API requests require an API key that should be included in the header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

To obtain an API key, contact your Workstream account manager or visit the developer settings in your dashboard.

## Base URL

\`\`\`
https://api.workstream.us/v1
\`\`\`

## Endpoints

### Applicants

#### GET /applicants

Retrieve a list of applicants with optional filtering.

**Parameters:**
- \`status\` (optional): Filter by application status (applied, screening, interviewing, hired, rejected)
- \`location_id\` (optional): Filter by location ID
- \`position_id\` (optional): Filter by position ID
- \`from_date\` (optional): Filter by application date (YYYY-MM-DD)
- \`to_date\` (optional): Filter by application date (YYYY-MM-DD)
- \`limit\` (optional): Number of results to return (default: 50, max: 100)
- \`offset\` (optional): Pagination offset (default: 0)

**Example Request:**
\`\`\`
GET https://api.workstream.us/v1/applicants?status=interviewing&limit=20
\`\`\`

#### POST /applicants

Create a new applicant record.

**Parameters:**
- \`first_name\` (required): Applicant's first name
- \`last_name\` (required): Applicant's last name
- \`email\` (required): Applicant's email address
- \`phone\` (required): Applicant's phone number
- \`position_id\` (required): ID of the position
- \`location_id\` (required): ID of the location
- \`resume\` (optional): Resume file (PDF, DOC, DOCX)
- \`cover_letter\` (optional): Cover letter text
- \`custom_fields\` (optional): Object containing custom field values

### Positions

#### GET /positions

Retrieve a list of open positions.

**Parameters:**
- \`location_id\` (optional): Filter by location ID
- \`status\` (optional): Filter by status (open, closed, draft)
- \`limit\` (optional): Number of results to return (default: 50, max: 100)
- \`offset\` (optional): Pagination offset (default: 0)

### Employees

#### GET /employees

Retrieve a list of employees.

**Parameters:**
- \`location_id\` (optional): Filter by location ID
- \`status\` (optional): Filter by status (active, terminated, on_leave)
- \`department\` (optional): Filter by department
- \`limit\` (optional): Number of results to return (default: 50, max: 100)
- \`offset\` (optional): Pagination offset (default: 0)

### Payroll

#### GET /payroll/runs

Retrieve a list of payroll runs.

**Parameters:**
- \`status\` (optional): Filter by status (pending, processing, completed, failed)
- \`from_date\` (optional): Filter by run date (YYYY-MM-DD)
- \`to_date\` (optional): Filter by run date (YYYY-MM-DD)
- \`limit\` (optional): Number of results to return (default: 50, max: 100)
- \`offset\` (optional): Pagination offset (default: 0)

## Rate Limits

The API is rate-limited to 100 requests per minute per API key. If you exceed this limit, you'll receive a 429 Too Many Requests response.

## Error Codes

- \`400\`: Bad Request - The request was invalid
- \`401\`: Unauthorized - Invalid API key
- \`403\`: Forbidden - You don't have permission to access this resource
- \`404\`: Not Found - The resource was not found
- \`429\`: Too Many Requests - You've exceeded the rate limit
- \`500\`: Internal Server Error - Something went wrong on our end

## Webhooks

Workstream can send webhooks to notify your systems of events in real-time. Available webhook events include:

- \`applicant.created\`: When a new applicant submits an application
- \`applicant.status_changed\`: When an applicant's status changes
- \`employee.hired\`: When an applicant is converted to an employee
- \`employee.terminated\`: When an employee is terminated
- \`payroll.completed\`: When a payroll run is completed

To configure webhooks, visit the Integrations section of your Workstream dashboard.

*Note: This documentation is for internal testing purposes only.*`;

    // Write updated API documentation to file
    await fs.writeFile(apiDocPath, workstreamApiDoc);
    
    console.log(`✅ Updated API documentation at ${apiDocPath}`);
  } catch (error) {
    console.error('Error updating API documentation:', error);
  }
}

/**
 * Index test documents into the vector store
 */
async function indexTestDocuments(): Promise<void> {
  console.log('Indexing test documents...');
  
  try {
    // Find all markdown files in the docs directory
    const files = await fs.readdir(DOCS_DIR);
    const docFiles = files.filter(file => file.endsWith('.md'));
    
    console.log(`Found ${docFiles.length} test documents to index`);
    
    // Process each test document
    for (const file of docFiles) {
      const filePath = path.join(DOCS_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      console.log(`Processing document: ${file}`);
      
      // Generate document ID
      const documentId = `workstream-doc-${file.replace('.md', '')}`;
      
      // Extract metadata using LLM
      console.log(`Extracting metadata for ${file}...`);
      const metadata = await extractMetadata(content, documentId);
      
      // Generate embedding
      console.log(`Generating embedding for ${file}...`);
      const embedding = await embedText(content);
      
      // Create vector store item
      const vectorItem = {
        text: content,
        embedding: embedding,
        metadata: {
          source: documentId,
          title: file.replace('.md', '').replace(/_/g, ' '),
          category: metadata.primaryCategory,
          technicalLevel: metadata.technicalLevel,
          entities: metadata.entities.map(e => e.name).join(','),
          keywords: metadata.keywords.join(','),
          summary: metadata.summary
        }
      };
      
      // Add to vector store
      await addToVectorStore(vectorItem);
      
      console.log(`✅ Indexed document: ${file}`);
    }
    
    // Update corpus statistics for BM25 search
    console.log('Updating corpus statistics...');
    const allItems = require('../utils/vectorStore').getAllVectorStoreItems();
    const corpusStats = await calculateCorpusStatistics(allItems);
    await saveCorpusStatistics(corpusStats);
    
    console.log('✅ Updated corpus statistics for BM25 search');
  } catch (error) {
    console.error('Error indexing test documents:', error);
  }
}

/**
 * Main function to run all update steps
 */
async function main(): Promise<void> {
  console.log('Starting test data rebuild process...');
  
  try {
    // Ensure test data directories exist
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
    await fs.mkdir(DOCS_DIR, { recursive: true });
    
    // Update test queries
    await updateTestQueries();
    
    // Update product overview document
    await updateProductOverview();
    
    // Update API documentation
    await updateApiDocumentation();
    
    // Index test documents
    await indexTestDocuments();
    
    console.log('\nTest data rebuild complete! ✨');
    console.log('The system now uses Workstream information instead of SalesBuddy.');
  } catch (error) {
    console.error('Error during test data rebuild:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error); 
/**
 * Process Crawl Data and Store in Supabase
 * ----------------------------------------
 * This script processes the raw data from the Universal Crawler,
 * chunks it, generates embeddings, and stores it in Supabase.
 * 
 * This script will:
 * 1. Read crawled data from a directory
 * 2. Process each document with document analysis
 * 3. Split into chunks with context
 * 4. Generate embeddings
 * 5. Store in Supabase
 * 6. Purge existing data in Supabase (optional)
 * 
 * Usage:
 * npx ts-node scripts/process_crawl_and_store.ts [input_dir] [--purge] [--limit=n]
 * 
 * Options:
 * --purge         Clear existing data in Supabase before inserting new data
 * --limit=n       Process only n files (for testing)
 * --skip-analysis Skip the document analysis step (faster, but less metadata)
 * --chunk-size=n  Set custom chunk size (default: 500)
 * 
 * Example:
 * npx ts-node scripts/process_crawl_and_store.ts ./data/crawl_data --purge --limit=10
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { TaskType } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import dotenv from "dotenv";
import { getSupabaseAdmin } from "../utils/supabaseClient";
import { DocumentCategoryType } from "../utils/documentCategories";

// --- Static Type Imports (needed for type checking) ---
import type { DocumentAnalysisResult } from '../utils/documentAnalysis.js';
import type { ContextualChunk } from '../utils/documentProcessing.js';

// Setup dirname, load dotenv etc.
// dotenv.config(); // Removed - will rely on node -r dotenv/config

// Constants
const CRAWL_DATA_DIR = path.resolve(process.cwd(), 'data/workstream_crawl_data');
const PROCESSING_BATCH_SIZE = 5;
const SUPABASE_INSERT_BATCH_SIZE = 50;
const REBUILD_LOG_PATH = path.resolve(process.cwd(), 'data/logs/rebuild_crawl_data.log');
const DEFAULT_CHUNK_SIZE = 700;
const DEFAULT_CHUNK_OVERLAP = 100;

// Ensure log directory exists
const logDir = path.dirname(REBUILD_LOG_PATH);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Simple inline logger
const logger = {
    info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
    error: (message: string | Error, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
    warning: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
    debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args),
    success: (message: string, ...args: any[]) => console.log(`[SUCCESS] ${message}`, ...args),
};

// Interface for the transformed crawl data
interface TransformedCrawlData {
  url: string;
  title: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, any>; // Optional original metadata from crawl
}

// Document context from LLM extraction (for storage)
interface DocumentContext {
  summary: string;
  entities: {
    type: string;
    text: string;
    relevance?: number;
    role?: string;
  }[];
  keywords: string[];
  suggestedCategories: {
    primary?: DocumentCategoryType;
    secondary?: DocumentCategoryType[];
    industry?: string[];
    painPoints?: string[];
    technicalFeatures?: string[];
    valuePropositions?: string[];
  };
}

// Type definitions
interface DocumentLevelContext {
  summary: string;
  named_entities: Array<{
    text: string;
    type: string;
    relevance: number;
  }>;
  keywords: string[];
  categories: string[];
  target_audience: string[];
  sales_relevance_score: number;
}

// --- Helper: Read Source Data (from JSON files in a directory) ---
function getCrawlData(loggerInstance: typeof logger, inputDir: string, startIndex: number = 0, endIndex: number = Infinity): TransformedCrawlData[] {
    const resolvedInputDir = path.resolve(process.cwd(), inputDir);
    loggerInstance.info(`Reading crawl data from directory: ${resolvedInputDir}`);
    if (!fs.existsSync(resolvedInputDir)) {
        loggerInstance.error(`Crawl data directory not found: ${resolvedInputDir}`);
        return [];
    }

    const allData: TransformedCrawlData[] = [];
    try {
        const files = fs.readdirSync(resolvedInputDir);
        let jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');
        const totalFilesFound = jsonFiles.length;
        loggerInstance.info(`Found ${totalFilesFound} JSON files in the directory.`);

        // --- Apply slicing based on indices --- 
        // Ensure indices are within bounds
        const actualStartIndex = Math.max(0, startIndex);
        const actualEndIndex = Math.min(totalFilesFound, endIndex); // endIndex is exclusive for slice

        if (actualStartIndex >= actualEndIndex) {
             loggerInstance.warning(`Start index (${startIndex}) is not before end index (${endIndex}). No files will be processed for this range.`);
             jsonFiles = [];
        } else {
            jsonFiles = jsonFiles.slice(actualStartIndex, actualEndIndex);
            loggerInstance.info(`Processing files from index ${actualStartIndex} to ${actualEndIndex - 1} (Count: ${jsonFiles.length})`);
        }
        // --- End slicing ---

        for (const file of jsonFiles) {
            const filePath = path.join(resolvedInputDir, file);
            try {
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const parsedData = JSON.parse(fileContent) as TransformedCrawlData; // Assuming each file contains one object
                // Basic validation (optional but recommended)
                if (parsedData && parsedData.url && parsedData.content) {
                     allData.push(parsedData);
                } else {
                     loggerInstance.warning(`Skipping file ${file} due to missing required fields (url, content).`);
                }
            } catch (parseError: any) {
                loggerInstance.error(`Failed to read or parse JSON file: ${filePath}`, parseError);
            }
        }
        loggerInstance.info(`Successfully read and parsed data from ${allData.length} files.`);
        return allData;
    } catch (error) {
        loggerInstance.error(`Failed to read directory: ${resolvedInputDir}`, error);
        return [];
    }
}

// --- Main Rebuild Function ---
async function rebuildVectorStore() {
    // Dynamically import functions WITH the .js extension for Node ESM runtime compatibility
    const { getEmbeddingClient } = await import('../utils/embeddingClient.js');
    // Comment out document analysis which likely depends on PDF parsing
    // const { analyzeDocument } = await import('../utils/documentAnalysis.js');
    const { splitIntoChunksWithContext, prepareTextForEmbedding } = await import('../utils/documentProcessing.js');
    const { addToVectorStore, clearVectorStore } = await import('../utils/vectorStoreFactory.js');
    const { testSupabaseConnection } = await import('../utils/supabaseClient.js');
    const { generateGeminiChatCompletion } = await import('../utils/geminiClient.js');

    logger.info('--- Starting Vector Store Rebuild from Crawl Data ---');
    logger.info(`Using Crawl Data: ${CRAWL_DATA_DIR}`);

    // Command line args parsing
    const args = process.argv.slice(2);
    const shouldPurge = args.includes('--purge');
    let fileLimit: number | undefined = undefined;
    let startIndex: number = 0;
    let endIndex: number = Infinity;
    let inputDirArg: string | null = null;

    // Find the input directory argument (doesn't start with --)
    for (const arg of args) {
        if (!arg.startsWith('--')) {
            inputDirArg = arg;
            break; // Assume first non-flag argument is the input directory
        }
    }

    if (!inputDirArg) {
        logger.error("Input directory argument is required.");
        process.exit(1);
    }

    // Parse flag arguments
    for (const arg of args) {
        if (arg.startsWith('--limit=')) {
            const value = arg.split('=')[1];
            fileLimit = value ? parseInt(value, 10) : undefined;
            logger.warning('--limit is respected but may overlap/conflict with --start-index/--end-index logic. Consider using only index args for splitting.');
        }
        if (arg.startsWith('--start-index=')) {
            const value = arg.split('=')[1];
            startIndex = value ? parseInt(value, 10) : 0;
        }
        if (arg.startsWith('--end-index=')) {
            const value = arg.split('=')[1];
            endIndex = value ? parseInt(value, 10) : Infinity;
        }
    }

    // Use the parsed input directory
    const inputDirectory = inputDirArg;
    logger.info(`Using input directory: ${inputDirectory}`);

    try {
        // --- Initialization ---
        const embeddingClient = getEmbeddingClient(); // Now available after dynamic import
        logger.info(`Using Embedding Client: ${embeddingClient.getProvider()}, Dimensions: ${embeddingClient.getDimensions()}`);
        const supabase = getSupabaseAdmin(); // Now available

        // Test Supabase connection
        const isConnected = await testSupabaseConnection(); // Now available
        if (!isConnected) {
            logger.error('Failed to connect to Supabase. Check environment variables. Aborting.');
            process.exit(1);
        } else {
            logger.info('Supabase connection verified.');
        }

        // --- Purge Data (Optional) ---
        if (shouldPurge) {
            logger.warning('--- PURGE FLAG DETECTED ---');
            logger.info('Clearing existing data from document_chunks and documents tables...');
            await clearVectorStore(); // Now available
             const { error: docDeleteError } = await supabase.from('documents').delete().neq('id', uuidv4());
             if (docDeleteError) {
                logger.error('Failed to clear documents table.', docDeleteError);
             } else {
                logger.info('Existing documents and chunks purged successfully.');
             }
        }

        // --- Load Source Data ---
        let sourceDocs = getCrawlData(logger, inputDirectory, startIndex, endIndex);
        if (sourceDocs.length === 0) {
            logger.error(new Error('No source documents found in crawl data directory for the specified index range. Aborting.'));
            process.exit(1);
        }
        logger.info(`Loaded ${sourceDocs.length} source documents to process for this instance.`);

        // Apply limit if provided (NOTE: This applies AFTER slicing by index)
        if (fileLimit && fileLimit > 0 && fileLimit < sourceDocs.length) {
            logger.info(`Applying limit: Processing only the first ${fileLimit} documents from the sliced range.`);
            sourceDocs = sourceDocs.slice(0, fileLimit);
        }

        // --- Processing Loop ---
        let processedDocsCount = 0;
        let failedDocsCount = 0;
        let totalChunksCreated = 0;

        for (let i = 0; i < sourceDocs.length; i += PROCESSING_BATCH_SIZE) {
            const batchDocs = sourceDocs.slice(i, i + PROCESSING_BATCH_SIZE);
            logger.info(`Processing document batch ${Math.floor(i / PROCESSING_BATCH_SIZE) + 1}/${Math.ceil(sourceDocs.length / PROCESSING_BATCH_SIZE)} (${batchDocs.length} docs)`);

            const batchPromises = batchDocs.map(async (doc) => {
                const docIdentifier = doc.title || doc.url;
                try {
                    // Step 1b: URL-Based Categorization
                    let derivedCategory = DocumentCategoryType.GENERAL; // Default
                    let secondaryCategories: string[] = [];
                    let industryCategories: string[] = [];
                    let painPointCategories: string[] = [];
                    let technicalFeatureCategories: string[] = [];
                    let valuePropositionCategories: string[] = [];
                    let urlPathSegments: string[] = []; // Array to store all path segments
                    
                    try {
                        const url = new URL(doc.url);
                        const urlPath = url.pathname.toLowerCase();
                        
                        // Extract all path segments for tagging
                        urlPathSegments = urlPath.split('/')
                            .filter(segment => segment.trim() !== '') // Remove empty segments
                            .map(segment => segment.replace(/-/g, '_').toUpperCase()); // Convert to tag format
                        
                        logger.info(`Extracted URL path segments: [${urlPathSegments.join(', ')}] from ${doc.url}`);
                        
                        // Primary category from URL path - Core Platform Features
                        // Priority given to specific functional categories in the path
                        if (urlPath === '/' || urlPath === '') {
                            // Special case for the homepage
                            derivedCategory = DocumentCategoryType.PRODUCT_OVERVIEW;
                        } else if (urlPath.includes('/payroll/')) {
                            derivedCategory = DocumentCategoryType.PAYROLL;
                        } else if (urlPath.includes('/onboarding/')) {
                            derivedCategory = DocumentCategoryType.ONBOARDING;
                        } else if (urlPath.includes('/compliance/')) {
                            derivedCategory = DocumentCategoryType.COMPLIANCE;
                        } else if (urlPath.includes('/scheduling/') || urlPath.includes('/shifts/')) {
                            derivedCategory = DocumentCategoryType.SCHEDULING;
                        } else if (urlPath.includes('/hiring/') || urlPath.includes('/recruiting/') || urlPath.includes('/recruitment/')) {
                            derivedCategory = DocumentCategoryType.HIRING;
                        } else if (urlPath.includes('/retention/')) {
                            derivedCategory = DocumentCategoryType.RETENTION;
                        } else if (urlPath.includes('/hr-management/') || urlPath.includes('/hr/')) {
                            derivedCategory = DocumentCategoryType.HR_MANAGEMENT;
                        } else if (urlPath.includes('/time-tracking/') || urlPath.includes('/timekeeping/')) {
                            derivedCategory = DocumentCategoryType.TIME_TRACKING;
                        } else if (urlPath.includes('/reporting/') || urlPath.includes('/analytics/')) {
                            derivedCategory = DocumentCategoryType.REPORTING;
                        } else if (urlPath.includes('/mobile/') || urlPath.includes('/app/')) {
                            derivedCategory = DocumentCategoryType.MOBILE_SOLUTIONS;
                        } else if (urlPath.includes('/platform/') || urlPath.includes('/features/') || urlPath.includes('/product/')) {
                            derivedCategory = DocumentCategoryType.DOCUMENTS;
                        } else if (urlPath === '/blog' || urlPath === '/blog/' || urlPath.startsWith('/blog/')) {
                            derivedCategory = DocumentCategoryType.BLOG;
                        } else if (urlPath === '/about' || urlPath === '/about/' || urlPath.startsWith('/about/') || 
                                   urlPath === '/team' || urlPath === '/team/' || urlPath.startsWith('/team/') || 
                                   urlPath === '/company' || urlPath === '/company/' || urlPath.startsWith('/company/')) {
                            derivedCategory = DocumentCategoryType.COMPANY_INFO;
                        } else if (urlPath === '/investors' || urlPath === '/investors/' || urlPath.startsWith('/investors/') || 
                                   urlPath === '/funding' || urlPath === '/funding/' || urlPath.startsWith('/funding/')) {
                            derivedCategory = DocumentCategoryType.GENERAL;
                        } else if (urlPath === '/pricing' || urlPath === '/pricing/' || urlPath.startsWith('/pricing/') || 
                                   urlPath === '/plans' || urlPath === '/plans/' || urlPath.startsWith('/plans/') || 
                                   urlPath === '/subscription' || urlPath === '/subscription/' || urlPath.startsWith('/subscription/')) {
                            derivedCategory = DocumentCategoryType.PRICING_INFORMATION;
                        } else if (urlPath === '/careers' || urlPath === '/careers/' || urlPath.startsWith('/careers/') || 
                                   urlPath === '/jobs' || urlPath === '/jobs/' || urlPath.startsWith('/jobs/')) {
                            derivedCategory = DocumentCategoryType.HIRING;
                        } else if (urlPath === '/agentterms' || urlPath === '/agentterms/' || urlPath.startsWith('/agentterms/') || 
                                   urlPath === '/terms' || urlPath === '/terms/' || urlPath.startsWith('/terms/') || 
                                   urlPath === '/legal' || urlPath === '/legal/' || urlPath.startsWith('/legal/') || 
                                   urlPath === '/privacy' || urlPath === '/privacy/' || urlPath.startsWith('/privacy/')) {
                            derivedCategory = DocumentCategoryType.LEGAL;
                        } else {
                            // Fall back to less specific checks if no exact path match
                            if (urlPath.includes('payroll')) {
                                derivedCategory = DocumentCategoryType.PAYROLL;
                            } else if (urlPath.includes('onboarding')) {
                                derivedCategory = DocumentCategoryType.ONBOARDING;
                            } else if (urlPath.includes('compliance')) {
                                derivedCategory = DocumentCategoryType.COMPLIANCE;
                            } else if (urlPath.includes('scheduling') || urlPath.includes('shifts') || urlPath.includes('schedule')) {
                                derivedCategory = DocumentCategoryType.SCHEDULING;
                            } else if (urlPath.includes('hiring') || urlPath.includes('recruit')) {
                                derivedCategory = DocumentCategoryType.HIRING;
                            } 
                            // Keep GENERAL as default if no match
                        }
                        
                        // Industry Vertical Detection - add as secondary categories
                        if (urlPath.includes('/restaurants/') || urlPath.includes('/hospitality/') || 
                            urlPath.includes('restaurant') || urlPath.includes('hospitality')) {
                            industryCategories.push('RESTAURANTS_HOSPITALITY');
                        }
                        if (urlPath.includes('/retail/') || urlPath.includes('retail')) {
                            industryCategories.push('RETAIL');
                        }
                        if (urlPath.includes('/healthcare/') || urlPath.includes('healthcare') || 
                            urlPath.includes('/medical/') || urlPath.includes('medical')) {
                            industryCategories.push('HEALTHCARE');
                        }
                        if (urlPath.includes('/logistics/') || urlPath.includes('/warehousing/') || 
                            urlPath.includes('logistics') || urlPath.includes('warehousing') || 
                            urlPath.includes('warehouse')) {
                            industryCategories.push('LOGISTICS_WAREHOUSING');
                        }
                        if (urlPath.includes('/manufacturing/') || urlPath.includes('manufacturing')) {
                            industryCategories.push('MANUFACTURING');
                        }
                        if (urlPath.includes('/franchise/') || urlPath.includes('franchise')) {
                            industryCategories.push('FRANCHISES');
                        }
                        if (urlPath.includes('/small-business/') || urlPath.includes('small-business') || 
                            urlPath.includes('smb')) {
                            industryCategories.push('SMALL_BUSINESS');
                        }
                        
                        // Pain Points Detection
                        if (urlPath.includes('/turnover/') || urlPath.includes('turnover') || 
                            urlPath.includes('retention') || urlPath.includes('/retention/')) {
                            painPointCategories.push('TURNOVER_REDUCTION');
                        }
                        if (urlPath.includes('/efficiency/') || urlPath.includes('efficiency') || 
                            urlPath.includes('time-saving') || urlPath.includes('time-to-hire')) {
                            painPointCategories.push('EFFICIENCY_IMPROVEMENT');
                        }
                        if (urlPath.includes('/compliance/') || urlPath.includes('compliance') || 
                            urlPath.includes('regulatory') || urlPath.includes('regulation')) {
                            painPointCategories.push('COMPLIANCE_MANAGEMENT');
                        }
                        if (urlPath.includes('/employee-experience/') || urlPath.includes('employee-experience') || 
                            urlPath.includes('employee-engagement')) {
                            painPointCategories.push('EMPLOYEE_EXPERIENCE');
                        }
                        
                        // Technical Features Detection
                        if (urlPath.includes('/ai/') || urlPath.includes('artificial-intelligence') || 
                            urlPath.includes('machine-learning') || urlPath.includes('automated')) {
                            technicalFeatureCategories.push('AI_TOOLS');
                        }
                        if (urlPath.includes('/mobile/') || urlPath.includes('mobile-app') || 
                            urlPath.includes('app') || urlPath.includes('mobile-first')) {
                            technicalFeatureCategories.push('MOBILE_SOLUTIONS');
                        }
                        if (urlPath.includes('/integrations/') || urlPath.includes('integration') || 
                            urlPath.includes('api') || urlPath.includes('connect')) {
                            technicalFeatureCategories.push('INTEGRATIONS');
                        }
                        if (urlPath.includes('/security/') || urlPath.includes('security') || 
                            urlPath.includes('encryption') || urlPath.includes('privacy')) {
                            technicalFeatureCategories.push('DATA_SECURITY');
                        }
                        
                        // Value Proposition Detection
                        if (urlPath.includes('/cost-savings/') || urlPath.includes('cost-savings') || 
                            urlPath.includes('roi') || urlPath.includes('return-on-investment')) {
                            valuePropositionCategories.push('COST_SAVINGS');
                        }
                        if (urlPath.includes('/time-savings/') || urlPath.includes('time-savings') || 
                            urlPath.includes('faster') || urlPath.includes('quick')) {
                            valuePropositionCategories.push('TIME_SAVINGS');
                        }
                        if (urlPath.includes('/scalability/') || urlPath.includes('scalability') || 
                            urlPath.includes('scale') || urlPath.includes('growth')) {
                            valuePropositionCategories.push('SCALABILITY');
                        }
                        if (urlPath.includes('/employee-retention/') || urlPath.includes('employee-retention') || 
                            urlPath.includes('reduce-turnover')) {
                            valuePropositionCategories.push('EMPLOYEE_RETENTION');
                        }
                        
                        // Look for additional Core Platform Features for secondary categories
                        // Don't repeat the primary category in secondaries
                        if (urlPath.includes('payroll') && derivedCategory !== DocumentCategoryType.PAYROLL) {
                            secondaryCategories.push(DocumentCategoryType.PAYROLL);
                        }
                        if (urlPath.includes('onboarding') && derivedCategory !== DocumentCategoryType.ONBOARDING) {
                            secondaryCategories.push(DocumentCategoryType.ONBOARDING);
                        }
                        if (urlPath.includes('compliance') && derivedCategory !== DocumentCategoryType.COMPLIANCE) {
                            secondaryCategories.push(DocumentCategoryType.COMPLIANCE);
                        }
                        if ((urlPath.includes('scheduling') || urlPath.includes('shifts')) && derivedCategory !== DocumentCategoryType.SCHEDULING) {
                            secondaryCategories.push(DocumentCategoryType.SCHEDULING);
                        }
                        if (urlPath.includes('retention') && derivedCategory !== DocumentCategoryType.RETENTION) {
                            secondaryCategories.push(DocumentCategoryType.RETENTION);
                        }
                        if ((urlPath.includes('hr') || urlPath.includes('human-resources')) && derivedCategory !== DocumentCategoryType.HR_MANAGEMENT) {
                            secondaryCategories.push(DocumentCategoryType.HR_MANAGEMENT);
                        }
                        if ((urlPath.includes('time') || urlPath.includes('timekeeping')) && derivedCategory !== DocumentCategoryType.TIME_TRACKING) {
                            secondaryCategories.push(DocumentCategoryType.TIME_TRACKING);
                        }
                        if ((urlPath.includes('mobile') || urlPath.includes('app')) && derivedCategory !== DocumentCategoryType.MOBILE_SOLUTIONS) {
                            secondaryCategories.push(DocumentCategoryType.MOBILE_SOLUTIONS);
                        }
                        if ((urlPath.includes('reporting') || urlPath.includes('analytics') || urlPath.includes('reports')) && derivedCategory !== DocumentCategoryType.REPORTING) {
                            secondaryCategories.push(DocumentCategoryType.REPORTING);
                        }
                        
                        // Feature-specific detection
                        if (urlPath.includes('job-posting') || urlPath.includes('post-job')) {
                            secondaryCategories.push('JOB_POSTING');
                        }
                        if (urlPath.includes('candidate-screening') || urlPath.includes('screening')) {
                            secondaryCategories.push('CANDIDATE_SCREENING');
                        }
                        if (urlPath.includes('interview-scheduling') || urlPath.includes('schedule-interview')) {
                            secondaryCategories.push('INTERVIEW_SCHEDULING');
                        }
                        if (urlPath.includes('background-check') || urlPath.includes('background')) {
                            secondaryCategories.push('BACKGROUND_CHECKS');
                        }
                        if (urlPath.includes('digital-signature') || urlPath.includes('esignature') || urlPath.includes('e-signature')) {
                            secondaryCategories.push('DIGITAL_SIGNATURES');
                        }
                        if (urlPath.includes('document-management') || urlPath.includes('documents')) {
                            secondaryCategories.push('DOCUMENT_MANAGEMENT');
                        }
                        if (urlPath.includes('shift-management') || urlPath.includes('shift-swap')) {
                            secondaryCategories.push('SHIFT_MANAGEMENT');
                        }
                        if (urlPath.includes('tax-form') || urlPath.includes('tax')) {
                            secondaryCategories.push('TAX_FORMS');
                        }
                        if (urlPath.includes('wotc') || urlPath.includes('tax-credit')) {
                            secondaryCategories.push('WOTC_CREDITS');
                        }
                        
                        // Limit secondary categories to 3 most specific ones
                        if (secondaryCategories.length > 3) {
                            secondaryCategories = secondaryCategories.slice(0, 3);
                        }
                        
                        // Log the results
                        logger.info(`Derived primary category '${derivedCategory}' from URL: ${doc.url}`);
                        if (secondaryCategories.length > 0) {
                            logger.info(`Derived secondary categories: [${secondaryCategories.join(', ')}]`);
                        }
                        if (industryCategories.length > 0) {
                            logger.info(`Derived industry categories: [${industryCategories.join(', ')}]`);
                        }
                        if (painPointCategories.length > 0) {
                            logger.info(`Derived pain point categories: [${painPointCategories.join(', ')}]`);
                        }
                        if (technicalFeatureCategories.length > 0) {
                            logger.info(`Derived technical feature categories: [${technicalFeatureCategories.join(', ')}]`);
                        }
                        if (valuePropositionCategories.length > 0) {
                            logger.info(`Derived value proposition categories: [${valuePropositionCategories.join(', ')}]`);
                        }
                    } catch (urlError) {
                        logger.warning(`Could not parse URL for category derivation: ${doc.url}`, urlError);
                    }
                    
                    // Step 1c: LLM Document Context Enrichment
                    let docSummary: string = "";
                    let docEntities: Array<{text: string; type: string; relevance: number}> = [];
                    let docKeywords: string[] = [];
                    let llmCategories: string[] = [];
                    let targetAudience: string[] = [];
                    let salesRelevanceScore: number = 0;
                    
                    try {
                        const contextResult = await getDocumentLevelContextFromLLM(doc.content, doc.url);
                        if (contextResult) {
                            docSummary = contextResult.summary || "";
                            docEntities = contextResult.named_entities || [];
                            docKeywords = contextResult.keywords || [];
                            llmCategories = contextResult.categories || [];
                            targetAudience = contextResult.target_audience || [];
                            salesRelevanceScore = contextResult.sales_relevance_score || 0;
                        } else {
                            logger.warning(`Could not extract document context for ${docIdentifier}`);
                        }
                    } catch (error) {
                        logger.error('Error during document enrichment:', error);
                        // Continue with empty context
                    }

                    // Create a combined category logic that intelligently merges URL and LLM-derived categories
                    const primaryCategory = (() => {
                        // First check if the LLM provided a valid category with high confidence
                        if (llmCategories.length > 0 && salesRelevanceScore >= 7) {
                            // Always prioritize high-confidence LLM categories
                            return llmCategories[0];
                        }
                        
                        // Otherwise fall back to URL-derived category if available
                        if (derivedCategory) {
                            return derivedCategory;
                        }
                        
                        // Last resort - use first LLM category or default
                        return llmCategories.length > 0 ? llmCategories[0] : DocumentCategoryType.GENERAL;
                    })();

                    // Combine secondary categories from both sources with deduplication and validation
                    const validSecondaryCategories = new Set([
                        // Start with URL-derived secondary categories
                        ...secondaryCategories,
                        // Add LLM categories (except the primary one that's already selected)
                        ...llmCategories.filter(cat => cat !== primaryCategory)
                    ]);

                    // Convert back to array and remove any empty strings
                    const combinedSecondaryCategories = Array.from(validSecondaryCategories)
                        .filter(cat => cat && cat.trim().length > 0);

                    // Log the category selection logic
                    logger.info(`Document ${docIdentifier} categorization:
                        - URL derived category: ${derivedCategory || 'N/A'} 
                        - LLM categories: ${llmCategories.join(', ') || 'N/A'}
                        - Selected primary category: ${primaryCategory}
                        - Combined secondary categories: ${combinedSecondaryCategories.join(', ') || 'None'}`);

                    // Step 2: Document Record Preparation
                    const documentRecord = {
                        title: doc.title,
                        // IMPORTANT: Remove content field to avoid inserting duplicate content
                        source: doc.url,
                        source_type: 'web_crawl',
                        metadata: { 
                            primaryCategory: primaryCategory,
                            secondaryCategories: combinedSecondaryCategories,
                            industryCategories: industryCategories,
                            painPointCategories: painPointCategories,
                            technicalFeatureCategories: technicalFeatureCategories,
                            valuePropositionCategories: valuePropositionCategories,
                            // Store URL path segments for direct access
                            urlPathSegments: urlPathSegments,
                            // No hardcoded technicalLevel or confidenceScore
                            timestamp: doc.timestamp,
                            urlDerivedCategory: derivedCategory,
                            urlDerivedSecondaryCategories: secondaryCategories,
                            urlDerivedIndustryCategories: industryCategories,
                            urlDerivedPainPointCategories: painPointCategories,
                            urlDerivedTechnicalFeatureCategories: technicalFeatureCategories,
                            urlDerivedValuePropositionCategories: valuePropositionCategories,
                            // LLM-derived data
                            llmSummary: docSummary,
                            llmEntities: docEntities,
                            llmKeywords: docKeywords,
                            llmCategories: llmCategories,
                            llmTargetAudience: targetAudience,
                            llmSalesRelevanceScore: salesRelevanceScore,
                            // Original metadata
                            crawlTimestamp: doc.timestamp,
                            ...(doc.metadata || {})
                        }
                    };

                    // Step 3: Chunking
                    const documentContext = {
                        summary: docSummary,
                        mainTopics: docKeywords,
                        entities: docEntities.map(e => e.text),
                        documentType: "web_content",
                        technicalLevel: salesRelevanceScore > 7 ? 2 : 1, // Simple heuristic
                        audienceType: targetAudience
                    };
                    
                    const chunks: ContextualChunk[] = await splitIntoChunksWithContext(
                        doc.content,
                        DEFAULT_CHUNK_SIZE,
                        doc.url,
                        true,
                        documentContext
                    );
                    logger.info(`Created ${chunks.length} chunks for: ${docIdentifier}`);

                    if (chunks.length === 0) {
                        logger.warning(`No chunks generated for document: ${docIdentifier}`);
                        return { success: true, document: documentRecord, chunks: [] };
                    }

                    // Step 4: Prepare Text for Embedding - IMPORTANT: Only use raw chunk text
                    const textsToEmbed = chunks.map(chunk => chunk.text); // Use original chunk text without any processing

                    // Step 5: Generate Embeddings
                    const embeddings = await embeddingClient.embedBatch(textsToEmbed, TaskType.RETRIEVAL_DOCUMENT);
                    logger.info(`Generated ${embeddings.length} embeddings for ${docIdentifier}`);

                    // Step 6: Prepare Chunk Records with enhanced metadata
                    const chunkRecords = chunks.map((chunk, index) => {
                        if (!embeddings[index] || embeddings[index].length !== embeddingClient.getDimensions()) {
                            logger.error(`Invalid embedding generated for chunk ${index} of ${docIdentifier}. Skipping chunk.`);
                            return null;
                        }
                        return {
                            chunk_index: index,
                            embedding: embeddings[index],
                            original_text: chunk.text, // Keep original text here
                            text: chunk.text,          // Store the clean chunk text (that was embedded) here
                            metadata: {
                                ...(chunk.metadata || {}),
                                // Add URL path segments to chunk metadata
                                urlPathSegments: urlPathSegments,
                                // Categories from URL and LLM
                                primaryCategory: primaryCategory,
                                secondaryCategories: combinedSecondaryCategories,
                                industryCategories: industryCategories,
                                painPointCategories: painPointCategories,
                                technicalFeatureCategories: technicalFeatureCategories,
                                valuePropositionCategories: valuePropositionCategories,
                                // URL-derived metadata
                                urlDerivedCategory: derivedCategory,
                                urlDerivedSecondaryCategories: secondaryCategories,
                                urlDerivedIndustryCategories: industryCategories,
                                urlDerivedPainPointCategories: painPointCategories,
                                urlDerivedTechnicalFeatureCategories: technicalFeatureCategories,
                                urlDerivedValuePropositionCategories: valuePropositionCategories,
                                // Document-level LLM context
                                docSummary: docSummary,
                                docEntities: docEntities,
                                llmKeywords: docKeywords,
                                llmCategories: llmCategories,
                                llmTargetAudience: targetAudience,
                                salesRelevanceScore: salesRelevanceScore,
                            },
                            context: chunk.metadata?.context || {},
                        };
                    }).filter(record => record !== null);

                     if (chunkRecords.length !== chunks.length) {
                        logger.warning(`Skipped ${chunks.length - chunkRecords.length} chunks due to embedding issues for ${docIdentifier}`);
                    }

                    totalChunksCreated += chunkRecords.length;
                    return { success: true, document: documentRecord, chunks: chunkRecords };

                } catch (error: any) {
                    logger.error(`Failed to process document: ${docIdentifier}`, error);
                    return { success: false, document: { title: docIdentifier, source: doc.url }, chunks: [] };
                }
            });

            const batchResults = await Promise.all(batchPromises);

            // --- Insert into Supabase ---
            const successfulResults = batchResults.filter(r => r.success);
            const failedResults = batchResults.filter(r => !r.success);
            failedDocsCount += failedResults.length;
            if(failedResults.length > 0){
                 logger.warning(`Failed to process ${failedResults.length} documents in this batch.`);
                 failedResults.forEach(fr => logger.debug(`Failed doc source: ${fr.document.source}`));
            }

            const documentsToInsert = successfulResults.map(r => r.document);

            if (documentsToInsert.length > 0) {
                logger.info(`Inserting ${documentsToInsert.length} document records for batch...`);
                // Insert documents first to get their IDs
                const { data: insertedDocs, error: docInsertError } = await supabase
                    .from('documents')
                    .insert(documentsToInsert)
                    .select('id, source'); // Select ID and source to map chunks

                if (docInsertError) {
                    logger.error(`Failed to insert document batch`, docInsertError);
                    // Mark all docs in this batch as failed that were intended for insert
                    failedDocsCount += documentsToInsert.length; // Increment failures
                } else if (insertedDocs && insertedDocs.length > 0) {
                    logger.success(`Inserted ${insertedDocs.length} document records.`);
                    processedDocsCount += insertedDocs.length;
                    failedDocsCount += (documentsToInsert.length - insertedDocs.length); // Account for partial insert failures if any

                    // Map document IDs back to their chunks
                    const docIdMap = new Map(insertedDocs.map(d => [d.source, d.id]));
                    const chunksToInsertForBatch = successfulResults
                        .filter(r => r.chunks.length > 0) // Only results with chunks
                        .flatMap(r => {
                            const docId = docIdMap.get(r.document.source);
                            if (!docId) {
                                // This case should be rare if doc insert succeeded and we selected source
                                logger.warning(`Could not find inserted document ID for source: ${r.document.source}. Skipping ${r.chunks.length} chunks.`);
                                failedDocsCount++; // Count the parent doc as failed if we can't link chunks
                                return []; // Skip chunks if parent doc insert failed or wasn't found
                            }
                            // Assign the parent document_id to each chunk
                            return r.chunks.map(chunk => ({ ...chunk, document_id: docId }));
                        });

                    if (chunksToInsertForBatch.length > 0) {
                         logger.info(`Preparing to insert ${chunksToInsertForBatch.length} chunks for batch...`);

                        // Insert chunks in smaller batches using the factory/Supabase client
                        for (let j = 0; j < chunksToInsertForBatch.length; j += SUPABASE_INSERT_BATCH_SIZE) {
                            const chunkInsertBatch = chunksToInsertForBatch.slice(j, j + SUPABASE_INSERT_BATCH_SIZE);
                            try {
                                // --- Add Logging Here ---
                                if (chunkInsertBatch.length > 0) {
                                    logger.debug('Metadata being sent to addToVectorStore (first chunk):', chunkInsertBatch[0].metadata);
                                }
                                // --- End Logging ---

                                // Use the factory pattern to add chunks
                                await addToVectorStore(chunkInsertBatch); // This calls insertDocumentChunks internally
                                logger.info(`Inserted chunk batch ${Math.floor(j / SUPABASE_INSERT_BATCH_SIZE) + 1}/${Math.ceil(chunksToInsertForBatch.length / SUPABASE_INSERT_BATCH_SIZE)}`);
                            } catch (chunkInsertError: any) {
                                logger.error(`Failed to insert chunk batch (Size: ${chunkInsertBatch.length}). Error: ${chunkInsertError.message || chunkInsertError}`, chunkInsertError);
                                // Decide how to handle partial failures - log or retry? Logging for now.
                                // Could mark corresponding docs as failed?
                            }
                        }
                        logger.success(`Finished inserting chunks for document batch.`);
                    } else {
                         logger.info('No valid chunks to insert for this batch.');
                    }
                } else {
                     logger.warning('Document insert operation returned no data or error. Assuming failure.');
                     failedDocsCount += documentsToInsert.length;
                }
            } else {
                logger.info(`No successful documents to insert in this batch.`);
                 // Failed count already incremented earlier
            }
            logger.info(`Batch Complete. Processed Docs: ${processedDocsCount}, Failed Docs: ${failedDocsCount}, Total Chunks Added: ${totalChunksCreated}`);
        } // End of batch loop

        logger.info('--- Verification ---');
        try {
            const { count: finalDocCount, error: finalDocError } = await supabase.from('documents').select('*', { count: 'exact', head: true });
            const { count: finalChunkCount, error: finalChunkError } = await supabase.from('document_chunks').select('*', { count: 'exact', head: true });

            if (finalDocError || finalChunkError) {
                 logger.error('Could not get final counts from Supabase.', { finalDocError, finalChunkError });
            } else {
                 logger.info(`Final Supabase counts - Documents: ${finalDocCount}, Chunks: ${finalChunkCount}`);
            }
        } catch (verificationError) {
             logger.error('Error during final Supabase count verification.', verificationError);
        }

        logger.success('--- Vector Store Rebuild Completed ---');
        logger.info(`Total Documents Processed Attempted: ${sourceDocs.length}`);
        logger.info(`Total Documents Successfully Inserted: ${processedDocsCount}`);
        logger.info(`Total Documents Failed: ${failedDocsCount}`);
        logger.info(`Total Chunks Created & Inserted: ${totalChunksCreated}`);

    } catch (error: any) {
        logger.error('--- FATAL ERROR during vector store rebuild ---', error);
        process.exit(1);
    }
}

// --- Helper: Get Document-level context from LLM ---
export async function getDocumentLevelContextFromLLM(
  text: string,
  source: string
): Promise<DocumentLevelContext> {
  let truncatedText = text;
  if (text.length > 18000) {
    console.log("Text is too long, truncating to 18000 chars for LLM analysis");
    truncatedText = text.substring(0, 18000); // For performance and cost reasons
  }

  // Enhanced prompt with clearer category definitions and improved structure
  const prompt = `You are an AI assistant specializing in sales content analysis for a company called Workstream that offers hiring, HR, payroll, and workforce management solutions for hourly workers.

Review the following document carefully and extract key information for categorization. This document comes from the source: ${source}

${truncatedText}

Based on the document above, provide the following information in a structured JSON format:

1. A concise, informative summary (100-150 words maximum) that captures the main points.

2. Named entities with their types, categorized as follows:
   - person: Names of individuals mentioned (e.g., "Desmond Lim", "John Smith")
   - organization: Company names or organizational entities (e.g., "Workstream", "Burger King")
   - product: Specific products (e.g., "Workstream Platform", "Text-to-Apply")
   - feature: Product features (e.g., "Shift Scheduling", "Candidate Screening")
   - price: Any pricing information or cost-related details (e.g., "$50 per month", "20% discount")
   - industry: Industry sectors (e.g., "Restaurant", "Retail", "Healthcare") 
   - competitor: Competitive products or companies (e.g., "ADP", "Gusto")
   - technology: Technologies mentioned (e.g., "AI", "SMS", "API")

3. The 5-8 most relevant keywords for search and categorization.

4. Document categorization using these specific categories:
   PRIMARY CATEGORIES (choose exactly ONE):
   - HIRING: Content primarily about recruitment, applicant tracking, candidate sourcing
   - ONBOARDING: Content about employee onboarding, paperwork, training new hires
   - HR_MANAGEMENT: General HR functions, employee records, HR administration
   - PAYROLL: Content about payroll processing, taxes, wages, payment methods
   - COMPLIANCE: Content about legal requirements, regulations, policy compliance
   - SCHEDULING: Content about shift scheduling, time management, workforce scheduling
   - PRODUCT_OVERVIEW: General product information and platform descriptions
   - BLOG: Blog posts, articles, thought leadership content
   - PRICING_INFORMATION: Content specifically discussing prices, plans, costs
   - CUSTOMER_TESTIMONIALS: Customer success stories, testimonials, case studies
   - LEGAL: Terms of service, privacy policies, legal documents
   - COMPANY_INFO: Information about the company, team, mission, values

   SECONDARY CATEGORIES (select 2-3 most relevant):
   - TEXT_TO_APPLY: Content about text-based job applications
   - BACKGROUND_CHECKS: Content about background screening, verification
   - SHIFT_MANAGEMENT: Content about managing shifts, shift swapping
   - DIGITAL_SIGNATURES: Content about electronic document signing
   - MOBILE_SOLUTIONS: Content about mobile apps, mobile-first approaches
   - REPORTING: Content about analytics, reporting, data insights
   - TIME_TRACKING: Content about time clocks, attendance tracking
   - TAX_COMPLIANCE: Content about tax regulations, compliance
   - EMPLOYEE_RETENTION: Content about reducing turnover, keeping employees
   - EMPLOYEE_ENGAGEMENT: Content about improving employee satisfaction
   - COMPETITIVE_ANALYSIS: Comparisons with competitors or alternatives

5. Target audience: Identify exactly who this content is meant for (e.g., "HR managers", "franchise owners", "small business operators")

6. Sales relevance: Rate this document on a scale of 1-10 for its relevance in sales conversations, with 10 being extremely valuable.

IMPORTANT: Return ONLY valid JSON with NO explanation text. The JSON must include ALL the fields described above.`;

  // Define the expected schema with more detailed requirements
  const responseSchema = {
    summary: "string",
    named_entities: [{
      text: "string",
      type: "string",
      relevance: "number"
    }],
    keywords: ["string"],
    categories: ["string"],
    target_audience: ["string"],
    sales_relevance_score: "number"
  };

  try {
    // Import the generateStructuredGeminiResponse function
    const { generateStructuredGeminiResponse } = await import('../utils/geminiClient.js');
    
    // Use a more specific system prompt to get better structured data
    const systemPrompt = "You are a document analysis specialist for a workforce management company called Workstream. Analyze the document and extract structured information following the requested JSON format exactly. Be precise in your categorization based on the detailed category definitions provided.";
    
    // Add retry logic for better error handling
    let retryCount = 0;
    const maxRetries = 2;
    let result = null;
    
    while (retryCount <= maxRetries && !result) {
      try {
        result = await generateStructuredGeminiResponse(
          systemPrompt,
          prompt,
          responseSchema
        );
        
        // Validate the response has the required fields
        if (!result || !result.summary || !Array.isArray(result.categories) || result.categories.length === 0) {
          console.warn(`Incomplete response from LLM on attempt ${retryCount + 1}, retrying...`);
          result = null;
          retryCount++;
        }
      } catch (retryError) {
        console.error(`Error on LLM attempt ${retryCount + 1}:`, retryError);
        retryCount++;
        if (retryCount > maxRetries) throw retryError;
      }
    }
    
    if (!result) {
      console.warn("Empty or invalid response from Gemini after retries");
      return {
        summary: "",
        named_entities: [],
        keywords: [],
        categories: [],
        target_audience: [],
        sales_relevance_score: 0
      };
    }

    // --- Enhanced validation and normalization of results
    const normalizedCategories = Array.isArray(result.categories) 
      ? result.categories.map((c: any) => typeof c === 'string' ? c.trim().toUpperCase() : '')
          .filter((c: string) => c.length > 0)
      : [];
      
    if (normalizedCategories.length === 0) {
      console.warn("No valid categories returned by LLM");
    }
    
    // Ensure named entities are properly formatted
    const validatedEntities = Array.isArray(result.named_entities)
      ? result.named_entities.filter((e: any) => e && e.text && e.type)
      : [];
      
    // Ensure the object has all expected fields with proper validation
    return {
      summary: typeof result.summary === 'string' ? result.summary : "",
      named_entities: validatedEntities,
      keywords: Array.isArray(result.keywords) ? result.keywords.filter((k: any) => k) : [],
      categories: normalizedCategories,
      target_audience: Array.isArray(result.target_audience) ? result.target_audience.filter((t: any) => t) : [],
      sales_relevance_score: typeof result.sales_relevance_score === 'number' ? result.sales_relevance_score : 0
    };
    
  } catch (error) {
    console.error("Error calling Gemini for document analysis:", error);
    return {
      summary: "",
      named_entities: [],
      keywords: [],
      categories: [],
      target_audience: [],
      sales_relevance_score: 0
    };
    }
}

// --- Run the rebuild ---
rebuildVectorStore(); 
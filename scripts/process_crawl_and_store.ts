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

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Keep external/built-in imports static
import { TaskType } from '@google/generative-ai';
// Revert uuid import back to named export
import { v4 as uuidv4 } from 'uuid';

// --- Static Type Imports (needed for type checking) ---
// Keep .js extension for type imports if needed by your setup, or remove if not.
// These often work fine either way depending on TS version and settings.
import type { DocumentAnalysisResult } from '../utils/documentAnalysis.js';
import type { ContextualChunk } from '../utils/documentProcessing.js';

// --- Core Utility function imports will be done dynamically below ---

// Setup dirname, load dotenv etc.
// dotenv.config(); // Removed - will rely on node -r dotenv/config

// Constants
const CRAWL_DATA_DIR = path.resolve(process.cwd(), 'data/workstream_crawl_data');
const PROCESSING_BATCH_SIZE = 5;
const SUPABASE_INSERT_BATCH_SIZE = 50;
const REBUILD_LOG_PATH = path.resolve(process.cwd(), 'data/logs/rebuild_crawl_data.log');
const DEFAULT_CHUNK_SIZE = 500;
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
    const { analyzeDocument } = await import('../utils/documentAnalysis.js');
    const { splitIntoChunksWithContext, prepareTextForEmbedding } = await import('../utils/documentProcessing.js');
    const { addToVectorStore, clearVectorStore } = await import('../utils/vectorStoreFactory.js');
    const { getSupabaseAdmin, testSupabaseConnection } = await import('../utils/supabaseClient.js');

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
                    // Step 1: Document Analysis - Use the static type import here
                    const analysisResult: DocumentAnalysisResult = await analyzeDocument(doc.content, doc.url, { useCaching: false });
                    logger.info(`Analyzed content for: ${docIdentifier}`);

                    // Step 1b: Image Processing (Placeholder)
                    const processedVisuals: any[] = [];

                    // Step 2: Document Record Preparation (Type annotation works now)
                    const documentRecord = {
                         title: doc.title || analysisResult.title || 'Untitled',
                        source: doc.url,
                        file_path: null,
                        category: analysisResult.primaryCategory,
                        technical_level: analysisResult.technicalLevel,
                        approved: true,
                        review_status: 'approved',
                        approved_at: new Date().toISOString(),
                        document_summary: analysisResult.summary,
                        primary_topics: analysisResult.keyTopics,
                        document_type: analysisResult.documentContext?.documentType || 'webpage',
                        audience_type: analysisResult.documentContext?.audienceType || ['general'],
                        content_hash: (analysisResult as any).contentHash,
                        metadata: { 
                            primaryCategory: analysisResult.primaryCategory,
                            secondaryCategories: analysisResult.secondaryCategories,
                            confidenceScore: analysisResult.confidenceScore,
                            keyTopics: analysisResult.keyTopics,
                            keywords: analysisResult.keywords,
                            entities: analysisResult.entities,
                            qualityFlags: analysisResult.qualityFlags,
                            routingPriority: analysisResult.routingPriority,
                            crawlTimestamp: doc.timestamp,
                            sourceType: 'web_crawl',
                            ...(doc.metadata || {})
                        }
                    };

                    // Step 3: Chunking - Use the static type import here
                    const chunks: ContextualChunk[] = await splitIntoChunksWithContext(
                        doc.content,
                        DEFAULT_CHUNK_SIZE,
                        doc.url,
                        true,
                        analysisResult.documentContext
                    );
                    logger.info(`Created ${chunks.length} chunks for: ${docIdentifier}`);

                    if (chunks.length === 0) {
                        logger.warning(`No chunks generated for document: ${docIdentifier}`);
                        return { success: true, document: documentRecord, chunks: [] };
                    }

                    // Step 4: Prepare Text for Embedding - REMOVED
                    // const preparedTexts = chunks.map(chunk => prepareTextForEmbedding(chunk));
                    const textsToEmbed = chunks.map(chunk => chunk.text); // Use original chunk text

                    // Step 5: Generate Embeddings
                    const embeddings = await embeddingClient.embedBatch(textsToEmbed, TaskType.RETRIEVAL_DOCUMENT);
                    logger.info(`Generated ${embeddings.length} embeddings for ${docIdentifier}`);

                    // Step 6: Prepare Chunk Records
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
                                primaryCategory: analysisResult.primaryCategory,
                                secondaryCategories: analysisResult.secondaryCategories,
                                technicalLevel: analysisResult.technicalLevel,
                                keywords: analysisResult.keywords,
                                entities: analysisResult.entities,
                                qualityFlags: analysisResult.qualityFlags,
                                confidenceScore: analysisResult.confidenceScore,
                                routingPriority: analysisResult.routingPriority,
                            },
                            context: chunk.metadata?.context || {},
                            // visual_content: processedVisuals.length > 0 ? processedVisuals : null // Commented out as visuals aren't used
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

// --- Run the rebuild ---
rebuildVectorStore(); 
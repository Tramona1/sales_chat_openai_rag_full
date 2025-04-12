/**
 * Migration Script: Upgrade Existing Documents to Multi-Modal Context
 * 
 * This script:
 * 1. Processes all existing documents in the vector store
 * 2. Extracts and analyzes images from PDFs and other documents
 * 3. Creates multi-modal chunks with visual context information
 * 4. Generates embeddings using Gemini for all content
 * 5. Updates the vector store with enhanced multi-modal data
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import fs from 'fs';
import path from 'path';

// Setup dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Set default batch size
const DEFAULT_BATCH_SIZE = 10;

// Migration progress file path
const MIGRATION_PROGRESS_FILE = join(process.cwd(), 'data', 'multimodal_migration_progress.json');

// Directory for extracted images
const IMAGES_DIR = join(process.cwd(), 'data', 'extracted_images');

// CONSOLE OUTPUT UTILITIES
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

const log = {
  info: (message) => console.log(`${colors.blue}[INFO]${colors.reset} ${message}`),
  success: (message) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`),
  error: (message) => console.log(`${colors.red}[ERROR]${colors.reset} ${message}`),
  warning: (message) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`),
  header: (message) => console.log(`\n${colors.bright}${colors.cyan}==== ${message} ====${colors.reset}\n`)
};

// MIGRATION PROGRESS TRACKING
/**
 * @typedef {Object} MigrationProgress
 * @property {string} startedAt - ISO timestamp when migration started
 * @property {string} [completedAt] - ISO timestamp when migration completed
 * @property {number} totalDocuments - Total number of documents to process
 * @property {number} processedDocuments - Number of documents processed so far
 * @property {number} multiModalDocuments - Number of documents with visual content
 * @property {number} extractedImages - Total number of images extracted
 * @property {number} errorDocuments - Number of documents with errors
 * @property {Array<Object>} batches - Tracking for each batch
 */

/**
 * Initialize migration progress tracking
 */
function initializeProgress() {
  if (!fs.existsSync(path.dirname(MIGRATION_PROGRESS_FILE))) {
    fs.mkdirSync(path.dirname(MIGRATION_PROGRESS_FILE), { recursive: true });
  }
  
  const progress = {
    startedAt: new Date().toISOString(),
    totalDocuments: 0,
    processedDocuments: 0,
    multiModalDocuments: 0,
    extractedImages: 0,
    errorDocuments: 0,
    batches: []
  };
  
  fs.writeFileSync(MIGRATION_PROGRESS_FILE, JSON.stringify(progress, null, 2));
  return progress;
}

/**
 * Update migration progress
 */
function updateProgress(progress) {
  fs.writeFileSync(MIGRATION_PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Get document batches from the vector store
 */
function getDocumentBatches() {
  // In a real implementation, you would query your vector store
  // for batches of documents. This is a simplified example.
  const dataDir = join(process.cwd(), 'data', 'vector_batches');
  
  if (!fs.existsSync(dataDir)) {
    log.warning(`Vector batches directory not found: ${dataDir}`);
    return [];
  }
  
  return fs.readdirSync(dataDir)
    .filter(file => file.endsWith('.json'))
    .map(file => join(dataDir, file));
}

/**
 * Load documents from a batch file
 */
function loadBatchDocuments(batchPath) {
  try {
    const content = fs.readFileSync(batchPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    log.error(`Failed to load batch from ${batchPath}: ${error.message}`);
    return [];
  }
}

/**
 * Process a single document for multi-modal content
 */
async function processDocumentForMultiModal(document) {
  const startTime = Date.now();
  
  try {
    // Import necessary modules
    const { analyzeDocumentVisuals } = await import('../utils/multiModalProcessing.js');
    const { createMultiModalChunks, generateMultiModalEmbeddings } = await import('../utils/multiModalProcessing.js');
    
    log.info(`Processing document: ${document.metadata?.source || 'Unknown'}`);
    
    // First, check if there's a source file to analyze
    const sourcePath = document.metadata?.source;
    if (!sourcePath) {
      log.warning('Document has no source path, skipping multi-modal processing');
      return {
        ...document,
        metadata: {
          ...document.metadata,
          multiModalProcessed: true,
          hasVisualContent: false
        }
      };
    }
    
    // Determine if this is a file type that might have images
    const fileExt = path.extname(sourcePath).toLowerCase();
    const supportedExtensions = ['.pdf', '.docx', '.pptx', '.jpg', '.jpeg', '.png'];
    
    if (!supportedExtensions.includes(fileExt)) {
      log.info(`Document type ${fileExt} not supported for multi-modal processing, skipping`);
      return {
        ...document,
        metadata: {
          ...document.metadata,
          multiModalProcessed: true,
          hasVisualContent: false
        }
      };
    }
    
    // For demonstration purposes, let's assume we already have the file stored locally
    // In a real implementation, you might need to retrieve it from storage
    const documentPath = join(process.cwd(), 'data', 'uploads', path.basename(sourcePath));
    
    // Create the image storage directory if it doesn't exist
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
    
    // First, extract and analyze visuals from the document
    log.info(`Analyzing visuals in document: ${sourcePath}`);
    const visualAnalysis = await analyzeDocumentVisuals(documentPath);
    
    // If no visuals found, return the document unchanged but mark as processed
    if (visualAnalysis.images.length === 0) {
      log.info(`No visuals found in document: ${sourcePath}`);
      return {
        ...document,
        metadata: {
          ...document.metadata,
          multiModalProcessed: true,
          hasVisualContent: false
        }
      };
    }
    
    // If we found visuals, proceed with multi-modal chunking
    log.success(`Found ${visualAnalysis.images.length} visuals in document.`);
    log.info(`Creating multi-modal chunks for document: ${sourcePath}`);
    
    // Create multi-modal chunks
    const multiModalChunks = await createMultiModalChunks(
      document.text,
      visualAnalysis.images.map(img => ({
        path: img.path,
        page: img.page
      })),
      sourcePath
    );
    
    // Generate embeddings for the chunks
    log.info(`Generating embeddings for ${multiModalChunks.length} multi-modal chunks`);
    const chunksWithEmbeddings = await generateMultiModalEmbeddings(multiModalChunks);
    
    // Return the updated document with multi-modal chunks
    return {
      ...document,
      multiModalChunks: chunksWithEmbeddings,
      metadata: {
        ...document.metadata,
        multiModalProcessed: true,
        hasVisualContent: true,
        visualCount: visualAnalysis.images.length,
        hasCharts: visualAnalysis.hasCharts,
        hasTables: visualAnalysis.hasTables,
        hasDiagrams: visualAnalysis.hasDiagrams,
        processingTime: Date.now() - startTime
      }
    };
  } catch (error) {
    log.error(`Failed to process document for multi-modal content: ${error.message}`);
    console.error(error);
    
    // Return the document marked as having an error
    return {
      ...document,
      metadata: {
        ...document.metadata,
        multiModalProcessed: false,
        multiModalError: error.message
      }
    };
  }
}

/**
 * Save processed documents back to the vector store
 */
async function saveProcessedBatch(batchPath, documents) {
  try {
    // In a real implementation, you would update your vector store
    // This is a simplified example that just writes back to the file
    const outputPath = batchPath.replace('.json', '_multimodal.json');
    fs.writeFileSync(outputPath, JSON.stringify(documents, null, 2));
    log.success(`Saved processed batch to ${outputPath}`);
    return true;
  } catch (error) {
    log.error(`Failed to save processed batch: ${error.message}`);
    return false;
  }
}

/**
 * Main migration function
 */
async function migrateToMultiModal(batchSize = DEFAULT_BATCH_SIZE) {
  // Initialize progress tracking
  let progress = initializeProgress();
  
  // Ensure the images directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
  
  try {
    // Get all document batches
    const batchPaths = getDocumentBatches();
    progress.totalDocuments = batchPaths.length;
    updateProgress(progress);
    
    if (batchPaths.length === 0) {
      log.warning('No document batches found to process');
      progress.completedAt = new Date().toISOString();
      updateProgress(progress);
      return;
    }
    
    log.header(`Starting Multi-Modal Migration`);
    log.info(`Found ${batchPaths.length} batches to process`);
    log.info(`Processing in batches of ${batchSize}`);
    log.info(`Images will be stored in ${IMAGES_DIR}`);
    
    // Process batches sequentially to avoid memory issues
    for (let i = 0; i < batchPaths.length; i += batchSize) {
      const currentBatchPaths = batchPaths.slice(i, i + batchSize);
      
      log.header(`Processing Batch ${i / batchSize + 1} of ${Math.ceil(batchPaths.length / batchSize)}`);
      
      // Initialize batch tracking
      const batchTracking = {
        batchId: `batch_${i}_${i + currentBatchPaths.length}`,
        startedAt: new Date().toISOString(),
        totalDocuments: currentBatchPaths.length,
        processedDocuments: 0,
        multiModalDocuments: 0,
        errorDocuments: 0,
        status: 'in-progress'
      };
      
      progress.batches.push(batchTracking);
      updateProgress(progress);
      
      // Process each batch file
      for (const batchPath of currentBatchPaths) {
        log.info(`Processing batch file: ${path.basename(batchPath)}`);
        const documents = loadBatchDocuments(batchPath);
        
        if (documents.length === 0) {
          log.warning(`No documents found in batch: ${batchPath}`);
          continue;
        }
        
        log.info(`Found ${documents.length} documents in batch`);
        
        // Process documents in the batch
        const processedDocuments = [];
        for (let j = 0; j < documents.length; j++) {
          const document = documents[j];
          log.info(`Processing document ${j + 1}/${documents.length}`);
          
          // Process the document
          const processedDocument = await processDocumentForMultiModal(document);
          processedDocuments.push(processedDocument);
          
          // Update batch tracking
          batchTracking.processedDocuments++;
          if (processedDocument.metadata?.hasVisualContent) {
            batchTracking.multiModalDocuments++;
            progress.multiModalDocuments++;
            if (processedDocument.metadata?.visualCount) {
              progress.extractedImages += processedDocument.metadata.visualCount;
            }
          }
          if (processedDocument.metadata?.multiModalError) {
            batchTracking.errorDocuments++;
            progress.errorDocuments++;
          }
          
          // Update overall progress
          progress.processedDocuments++;
          updateProgress(progress);
        }
        
        // Save the processed batch back to the vector store
        await saveProcessedBatch(batchPath, processedDocuments);
      }
      
      // Update batch tracking
      batchTracking.completedAt = new Date().toISOString();
      batchTracking.status = 'completed';
      updateProgress(progress);
    }
    
    // Migration complete
    progress.completedAt = new Date().toISOString();
    updateProgress(progress);
    
    log.header(`Multi-Modal Migration Complete`);
    log.success(`Processed ${progress.processedDocuments} documents`);
    log.success(`Found ${progress.multiModalDocuments} documents with visual content`);
    log.success(`Extracted ${progress.extractedImages} images`);
    if (progress.errorDocuments > 0) {
      log.warning(`Encountered errors in ${progress.errorDocuments} documents`);
    }
    
  } catch (error) {
    log.error(`Migration failed: ${error.message}`);
    console.error(error);
    
    // Update progress with error
    progress.error = error.message;
    progress.completedAt = new Date().toISOString();
    updateProgress(progress);
  }
}

// Run the migration if this script is called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const batchSize = process.argv[2] ? parseInt(process.argv[2]) : DEFAULT_BATCH_SIZE;
  migrateToMultiModal(batchSize)
    .then(() => {
      log.info('Migration script completed');
      process.exit(0);
    })
    .catch(error => {
      log.error(`Unhandled error in migration script: ${error.message}`);
      console.error(error);
      process.exit(1);
    });
}

export { migrateToMultiModal }; 
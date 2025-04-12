/**
 * Vision Document Analyzer
 * 
 * This utility uses Gemini Vision to directly analyze PDFs and PowerPoints,
 * extracting both text and visual content more accurately than traditional parsers.
 * It can process pages/slides individually, maintain layout, and properly analyze
 * embedded charts, diagrams, tables, and images.
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import os from 'os';
import dotenv from 'dotenv';
import pdf from 'pdf-parse';
import { recordMetric } from './performanceMonitoring.js';

// Set up ES module path handling
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set up environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Import perf monitoring if available
async function importMonitoring() {
  try {
    return await import('./performanceMonitoring.js');
  } catch (e) {
    return {
      recordMetric: () => {} // Noop function if monitoring not available
    };
  }
}

// Import PDF lib for splitting
let pdfLib;
try {
  pdfLib = await import('pdf-lib');
} catch (e) {
  console.warn('pdf-lib not available, PDF splitting will use an alternative approach');
}

// Get API key from environment
function getGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    throw new Error('Gemini API key not found in environment variables');
  }
  return key;
}

// Get Gemini Vision model
function getGeminiVisionModel() {
  const apiKey = getGeminiApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.0-pro-vision' });
}

/**
 * Split a PDF into individual page images
 * 
 * @param {string} pdfPath Path to PDF file
 * @param {object} options Options for splitting
 * @returns {Promise<Array<string>>} Paths to page images
 */
async function splitPdfIntoPageImages(pdfPath, options = {}) {
  const { outputDir = os.tmpdir(), prefix = 'page_', format = 'png' } = options;
  
  // Create a unique directory for this PDF
  const pdfName = path.basename(pdfPath, '.pdf');
  const uniqueId = crypto.randomBytes(4).toString('hex');
  const pdfOutputDir = path.join(outputDir, `${pdfName}_${uniqueId}`);
  
  if (!fs.existsSync(pdfOutputDir)) {
    fs.mkdirSync(pdfOutputDir, { recursive: true });
  }
  
  console.log(`Splitting PDF ${pdfPath} into pages in ${pdfOutputDir}`);
  
  // Use pdftoppm if available (much better quality)
  try {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const pdftoppm = spawn('pdftoppm', [
        '-png',       // Output in PNG format
        pdfPath,      // Input PDF
        path.join(pdfOutputDir, prefix)  // Output filename prefix
      ]);
      
      pdftoppm.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`pdftoppm process exited with code ${code}`));
          return;
        }
        
        // Get the output files
        const pageFiles = fs.readdirSync(pdfOutputDir)
          .filter(file => file.startsWith(prefix) && file.endsWith(`.${format}`))
          .sort((a, b) => {
            // Extract the page numbers for proper sorting
            const pageNumA = parseInt(a.replace(prefix, '').split('.')[0]);
            const pageNumB = parseInt(b.replace(prefix, '').split('.')[0]);
            return pageNumA - pageNumB;
          })
          .map(file => path.join(pdfOutputDir, file));
        
        resolve(pageFiles);
      });
      
      pdftoppm.on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    console.log('pdftoppm not available, using fallback method');
    
    // Fallback to other methods
    try {
      const { spawn } = await import('child_process');
      
      return new Promise((resolve, reject) => {
        const convert = spawn('convert', [
          '-density', '300',  // Higher density for better quality
          pdfPath,            // Input PDF
          '-quality', '100',  // Maximum quality
          path.join(pdfOutputDir, `${prefix}%d.${format}`)  // Output pattern
        ]);
        
        convert.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`convert process exited with code ${code}`));
            return;
          }
          
          // Get the output files
          const pageFiles = fs.readdirSync(pdfOutputDir)
            .filter(file => file.startsWith(prefix) && file.endsWith(`.${format}`))
            .sort((a, b) => {
              const pageNumA = parseInt(a.replace(prefix, '').split('.')[0]);
              const pageNumB = parseInt(b.replace(prefix, '').split('.')[0]);
              return pageNumA - pageNumB;
            })
            .map(file => path.join(pdfOutputDir, file));
          
          resolve(pageFiles);
        });
        
        convert.on('error', (err) => {
          reject(err);
        });
      });
    } catch (convertError) {
      console.log('ImageMagick convert not available, using pure JS fallback (lower quality)');
      
      // Pure JS fallback using pdf.js (not as good quality)
      // This would require implementing a JS-based solution
      // For now, let's throw an error and guide users to install the required tools
      throw new Error(
        'Could not find required tools for PDF processing. Please install either pdftoppm (poppler-utils) or ImageMagick.'
      );
    }
  }
}

/**
 * Split a PowerPoint into individual slide images
 * 
 * @param {string} pptxPath Path to PPTX file
 * @param {object} options Options for splitting
 * @returns {Promise<Array<string>>} Paths to slide images
 */
async function splitPptxIntoSlideImages(pptxPath, options = {}) {
  const { outputDir = os.tmpdir(), prefix = 'slide_', format = 'png' } = options;
  
  // Create a unique directory for this PPTX
  const pptxName = path.basename(pptxPath, '.pptx');
  const uniqueId = crypto.randomBytes(4).toString('hex');
  const pptxOutputDir = path.join(outputDir, `${pptxName}_${uniqueId}`);
  
  if (!fs.existsSync(pptxOutputDir)) {
    fs.mkdirSync(pptxOutputDir, { recursive: true });
  }
  
  console.log(`Splitting PPTX ${pptxPath} into slides in ${pptxOutputDir}`);
  
  // Try using LibreOffice if available (best quality)
  try {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const libreoffice = spawn('libreoffice', [
        '--headless',
        '--convert-to', format,
        '--outdir', pptxOutputDir,
        pptxPath
      ]);
      
      libreoffice.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`libreoffice process exited with code ${code}`));
          return;
        }
        
        // Get the output files
        const slideFiles = fs.readdirSync(pptxOutputDir)
          .filter(file => file.endsWith(`.${format}`))
          .sort()
          .map(file => path.join(pptxOutputDir, file));
        
        resolve(slideFiles);
      });
      
      libreoffice.on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    console.log('LibreOffice not available, using fallback method');
    
    // Try using node-pptx or similar libraries as fallback
    throw new Error(
      'Could not find LibreOffice for PPTX processing. Please install LibreOffice for best results.'
    );
  }
}

/**
 * Analyze a document page using Gemini Vision
 * 
 * @param {string} imagePath Path to page/slide image
 * @param {number} pageNum Page/slide number
 * @returns {Promise<Object>} Page analysis with extracted text and elements
 */
async function analyzeDocumentPage(imagePath, pageNum) {
  const model = getGeminiVisionModel();
  const { recordMetric } = await importMonitoring();
  const startTime = Date.now();
  
  try {
    // Read the image file
    const imageData = fs.readFileSync(imagePath);
    const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    
    // Create a detailed prompt for Gemini Vision
    const prompt = `You are a document analysis assistant. Analyze this document page (page ${pageNum}) and extract ALL of the following:

1. All text content exactly as it appears, preserving paragraphs, headings, and bullet points
2. Identify all visual elements (charts, tables, diagrams, images) and describe each one in detail
3. Extract any tabular data into a structured format
4. Note any headers, footers, page numbers, or other structural elements
5. Document the overall layout and organization of content

Format your response as a JSON object with these fields:
{
  "pageNumber": ${pageNum},
  "textContent": "Full extracted text with preserved structure",
  "visualElements": [
    {
      "type": "chart|table|diagram|image|other",
      "description": "Detailed description",
      "position": "top|middle|bottom-left|center|etc",
      "extractedText": "Any text found in the visual",
      "structuredData": [Optional structured representation for tables/charts]
    }
  ],
  "layout": {
    "sections": ["header", "main content", "sidebar", etc],
    "columns": number of columns,
    "hasFooter": boolean,
    "pageNumber": detected page number if different from ${pageNum}
  }
}`;
    
    // Call Gemini Vision API
    const result = await model.generateContent([
      {
        text: prompt
      },
      {
        inlineData: {
          mimeType,
          data: imageData.toString('base64')
        }
      }
    ]);
    
    const response = await result.response;
    const responseText = response.text();
    
    // Parse response and validate
    try {
      // Try to parse as JSON
      const parsedResponse = JSON.parse(responseText);
      recordMetric('visionDocAnalyzer', 'analyzeDocumentPage', Date.now() - startTime, true, {
        pageNum,
        visualElementsCount: parsedResponse.visualElements?.length || 0
      });
      
      return parsedResponse;
    } catch (parseError) {
      console.error('Error parsing response as JSON, attempting to extract information', parseError);
      
      // Simple extraction from non-JSON response
      const extractedText = responseText.replace(/.*?textContent[":]+\s*/i, '')
        .split(/visualElements|layout/i)[0]
        .trim()
        .replace(/^"|"$/g, '');
      
      const visualMatches = responseText.match(/type[":]+(chart|table|diagram|image|other).*?description[":]+(.*?)(?=position|extractedText|structuredData|},|])/gi);
      
      const visualElements = visualMatches ? visualMatches.map(match => {
        const typeMatch = match.match(/type[":]+(chart|table|diagram|image|other)/i);
        const descMatch = match.match(/description[":]+([^"]+)/i);
        
        return {
          type: typeMatch ? typeMatch[1].toLowerCase() : 'other',
          description: descMatch ? descMatch[1] : 'Visual element',
          position: 'unknown',
          extractedText: ''
        };
      }) : [];
      
      recordMetric('visionDocAnalyzer', 'analyzeDocumentPage', Date.now() - startTime, false, {
        pageNum,
        error: 'JSON parsing failed, used fallback extraction',
        visualElementsCount: visualElements.length
      });
      
      return {
        pageNumber: pageNum,
        textContent: extractedText,
        visualElements,
        layout: {
          sections: ['main content'],
          columns: 1,
          hasFooter: false,
          pageNumber: pageNum
        }
      };
    }
  } catch (error) {
    console.error(`Error analyzing page ${pageNum}:`, error);
    recordMetric('visionDocAnalyzer', 'analyzeDocumentPage', Date.now() - startTime, false, {
      pageNum,
      error: error.message
    });
    
    // Return a minimal fallback result
    return {
      pageNumber: pageNum,
      textContent: `[Error analyzing page ${pageNum}]`,
      visualElements: [],
      layout: {
        sections: ['error'],
        columns: 1,
        hasFooter: false,
        pageNumber: pageNum
      }
    };
  }
}

/**
 * Main function to analyze a PDF using Gemini Vision
 * 
 * @param {string} pdfPath Path to PDF file
 * @param {object} options Analysis options
 * @returns {Promise<Object>} Complete PDF analysis
 */
export async function analyzeDocumentWithVision(documentPath, options = {}) {
  const { 
    maxPages = 25,
    tempDir = os.tmpdir(),
    includePageImages = false,
    batchSize = 3
  } = options;
  
  const startTime = Date.now();
  const { recordMetric } = await importMonitoring();
  
  try {
    // Check file type
    const ext = path.extname(documentPath).toLowerCase();
    const isValidFile = ['.pdf', '.pptx', '.ppt'].includes(ext);
    
    if (!isValidFile) {
      throw new Error(`Unsupported file type: ${ext}. Only PDF and PowerPoint files are supported.`);
    }
    
    // Split document into page images
    const pageImages = ext === '.pdf' 
      ? await splitPdfIntoPageImages(documentPath, { outputDir: tempDir })
      : await splitPptxIntoSlideImages(documentPath, { outputDir: tempDir });
    
    // Limit number of pages if needed
    const pagesToProcess = pageImages.slice(0, maxPages);
    
    console.log(`Processing ${pagesToProcess.length} pages from document: ${documentPath}`);
    
    // Process pages in batches
    const pageAnalyses = [];
    for (let i = 0; i < pagesToProcess.length; i += batchSize) {
      const batch = pagesToProcess.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pagesToProcess.length / batchSize)}`);
      
      // Process batch concurrently
      const batchResults = await Promise.all(
        batch.map((imagePath, index) => 
          analyzeDocumentPage(imagePath, i + index + 1) // Page numbers are 1-based
        )
      );
      
      pageAnalyses.push(...batchResults);
    }
    
    // Compile into a document analysis
    const documentName = path.basename(documentPath);
    const documentAnalysis = {
      documentName,
      documentType: ext === '.pdf' ? 'pdf' : 'presentation',
      pageCount: pageAnalyses.length,
      pages: pageAnalyses,
      extractedText: pageAnalyses.map(page => page.textContent).join('\n\n'),
      visualElements: pageAnalyses.flatMap(page => 
        page.visualElements.map(elem => ({
          ...elem,
          pageNumber: page.pageNumber
        }))
      )
    };
    
    // Remove temporary image files unless requested to keep them
    if (!includePageImages) {
      // Get the parent directory of the first page image (our temp dir)
      const imageDir = path.dirname(pageImages[0]);
      try {
        // Remove the temp files synchronously before returning
        for (const imagePath of pageImages) {
          fs.unlinkSync(imagePath);
        }
        // Try to remove the directory too
        fs.rmdirSync(imageDir);
      } catch (cleanupError) {
        console.warn('Error cleaning up temporary files:', cleanupError);
      }
    } else {
      // If keeping images, include their paths in the response
      documentAnalysis.pageImagePaths = pageImages;
    }
    
    recordMetric('visionDocAnalyzer', 'analyzeDocument', Date.now() - startTime, true, {
      documentType: documentAnalysis.documentType,
      pageCount: documentAnalysis.pageCount,
      visualElementsCount: documentAnalysis.visualElements.length
    });
    
    return documentAnalysis;
  } catch (error) {
    console.error('Error analyzing document:', error);
    recordMetric('visionDocAnalyzer', 'analyzeDocument', Date.now() - startTime, false, {
      error: error.message
    });
    throw error;
  }
}

/**
 * Convert document analysis to chunks for further processing
 * 
 * @param {Object} documentAnalysis Analysis from analyzeDocumentWithVision
 * @param {Object} options Chunking options
 * @returns {Array<Object>} Array of content chunks with text and visuals
 */
export function convertAnalysisToChunks(documentAnalysis, options = {}) {
  const {
    chunkSize = 500,
    overlapSize = 100,
    separateVisuals = true
  } = options;
  
  const chunks = [];
  
  // Handle two strategies: with or without separating visual elements
  if (separateVisuals) {
    // Strategy 1: Create separate chunks for text and for visual elements
    
    // Process text by pages with some overlap
    for (const page of documentAnalysis.pages) {
      const pageText = page.textContent;
      
      // Skip empty pages
      if (!pageText || pageText.trim().length === 0) {
        continue;
      }
      
      // Create chunks from this page's text
      let startIdx = 0;
      while (startIdx < pageText.length) {
        const endIdx = Math.min(startIdx + chunkSize, pageText.length);
        
        // Try to end at a natural boundary
        let adjustedEndIdx = endIdx;
        if (endIdx < pageText.length) {
          // Look for natural breaking points: paragraph, sentence, or word boundary
          const paragraphBreak = pageText.lastIndexOf('\n\n', endIdx);
          const sentenceBreak = pageText.lastIndexOf('. ', endIdx);
          const wordBreak = pageText.lastIndexOf(' ', endIdx);
          
          if (paragraphBreak > startIdx && paragraphBreak > endIdx - 200) {
            adjustedEndIdx = paragraphBreak + 2; // Include the newlines
          } else if (sentenceBreak > startIdx && sentenceBreak > endIdx - 100) {
            adjustedEndIdx = sentenceBreak + 2; // Include the period and space
          } else if (wordBreak > startIdx && wordBreak > endIdx - 50) {
            adjustedEndIdx = wordBreak + 1; // Include the space
          }
        }
        
        // Create the text chunk
        chunks.push({
          text: pageText.substring(startIdx, adjustedEndIdx),
          metadata: {
            source: documentAnalysis.documentName,
            page: page.pageNumber,
            isContextualChunk: true,
            documentType: documentAnalysis.documentType,
            hasVisualContent: false
          }
        });
        
        // Move to next chunk, with overlap
        startIdx = adjustedEndIdx - overlapSize;
      }
      
      // Process visual elements on this page
      for (const visual of page.visualElements) {
        // Create a chunk for each visual element
        chunks.push({
          text: `[Visual Element: ${visual.type}] ${visual.description}` + 
                (visual.extractedText ? `\n${visual.extractedText}` : ''),
          metadata: {
            source: documentAnalysis.documentName,
            page: page.pageNumber,
            isContextualChunk: true,
            documentType: documentAnalysis.documentType,
            hasVisualContent: true
          },
          visualContent: [{
            type: visual.type,
            description: visual.description,
            extractedText: visual.extractedText,
            structuredData: visual.structuredData,
            position: {
              page: page.pageNumber,
              x: 0, y: 0, width: 0, height: 0  // Placeholder values
            }
          }]
        });
      }
    }
  } else {
    // Strategy 2: Combine text with nearby visuals in single chunks
    
    // First, organize visuals by page
    const visualsByPage = {};
    for (const visual of documentAnalysis.visualElements) {
      if (!visualsByPage[visual.pageNumber]) {
        visualsByPage[visual.pageNumber] = [];
      }
      visualsByPage[visual.pageNumber].push(visual);
    }
    
    // Now create chunks with text and associated visuals
    for (const page of documentAnalysis.pages) {
      const pageText = page.textContent;
      const pageVisuals = visualsByPage[page.pageNumber] || [];
      
      // Skip empty pages
      if (!pageText || pageText.trim().length === 0) {
        // But still include visuals as standalone chunks
        for (const visual of pageVisuals) {
          chunks.push({
            text: `[Visual Element: ${visual.type}] ${visual.description}` + 
                  (visual.extractedText ? `\n${visual.extractedText}` : ''),
            metadata: {
              source: documentAnalysis.documentName,
              page: page.pageNumber,
              isContextualChunk: true,
              documentType: documentAnalysis.documentType,
              hasVisualContent: true
            },
            visualContent: [{
              type: visual.type,
              description: visual.description,
              extractedText: visual.extractedText,
              structuredData: visual.structuredData,
              position: {
                page: page.pageNumber,
                x: 0, y: 0, width: 0, height: 0  // Placeholder values
              }
            }]
          });
        }
        continue;
      }
      
      // Create chunks from this page's text
      let startIdx = 0;
      while (startIdx < pageText.length) {
        const endIdx = Math.min(startIdx + chunkSize, pageText.length);
        
        // Find natural breaking point
        let adjustedEndIdx = endIdx;
        if (endIdx < pageText.length) {
          const paragraphBreak = pageText.lastIndexOf('\n\n', endIdx);
          const sentenceBreak = pageText.lastIndexOf('. ', endIdx);
          const wordBreak = pageText.lastIndexOf(' ', endIdx);
          
          if (paragraphBreak > startIdx && paragraphBreak > endIdx - 200) {
            adjustedEndIdx = paragraphBreak + 2;
          } else if (sentenceBreak > startIdx && sentenceBreak > endIdx - 100) {
            adjustedEndIdx = sentenceBreak + 2;
          } else if (wordBreak > startIdx && wordBreak > endIdx - 50) {
            adjustedEndIdx = wordBreak + 1;
          }
        }
        
        // Extract the text for this chunk
        const chunkText = pageText.substring(startIdx, adjustedEndIdx);
        
        // Find visuals relevant to this chunk
        // This is a simple implementation - in reality, you'd need more sophisticated
        // analysis to match visuals with the right text chunks
        const relevantVisuals = pageVisuals.filter(visual => {
          // Check if visual description terms appear in chunk text
          const descTerms = visual.description
            .split(/\s+/)
            .filter(term => term.length > 5)
            .slice(0, 5);
          
          return descTerms.some(term => 
            chunkText.toLowerCase().includes(term.toLowerCase())
          );
        });
        
        // Create the combined chunk
        chunks.push({
          text: chunkText,
          metadata: {
            source: documentAnalysis.documentName,
            page: page.pageNumber,
            isContextualChunk: true,
            documentType: documentAnalysis.documentType,
            hasVisualContent: relevantVisuals.length > 0
          },
          visualContent: relevantVisuals.length > 0 ? 
            relevantVisuals.map(visual => ({
              type: visual.type,
              description: visual.description,
              extractedText: visual.extractedText,
              structuredData: visual.structuredData,
              position: {
                page: page.pageNumber,
                x: 0, y: 0, width: 0, height: 0  // Placeholder values
              }
            })) : undefined
        });
        
        // Move to next chunk, with overlap
        startIdx = adjustedEndIdx - overlapSize;
      }
    }
  }
  
  return chunks;
}

/**
 * Complete pipeline: Analyze document and convert to chunks ready for embedding
 * 
 * @param {string} documentPath Path to document file
 * @param {Object} options Processing options
 * @returns {Promise<Array<Object>>} Array of chunks ready for embedding
 */
export async function processDocumentToChunks(documentPath, options = {}) {
  const startTime = Date.now();
  const { recordMetric } = await importMonitoring();
  
  try {
    // Step 1: Analyze document with Gemini Vision
    const documentAnalysis = await analyzeDocumentWithVision(documentPath, options);
    
    // Step 2: Convert analysis to chunks
    const chunks = convertAnalysisToChunks(documentAnalysis, options);
    
    // Log success
    recordMetric('visionDocAnalyzer', 'processDocumentToChunks', Date.now() - startTime, true, {
      documentType: documentAnalysis.documentType,
      pageCount: documentAnalysis.pageCount,
      chunkCount: chunks.length
    });
    
    return {
      documentName: documentAnalysis.documentName,
      documentType: documentAnalysis.documentType,
      pageCount: documentAnalysis.pageCount,
      chunks
    };
  } catch (error) {
    console.error('Error processing document to chunks:', error);
    recordMetric('visionDocAnalyzer', 'processDocumentToChunks', Date.now() - startTime, false, {
      error: error.message
    });
    throw error;
  }
}

// Export main functions
export default {
  analyzeDocumentWithVision,
  convertAnalysisToChunks,
  processDocumentToChunks
}; 
import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { storeVisual } from '@/utils/visualStorageManager';
import { recordMetric } from '@/utils/performanceMonitoring';
import { ImageAnalyzer } from '@/utils/imageAnalysis/imageAnalyzer';
import { IncomingForm } from 'formidable';

// Disable body parser to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

interface UploadedFile {
  filepath: string;
  originalFilename: string;
  mimetype: string;
  size: number;
}

/**
 * API endpoint for uploading visual content
 * Supports batch uploads and automatic analysis
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  
  try {
    // Parse the multipart form data
    const { fields, files } = await parseFormData(req);
    
    // Get document ID if provided
    const documentId = Array.isArray(fields.documentId) 
      ? fields.documentId[0] 
      : fields.documentId;
    
    // Check if we should analyze the visuals
    const analyzeVisuals = Array.isArray(fields.analyze) 
      ? fields.analyze[0] === 'true'
      : fields.analyze === 'true';
    
    // Get array of files (formidable can provide a single file or an array)
    const fileArray = Array.isArray(files.files) 
      ? files.files 
      : files.files ? [files.files] : [];
      
    if (fileArray.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    // Process each file
    const results = [];
    let errors = 0;
    
    for (const file of fileArray) {
      try {
        // Store visual metadata without analysis first
        const visual = await storeVisual(file.filepath, {
          originalFilename: file.originalFilename || 'unknown',
          mimeType: file.mimetype || 'application/octet-stream',
          associatedDocumentId: documentId,
          hasBeenAnalyzed: false
        });
        
        // If analysis is requested, analyze the visual
        if (analyzeVisuals) {
          // Analyze the image using the correct static method name
          const analysisResult = await ImageAnalyzer.analyzeImage(file.filepath);
          
          // Update the visual metadata with analysis results
          if (analysisResult.success) {
            await updateVisualWithAnalysis(visual.id, analysisResult);
          }
          
          results.push({
            id: visual.id,
            filename: file.originalFilename,
            analyzed: analysisResult.success,
            type: analysisResult.success ? analysisResult.type : undefined,
            url: `/api/visuals/${visual.id}`
          });
        } else {
          results.push({
            id: visual.id,
            filename: file.originalFilename,
            analyzed: false,
            url: `/api/visuals/${visual.id}`
          });
        }
        
      } catch (error) {
        console.error('Error processing visual:', error);
        errors++;
        results.push({
          filename: file.originalFilename,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        // Remove the temporary file
        if (fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath);
        }
      }
    }
    
    // Record performance metric
    const duration = Date.now() - startTime;
    recordMetric(
      'visualApi',
      'uploadVisuals',
      duration,
      errors === 0, // success if no errors
      { 
        uploadCount: fileArray.length,
        errorCount: errors,
        totalSize: fileArray.reduce((sum, file) => sum + file.size, 0),
        analyzed: analyzeVisuals
      }
    );
    
    // Return response with processed visuals
    return res.status(200).json({
      success: true,
      processed: fileArray.length,
      errors,
      results
    });
    
  } catch (error) {
    console.error('Error uploading visuals:', error);
    
    // Record error metric
    const duration = Date.now() - startTime;
    recordMetric(
      'visualApi',
      'uploadVisuals',
      duration,
      false,
      {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    );
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Parse the multipart form data
 */
async function parseFormData(req: NextApiRequest): Promise<{
  fields: formidable.Fields;
  files: formidable.Files;
}> {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      multiples: true,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB max file size
    });
    
    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
}

/**
 * Update visual metadata with analysis results
 */
async function updateVisualWithAnalysis(visualId: string, analysisResult: any): Promise<void> {
  const { storeVisual, getVisual, updateVisualMetadata } = await import('../../../utils/visualStorageManager');
  
  // Get the current visual metadata
  const visual = await getVisual(visualId);
  if (!visual) {
    throw new Error(`Visual not found: ${visualId}`);
  }
  
  // Update with analysis results
  await updateVisualMetadata(visualId, {
    type: analysisResult.type,
    description: analysisResult.description,
    extractedText: analysisResult.detectedText,
    hasBeenAnalyzed: true,
    analysisResults: {
      detectedType: analysisResult.type,
      description: analysisResult.description,
      extractedText: analysisResult.detectedText,
      structuredData: analysisResult.data
    }
  });
} 
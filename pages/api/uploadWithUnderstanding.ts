import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { processDocumentWithUnderstanding } from '../../utils/advancedDocumentProcessing';

// Disable the default body parser
export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Ensure data directory exists for vector store persistence
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  try {
    const form = new formidable.IncomingForm({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    // Parse the form
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    // Get the uploaded file
    const fileArray = files.file;
    if (!fileArray || !Array.isArray(fileArray) || fileArray.length === 0) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const uploadedFile = fileArray[0];
    const mimetype = uploadedFile.mimetype || '';
    const originalFilename = uploadedFile.originalFilename || 'unknown';

    // Read the file content
    const fileContent = fs.readFileSync(uploadedFile.filepath, 'utf8');

    // Process the file with advanced understanding
    try {
      const result = await processDocumentWithUnderstanding({
        text: fileContent,
        metadata: { mimetype },
        filename: originalFilename
      }, {
        extractEntities: true,
        summarize: true,
        categorize: true
      });
      
      // Create a custom analysis object
      const analysisSnippet = {
        title: originalFilename,
        topics: result.entities || [],
        contentType: mimetype,
        technicalLevel: 3, // Default value
      };

      return res.status(200).json({ 
        message: `Document processed with advanced understanding. Created smart chunks.`,
        analysis: analysisSnippet
      });
    } catch (error) {
      console.error('Error processing file:', error);
      return res.status(500).json({ 
        message: `Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
} 
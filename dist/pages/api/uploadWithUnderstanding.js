"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = handler;
const formidable_1 = __importDefault(require("formidable"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const advancedDocumentProcessing_1 = require("../../utils/advancedDocumentProcessing");
// Disable the default body parser
exports.config = { api: { bodyParser: false } };
async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    // Ensure uploads directory exists
    const uploadsDir = path_1.default.join(process.cwd(), 'public', 'uploads');
    if (!fs_1.default.existsSync(uploadsDir)) {
        fs_1.default.mkdirSync(uploadsDir, { recursive: true });
    }
    // Ensure data directory exists for vector store persistence
    const dataDir = path_1.default.join(process.cwd(), 'data');
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    try {
        const form = new formidable_1.default.IncomingForm({
            uploadDir: uploadsDir,
            keepExtensions: true,
            maxFileSize: 10 * 1024 * 1024, // 10MB limit
        });
        // Parse the form
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err)
                    reject(err);
                else
                    resolve([fields, files]);
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
        const fileContent = fs_1.default.readFileSync(uploadedFile.filepath, 'utf8');
        // Process the file with advanced understanding
        try {
            const result = await (0, advancedDocumentProcessing_1.processDocumentWithUnderstanding)({
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
        }
        catch (error) {
            console.error('Error processing file:', error);
            return res.status(500).json({
                message: `Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }
    catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({
            message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
    }
}

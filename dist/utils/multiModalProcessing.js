/**
 * Multi-Modal Processing Utilities
 *
 * This module provides functions for processing visual elements in documents
 * using Gemini's vision capabilities.
 */
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { recordMetric } from './performanceMonitoring';
import { VisualContentType } from '../types/multiModal';
// Utility function to get the Gemini API key
function getGeminiApiKey() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    return apiKey;
}
// Function to get a vision-capable model
function getVisionModel() {
    const apiKey = getGeminiApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    // Configure the model for vision tasks
    return genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
        },
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
        ],
    });
}
/**
 * Analyze an image file using Gemini vision capabilities
 *
 * @param imagePath Path to the image file
 * @returns Analysis result with description, extracted text, and type
 */
export async function analyzeImage(imagePath) {
    try {
        const startTime = Date.now();
        // Read image file as base64
        const imageData = fs.readFileSync(imagePath);
        const mimeType = getMimeType(imagePath);
        const imageBase64 = imageData.toString('base64');
        // Get the vision model
        const model = getVisionModel();
        // Create an enhanced prompt for the model with better structured data extraction
        const prompt = `Analyze this image in detail providing the following information:
    
    1. DESCRIPTION: Provide a comprehensive description of what you see in the image, including its main elements, purpose, and key information it conveys.
    
    2. TEXT_CONTENT: Extract all visible text from the image verbatim, preserving formatting where possible.
    
    3. TYPE: Classify this as one of the following types:
       - chart (pie, bar, line, scatter, etc.)
       - table
       - diagram (flowchart, architecture, etc.)
       - graph (network, tree, etc.)
       - screenshot (UI, application, website)
       - image (photo, artwork, etc.)
       - infographic
    
    4. STRUCTURED_DATA: For charts, tables, graphs, and diagrams, extract the data in this structured JSON format:
       For charts/graphs: {
         "chartType": "bar|line|pie|scatter|etc.",
         "title": "Main title of the chart",
         "xAxisLabel": "Label of x-axis if applicable",
         "yAxisLabel": "Label of y-axis if applicable",
         "data": {
           "categories": ["cat1", "cat2", "cat3"],
           "series": [
             {"name": "Series1Name", "values": [val1, val2, val3]},
             {"name": "Series2Name", "values": [val1, val2, val3]}
           ]
         },
         "insights": ["Key insight 1", "Key insight 2"]
       }
       
       For tables: {
         "headers": ["Column1", "Column2"],
         "rows": [
           ["row1col1", "row1col2"],
           ["row2col1", "row2col2"]
         ]
       }
       
       For diagrams/flowcharts: {
         "nodes": ["Node1", "Node2", "Node3"],
         "connections": [
           {"from": "Node1", "to": "Node2", "label": "connection label"},
           {"from": "Node2", "to": "Node3", "label": "connection label"}
         ]
       }
    
    Format your response with clear section headings for DESCRIPTION, TEXT_CONTENT, TYPE, and STRUCTURED_DATA.`;
        // Send the request to the model
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType,
                    data: imageBase64
                }
            }
        ]);
        const response = result.response;
        const responseText = response.text();
        // Parse the structured response
        const descriptionMatch = responseText.match(/DESCRIPTION:(.*?)(?=TEXT_CONTENT:|$)/s);
        const textContentMatch = responseText.match(/TEXT_CONTENT:(.*?)(?=TYPE:|$)/s);
        const typeMatch = responseText.match(/TYPE:(.*?)(?=STRUCTURED_DATA:|$)/s);
        const structuredDataMatch = responseText.match(/STRUCTURED_DATA:(.*?)$/s);
        const description = (descriptionMatch?.[1] || '').trim();
        const extractedText = (textContentMatch?.[1] || '').trim();
        let typeStr = ((typeMatch?.[1] || '').trim().toLowerCase());
        // Map the type string to a valid VisualContentType
        let type;
        switch (typeStr) {
            case 'chart':
            case 'bar chart':
            case 'pie chart':
            case 'line chart':
                type = VisualContentType.CHART;
                break;
            case 'table':
                type = VisualContentType.TABLE;
                break;
            case 'diagram':
            case 'flowchart':
            case 'architecture diagram':
            case 'sequence diagram':
                type = VisualContentType.DIAGRAM;
                break;
            case 'graph':
            case 'network graph':
            case 'tree graph':
                type = VisualContentType.GRAPH;
                break;
            case 'image':
            case 'photo':
            case 'picture':
                type = VisualContentType.IMAGE;
                break;
            case 'figure':
                type = VisualContentType.FIGURE;
                break;
            case 'screenshot':
            case 'ui screenshot':
            case 'application screenshot':
                type = VisualContentType.SCREENSHOT;
                break;
            case 'infographic':
                type = VisualContentType.INFOGRAPHIC;
                break;
            default:
                type = VisualContentType.UNKNOWN;
        }
        // Try to parse structured data if present
        let structuredData = undefined;
        if (structuredDataMatch && structuredDataMatch[1].trim() !== 'N/A') {
            try {
                // Look for JSON objects in the text
                const jsonMatch = structuredDataMatch[1].match(/\{.*\}/s);
                if (jsonMatch) {
                    structuredData = JSON.parse(jsonMatch[0]);
                }
            }
            catch (error) {
                console.warn('Failed to parse structured data:', error);
            }
        }
        // Record the performance metric
        const duration = Date.now() - startTime;
        recordMetric('multiModal', 'imageAnalysis', duration, true);
        return {
            description,
            extractedText,
            type,
            structuredData
        };
    }
    catch (error) {
        // Record the error in performance metrics
        recordMetric('multiModal', 'imageAnalysis', 0, false, { error: String(error) });
        console.error('Error analyzing image:', error);
        // Return a fallback result
        return {
            description: 'Failed to analyze image.',
            extractedText: '',
            type: VisualContentType.UNKNOWN
        };
    }
}
/**
 * Extract images from a PDF file
 * This is a placeholder - in a real implementation, you would use a PDF library
 * such as pdf.js or a server-side library to extract images
 *
 * @param pdfPath Path to the PDF file
 * @returns Array of extracted image paths
 */
export async function extractImagesFromPDF(pdfPath) {
    // This is a placeholder for the actual implementation
    console.log(`Would extract images from PDF: ${pdfPath}`);
    return [];
}
/**
 * Process a document with images and create multi-modal chunks
 *
 * @param documentText The text content of the document
 * @param images Array of image paths or image data
 * @param source Source identifier for the document
 * @returns Array of multi-modal chunks
 */
export async function createMultiModalChunks(documentText, images, source) {
    try {
        // Import the text processing utilities
        const { splitIntoChunksWithContext } = await import('./documentProcessing');
        const { extractDocumentContext } = await import('./geminiClient');
        // Extract document context
        const documentContext = await extractDocumentContext(documentText);
        // Split the text into contextual chunks
        const textChunks = await splitIntoChunksWithContext(documentText, 500, source, true, documentContext);
        // Process each image
        const processedImages = await Promise.all(images.map(async (image) => {
            const imagePath = typeof image === 'string' ? image : image.path;
            const page = typeof image === 'string' ? undefined : image.page;
            const position = typeof image === 'string' ? undefined : image.position;
            // Analyze the image
            const analysis = await analyzeImage(imagePath);
            return {
                path: imagePath,
                page,
                position,
                analysis
            };
        }));
        // Create multi-modal chunks by combining text chunks with relevant images
        const multiModalChunks = textChunks.map((chunk) => {
            // Extract chunk metadata or initialize empty object
            const chunkMetadata = chunk.metadata || {};
            const chunkPage = chunkMetadata.page;
            // Find images that might be relevant to this chunk based on page number or content
            const relevantImages = processedImages.filter(img => 
            // Match images on the same page as the chunk (if page metadata exists)
            (chunkPage && img.page === chunkPage) ||
                // Or if the image text content matches keywords in the chunk
                (img.analysis.extractedText &&
                    chunk.text.includes(img.analysis.extractedText.substring(0, 20))));
            // Create the multi-modal chunk
            return {
                embedding: [], // Will be filled in later
                text: chunk.text,
                metadata: {
                    ...chunkMetadata,
                    source,
                    hasVisualContent: relevantImages.length > 0
                },
                visualContent: relevantImages.map(img => ({
                    type: img.analysis.type,
                    imageUrl: img.path,
                    description: img.analysis.description,
                    extractedText: img.analysis.extractedText,
                    structuredData: img.analysis.structuredData,
                    position: img.position || (img.page ? { page: img.page, x: 0, y: 0, width: 0, height: 0 } : undefined)
                }))
            };
        });
        return multiModalChunks;
    }
    catch (error) {
        console.error('Error creating multi-modal chunks:', error);
        throw error;
    }
}
/**
 * Generate embeddings for multi-modal content
 *
 * @param chunks Array of multi-modal chunks
 * @returns The chunks with embeddings added
 */
export async function generateMultiModalEmbeddings(chunks) {
    try {
        // Import the embedding client
        const { getEmbeddingClient } = await import('./embeddingClient');
        const embeddingClient = getEmbeddingClient();
        // For each chunk, prepare text for embedding that includes visual content
        const textsToEmbed = chunks.map(chunk => {
            let textToEmbed = chunk.text;
            // If there's visual content, include descriptions in the text to embed
            if (chunk.visualContent && chunk.visualContent.length > 0) {
                const visualDescriptions = chunk.visualContent
                    .map(vc => `Visual content: ${vc.description}. ${vc.extractedText ? `Text in visual: ${vc.extractedText}` : ''}`)
                    .join(' ');
                textToEmbed = `${textToEmbed} ${visualDescriptions}`;
            }
            return textToEmbed;
        });
        // Generate embeddings in batch
        const embeddings = await embeddingClient.embedBatch(textsToEmbed);
        // Add embeddings to the chunks
        return chunks.map((chunk, index) => ({
            ...chunk,
            embedding: embeddings[index]
        }));
    }
    catch (error) {
        console.error('Error generating multi-modal embeddings:', error);
        throw error;
    }
}
/**
 * Helper function to get the MIME type from a file path
 */
function getMimeType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    switch (extension) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        case '.webp':
            return 'image/webp';
        case '.svg':
            return 'image/svg+xml';
        case '.tiff':
        case '.tif':
            return 'image/tiff';
        case '.bmp':
            return 'image/bmp';
        default:
            return 'application/octet-stream';
    }
}
/**
 * Detect images in a document and analyze them
 *
 * @param filePath Path to the document file
 * @returns Analysis of images in the document
 */
export async function analyzeDocumentVisuals(filePath) {
    try {
        const startTime = Date.now();
        // Detect the file type
        const extension = path.extname(filePath).toLowerCase();
        // For PDFs, extract images first
        let imagePaths = [];
        if (extension === '.pdf') {
            imagePaths = await extractImagesFromPDF(filePath);
        }
        else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
            // If the file itself is an image
            imagePaths = [filePath];
        }
        else {
            // For other file types, return empty results for now
            return {
                images: [],
                hasCharts: false,
                hasTables: false,
                hasDiagrams: false
            };
        }
        // Analyze each image
        const analyzedImages = await Promise.all(imagePaths.map(async (imagePath) => {
            const analysis = await analyzeImage(imagePath);
            return {
                path: imagePath,
                analysis
            };
        }));
        // Determine if there are charts, tables, or diagrams
        const hasCharts = analyzedImages.some(img => img.analysis.type === 'chart');
        const hasTables = analyzedImages.some(img => img.analysis.type === 'table');
        const hasDiagrams = analyzedImages.some(img => img.analysis.type === 'diagram');
        // Record performance metric
        const duration = Date.now() - startTime;
        recordMetric('multiModal', 'documentVisualAnalysis', duration, true, {
            fileType: extension,
            imageCount: imagePaths.length
        });
        return {
            images: analyzedImages,
            hasCharts,
            hasTables,
            hasDiagrams
        };
    }
    catch (error) {
        console.error('Error analyzing document visuals:', error);
        recordMetric('multiModal', 'documentVisualAnalysis', 0, false, {
            error: String(error)
        });
        // Return empty results on error
        return {
            images: [],
            hasCharts: false,
            hasTables: false,
            hasDiagrams: false
        };
    }
}
/**
 * Perform a search that includes visual content
 *
 * @param query The search query
 * @param options Search options
 * @returns Search results with matched visual content
 */
export async function performMultiModalSearch(query, options = {}) {
    const startTime = Date.now();
    try {
        // Import necessary modules
        const { hybridSearch } = await import('./hybridSearch');
        const { analyzeQueryForContext, isQueryAboutVisuals } = await import('./queryAnalysis');
        // Set default options
        const limit = options.limit || 10;
        const includeVisualContent = options.includeVisualContent !== false;
        // Default number of candidates to retrieve before filtering and reranking
        const DEFAULT_CANDIDATES_COUNT = Math.max(limit * 3, 30);
        // Analyze the query to determine if it has visual focus
        let visualFocus = options.visualFocus;
        let visualTypes = options.visualTypes;
        // If visualFocus isn't explicitly set, analyze the query
        if (visualFocus === undefined) {
            try {
                // First use simple pattern matching for speed
                const hasVisualIntent = isQueryAboutVisuals(query);
                // If we need more detailed analysis, use Gemini
                if (hasVisualIntent || options.useEnhancedAnalysis) {
                    const queryAnalysis = await analyzeQueryForContext(query);
                    visualFocus = queryAnalysis.visualFocus;
                    // Convert string array to VisualContentType array if present
                    if (queryAnalysis.visualTypes && queryAnalysis.visualTypes.length > 0) {
                        visualTypes = queryAnalysis.visualTypes.map(type => {
                            // Map string to enum value
                            switch (type.toLowerCase()) {
                                case 'chart': return VisualContentType.CHART;
                                case 'table': return VisualContentType.TABLE;
                                case 'diagram': return VisualContentType.DIAGRAM;
                                case 'graph': return VisualContentType.GRAPH;
                                case 'image': return VisualContentType.IMAGE;
                                case 'figure': return VisualContentType.FIGURE;
                                case 'screenshot': return VisualContentType.SCREENSHOT;
                                case 'infographic': return VisualContentType.INFOGRAPHIC;
                                default: return VisualContentType.UNKNOWN;
                            }
                        });
                    }
                }
                else {
                    visualFocus = hasVisualIntent;
                }
            }
            catch (error) {
                console.error('Error analyzing query for visual intent:', error);
                // Fallback to basic pattern matching
                visualFocus = isQueryAboutVisuals(query);
            }
        }
        // If the query is focused on visuals or we explicitly want to include visual content,
        // adjust the search parameters
        const searchOptions = {
            limit: DEFAULT_CANDIDATES_COUNT
        };
        // Set up filters if they exist
        if (options.filters) {
            searchOptions.filter = options.filters;
        }
        // Perform hybrid search to get initial results
        const searchResults = await hybridSearch(query, searchOptions);
        // Ensure we have an array of results
        let candidateResults = Array.isArray(searchResults) ? [...searchResults] : [];
        // Initialize filtered results
        let filteredResults = [...candidateResults];
        // If it's a visual query or we need to include visual content,
        // filter and boost based on visual metadata
        if (visualFocus || includeVisualContent) {
            // Filter for results with visual content
            const visualResults = filteredResults.filter(result => {
                // Safely access properties
                const metadata = result?.item?.metadata || {};
                return metadata.hasVisualContent === true ||
                    metadata.isVisualElement === true ||
                    metadata.hasVisualElements === true;
            });
            // Only use visual filtering if we have enough results
            if (visualResults.length >= Math.max(limit / 2, 3)) {
                filteredResults = visualResults;
            }
            // Further filter by specific visual types if provided
            if (visualTypes && visualTypes.length > 0) {
                const typedResults = filteredResults.filter(result => {
                    const metadata = result?.item?.metadata || {};
                    const visualContent = result.item.visualContent;
                    // Check if this is directly a visual element of the specified type
                    if (metadata.isVisualElement && metadata.visualElementType &&
                        visualTypes?.some(vt => vt.toString() === metadata.visualElementType)) {
                        return true;
                    }
                    // Check if this contains visual elements of the specified types
                    if (Array.isArray(visualContent)) {
                        return visualContent.some(vc => visualTypes?.some(vt => vt.toString() === vc.type));
                    }
                    // Check if metadata has visual element types that match
                    if (metadata.visualElementTypes && Array.isArray(metadata.visualElementTypes)) {
                        return metadata.visualElementTypes.some((type) => visualTypes?.some(vt => vt.toString() === type));
                    }
                    return false;
                });
                // Only use type filtering if we have enough results
                if (typedResults.length >= Math.ceil(limit / 2)) {
                    filteredResults = typedResults;
                }
            }
            // Boost scores for visual content in a visual-focused query
            if (visualFocus) {
                filteredResults = filteredResults.map(result => {
                    // Get metadata and determine visual relevance
                    const metadata = result?.item?.metadata || {};
                    const visualContent = result.item.visualContent;
                    // Calculate boost factor
                    let boostFactor = 1.0;
                    // Dedicated visual elements get the highest boost
                    if (metadata.isVisualElement) {
                        boostFactor = 1.5;
                        // Extra boost if the visual type matches exactly what was requested
                        if (visualTypes &&
                            metadata.visualElementType &&
                            visualTypes.includes(metadata.visualElementType)) {
                            boostFactor = 1.8;
                        }
                    }
                    // Text chunks with embedded visuals get a medium boost
                    else if (metadata.hasVisualContent || metadata.hasVisualElements) {
                        boostFactor = 1.3;
                        // Check for type matches in the visual content
                        if (visualTypes && Array.isArray(visualContent)) {
                            const hasMatchingType = visualContent.some(vc => visualTypes?.includes(vc.type));
                            if (hasMatchingType) {
                                boostFactor = 1.5;
                            }
                        }
                    }
                    // Apply the boost
                    return {
                        ...result,
                        score: result.score * boostFactor
                    };
                });
            }
        }
        // Apply any additional filters from the options
        if (options.filters) {
            // Filter by document type if specified
            if (options.filters.documentTypes && options.filters.documentTypes.length > 0) {
                filteredResults = filteredResults.filter(result => {
                    const metadata = result?.item?.metadata || {};
                    return options.filters?.documentTypes?.includes(metadata.documentType);
                });
            }
        }
        // Sort by score and limit results
        filteredResults = filteredResults
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        // Convert to MultiModalSearchResult format
        const multiModalResults = filteredResults.map(result => {
            // Get the item as MultiModalVectorStoreItem
            const item = result.item;
            // Find best matching visual content based on query
            let bestVisual = undefined;
            let matchType = 'text';
            const visualContent = item.visualContent;
            if (Array.isArray(visualContent) && visualContent.length > 0) {
                // If we have visual types to filter by, prioritize those
                if (visualTypes && visualTypes.length > 0) {
                    const typeMatches = visualContent.filter(vc => visualTypes?.includes(vc.type));
                    if (typeMatches.length > 0) {
                        bestVisual = typeMatches[0];
                        matchType = item.text.toLowerCase().includes(query.toLowerCase()) ? 'both' : 'visual';
                    }
                }
                // If we don't have a match yet, look for content matches
                if (!bestVisual) {
                    const contentMatches = visualContent.filter(vc => (vc.description && vc.description.toLowerCase().includes(query.toLowerCase())) ||
                        (vc.extractedText && vc.extractedText.toLowerCase().includes(query.toLowerCase())));
                    if (contentMatches.length > 0) {
                        bestVisual = contentMatches[0];
                        matchType = item.text.toLowerCase().includes(query.toLowerCase()) ? 'both' : 'visual';
                    }
                    else if (visualContent.length > 0) {
                        // If no specific match, just take the first visual
                        bestVisual = visualContent[0];
                        matchType = 'text'; // Primary match is text, visual is supplementary
                    }
                }
            }
            // Return the result with proper typing
            return {
                score: result.score,
                item: item,
                matchedVisual: bestVisual,
                matchType
            };
        });
        // Record performance metrics
        recordMetric('multiModalSearch', 'search', Date.now() - startTime, true, {
            queryLength: query.length,
            visualFocus: visualFocus || false,
            resultCount: multiModalResults.length,
            hasVisualTypes: Boolean(visualTypes && visualTypes.length > 0)
        });
        return multiModalResults;
    }
    catch (error) {
        // Record the failure
        recordMetric('multiModalSearch', 'search', Date.now() - startTime, false, {
            error: error.message
        });
        console.error('Error in multi-modal search:', error);
        throw error;
    }
}

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitIntoChunksWithContext = void 0;
exports.extractText = extractText;
exports.detectStructuredInfo = detectStructuredInfo;
exports.splitIntoChunks = splitIntoChunks;
exports.prepareTextForEmbedding = prepareTextForEmbedding;
const fs_1 = __importDefault(require("fs"));
const mammoth_1 = __importDefault(require("mammoth"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const geminiClient_js_1 = require("./geminiClient.js");
/**
 * Extract text content from various document formats
 * @param filePath Path to the file
 * @param mimetype MIME type of the file
 * @returns Extracted text content
 */
async function extractText(filePath, mimetype) {
    try {
        if (mimetype === 'application/pdf') {
            const dataBuffer = fs_1.default.readFileSync(filePath);
            const result = await (0, pdf_parse_1.default)(dataBuffer);
            return result.text;
        }
        else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await extractTextFromDoc(filePath);
            return result;
        }
        else if (mimetype === 'text/plain') {
            return fs_1.default.promises.readFile(filePath, 'utf-8');
        }
        else {
            throw new Error(`Unsupported file type: ${mimetype}`);
        }
    }
    catch (error) {
        console.error('Error extracting text:', error);
        throw new Error(`Failed to extract text from document: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function extractTextFromDoc(filePath) {
    try {
        // Read the file as a buffer
        const fileBuffer = await fs_1.default.promises.readFile(filePath);
        // Use the buffer directly instead of the path
        const result = await mammoth_1.default.extractRawText(fileBuffer);
        return result.value;
    }
    catch (error) {
        console.error('Error extracting text from DOCX:', error);
        throw new Error(`Failed to extract text from DOCX file: ${error.message || 'Unknown error'}`);
    }
}
/**
 * Detect if text contains structured information like company values, investors,
 * leadership, pricing, or sales-related content
 */
function detectStructuredInfo(text) {
    const textLower = text.toLowerCase();
    // Detect company values
    const hasCompanyValues = textLower.includes('our values') ||
        textLower.includes('company values') ||
        textLower.includes('core values') ||
        textLower.includes('our culture') ||
        textLower.includes('culture') ||
        textLower.includes('mission statement') ||
        textLower.includes('vision statement') ||
        textLower.includes('what we believe') ||
        textLower.includes('our beliefs') ||
        textLower.includes('our mission') ||
        textLower.includes('our vision');
    // Detect investor information
    const hasInvestors = textLower.includes('investor') ||
        textLower.includes('investors') ||
        textLower.includes('funding') ||
        textLower.includes('backed by') ||
        textLower.includes('investment') ||
        textLower.includes('venture capital') ||
        textLower.includes('series ') ||
        textLower.includes('financing') ||
        textLower.includes('raised');
    // Detect leadership information
    const hasLeadership = textLower.includes('founder') ||
        textLower.includes('founders') ||
        textLower.includes('ceo') ||
        textLower.includes('cto') ||
        textLower.includes('cfo') ||
        textLower.includes('chief') ||
        textLower.includes('president') ||
        textLower.includes('executive') ||
        textLower.includes('director') ||
        textLower.includes('head of') ||
        textLower.includes('lead') ||
        textLower.includes('manager') ||
        textLower.includes('management team') ||
        textLower.includes('leadership team');
    // Detect pricing information
    const hasPricing = textLower.includes('pricing') ||
        textLower.includes('price') ||
        textLower.includes('cost') ||
        textLower.includes('subscription') ||
        textLower.includes('tier') ||
        textLower.includes('plan') ||
        textLower.includes('package') ||
        textLower.includes('fee') ||
        textLower.includes('$ ') ||
        textLower.includes('dollar') ||
        textLower.includes('per month') ||
        textLower.includes('per year') ||
        textLower.includes('monthly') ||
        textLower.includes('annually') ||
        textLower.includes('free trial');
    // Detect product features
    const hasProductFeatures = textLower.includes('feature') ||
        textLower.includes('benefits') ||
        textLower.includes('capabilities') ||
        textLower.includes('functionality') ||
        textLower.includes('module') ||
        textLower.includes('component') ||
        textLower.includes('how it works') ||
        textLower.includes('what it does') ||
        textLower.includes('our product') ||
        textLower.includes('platform');
    // Detect sales-specific information
    const hasSalesInfo = textLower.includes('sales pitch') ||
        textLower.includes('pitch deck') ||
        textLower.includes('value proposition') ||
        textLower.includes('why choose us') ||
        textLower.includes('competitor') ||
        textLower.includes('vs.') ||
        textLower.includes('versus') ||
        textLower.includes('comparison') ||
        textLower.includes('case study') ||
        textLower.includes('success story') ||
        textLower.includes('testimonial') ||
        textLower.includes('roi') ||
        textLower.includes('return on investment');
    return {
        hasCompanyValues,
        hasInvestors,
        hasLeadership,
        hasPricing,
        hasProductFeatures,
        hasSalesInfo
    };
}
/**
 * Split text into chunks of approximately the specified size
 * Enhanced to preserve context and structured information
 * @param text Text to split
 * @param chunkSize Target size for each chunk
 * @param source Optional source metadata for context-aware chunking
 * @returns Array of text chunks with metadata
 */
function splitIntoChunks(text, chunkSize = 500, source) {
    // Remove excess whitespace
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    if (cleanedText.length <= chunkSize) {
        // For small text, check if it contains structured information
        const structuredInfo = detectStructuredInfo(cleanedText);
        const metadata = {};
        if (structuredInfo.hasCompanyValues || structuredInfo.hasInvestors || structuredInfo.hasLeadership ||
            structuredInfo.hasPricing || structuredInfo.hasProductFeatures || structuredInfo.hasSalesInfo) {
            metadata.isStructured = true;
            if (structuredInfo.hasCompanyValues) {
                metadata.infoType = 'company_values';
            }
            else if (structuredInfo.hasInvestors) {
                metadata.infoType = 'investors';
            }
            else if (structuredInfo.hasLeadership) {
                metadata.infoType = 'leadership';
            }
            else if (structuredInfo.hasPricing) {
                metadata.infoType = 'pricing';
            }
            else if (structuredInfo.hasProductFeatures) {
                metadata.infoType = 'product_features';
            }
            else if (structuredInfo.hasSalesInfo) {
                metadata.infoType = 'sales_info';
            }
        }
        return [{ text: cleanedText, metadata }];
    }
    // If this is a careers or about page, we may need special handling
    const isAboutPage = (source === null || source === void 0 ? void 0 : source.includes('/about')) || (source === null || source === void 0 ? void 0 : source.toLowerCase().includes('about us'));
    const isCareersPage = (source === null || source === void 0 ? void 0 : source.includes('/careers')) || (source === null || source === void 0 ? void 0 : source.toLowerCase().includes('careers'));
    // For career and about pages, try to locate sections for special handling
    if (isAboutPage || isCareersPage) {
        return splitStructuredContent(cleanedText, chunkSize, source);
    }
    // Standard chunking for other content
    return splitRegularContent(cleanedText, chunkSize);
}
/**
 * Split potentially structured content like about pages and careers pages
 * Preserves sections related to company information
 */
function splitStructuredContent(text, chunkSize, source) {
    const chunks = [];
    // Try to identify sections in the text
    const sections = identifySections(text);
    // If we identified structured sections, process them specially
    if (sections.length > 0) {
        for (const section of sections) {
            const structuredInfo = detectStructuredInfo(section.text);
            const metadata = {};
            if (structuredInfo.hasCompanyValues) {
                metadata.isStructured = true;
                metadata.infoType = 'company_values';
            }
            else if (structuredInfo.hasInvestors) {
                metadata.isStructured = true;
                metadata.infoType = 'investors';
            }
            else if (structuredInfo.hasLeadership) {
                metadata.isStructured = true;
                metadata.infoType = 'leadership';
            }
            else if (structuredInfo.hasPricing) {
                metadata.isStructured = true;
                metadata.infoType = 'pricing';
            }
            else if (structuredInfo.hasProductFeatures) {
                metadata.isStructured = true;
                metadata.infoType = 'product_features';
            }
            else if (structuredInfo.hasSalesInfo) {
                metadata.isStructured = true;
                metadata.infoType = 'sales_info';
            }
            // If this is a structured section, try to keep it intact if possible
            if (metadata.isStructured && section.text.length <= chunkSize * 1.5) {
                chunks.push({ text: section.text, metadata });
            }
            else {
                // If too large, split but preserve the metadata
                const sectionChunks = splitRegularContent(section.text, chunkSize);
                for (const chunk of sectionChunks) {
                    if (metadata.isStructured) {
                        chunk.metadata = { ...metadata };
                    }
                    chunks.push(chunk);
                }
            }
        }
        return chunks;
    }
    // If we couldn't identify structured sections, fall back to regular chunking
    return splitRegularContent(text, chunkSize);
}
/**
 * Identify potential sections in text based on headings and patterns
 */
function identifySections(text) {
    const sections = [];
    // Common section indicators
    const sectionIndicators = [
        'our values', 'company values', 'our investors', 'our mission',
        'leadership', 'team', 'about us', 'our story', 'vision',
        'what we do', 'who we are', 'our investors'
    ];
    // Try to split by common headings and indicators
    let remainingText = text;
    // First pass: Look for section headings
    for (const indicator of sectionIndicators) {
        const indicatorRegex = new RegExp(`(^|\\s)${indicator}[:\\s]`, 'i');
        const match = remainingText.match(indicatorRegex);
        if (match && match.index !== undefined) {
            // Find the next section indicator after this one
            let nextIndex = remainingText.length;
            for (const nextIndicator of sectionIndicators) {
                if (nextIndicator === indicator)
                    continue;
                const nextRegex = new RegExp(`(^|\\s)${nextIndicator}[:\\s]`, 'i');
                const nextMatch = remainingText.slice(match.index + indicator.length).match(nextRegex);
                if (nextMatch && nextMatch.index !== undefined) {
                    nextIndex = Math.min(nextIndex, match.index + indicator.length + nextMatch.index);
                }
            }
            // Extract this section
            const sectionText = remainingText.slice(Math.max(0, match.index - 20), // Include some context before
            nextIndex + 20 // Include some context after
            ).trim();
            if (sectionText.length > 50) { // Ensure it's a meaningful section
                sections.push({ text: sectionText, type: indicator });
            }
        }
    }
    // If we didn't find sections, try another approach with paragraph breaks
    if (sections.length === 0) {
        const paragraphs = text.split(/\n\s*\n/);
        let currentSection = "";
        let currentType = undefined;
        for (const paragraph of paragraphs) {
            if (paragraph.trim().length < 10)
                continue; // Skip very short paragraphs
            // Check if this paragraph starts a new section
            let foundNewSection = false;
            for (const indicator of sectionIndicators) {
                if (paragraph.toLowerCase().includes(indicator)) {
                    // If we have a current section, add it before starting a new one
                    if (currentSection.length > 0) {
                        sections.push({ text: currentSection, type: currentType });
                    }
                    // Start a new section
                    currentSection = paragraph;
                    currentType = indicator;
                    foundNewSection = true;
                    break;
                }
            }
            // If not a new section, add to current section
            if (!foundNewSection) {
                if (currentSection.length > 0) {
                    currentSection += "\n\n" + paragraph;
                }
                else {
                    currentSection = paragraph;
                }
            }
        }
        // Add the final section if it exists
        if (currentSection.length > 0) {
            sections.push({ text: currentSection, type: currentType });
        }
    }
    // If we still don't have sections, create one for the whole text
    if (sections.length === 0) {
        sections.push({ text });
    }
    return sections;
}
/**
 * Split text using the standard chunking algorithm
 * @param text Text to split
 * @param chunkSize Target size for each chunk
 * @returns Array of text chunks
 */
function splitRegularContent(text, chunkSize) {
    const chunks = [];
    let currentIndex = 0;
    while (currentIndex < text.length) {
        // Get a chunk of approximately the target size
        let chunk = text.substring(currentIndex, currentIndex + chunkSize);
        // If we're not at the end of the text, try to break at a natural boundary
        if (currentIndex + chunkSize < text.length) {
            // Look for paragraph breaks first (ideal breaking point)
            const paragraphBreak = chunk.lastIndexOf('\n\n');
            // Then look for the last sentence break in this chunk
            const sentenceBreaks = [
                chunk.lastIndexOf('. '),
                chunk.lastIndexOf('? '),
                chunk.lastIndexOf('! '),
                chunk.lastIndexOf('.\n'),
                chunk.lastIndexOf('?\n'),
                chunk.lastIndexOf('!\n')
            ];
            const lastSentenceBreak = Math.max(...sentenceBreaks);
            // Use paragraph break if available and reasonable, otherwise use sentence break
            if (paragraphBreak > chunkSize * 0.5) {
                chunk = chunk.substring(0, paragraphBreak);
            }
            else if (lastSentenceBreak > chunkSize * 0.3) {
                // If the sentence break is at least 30% through the chunk
                const breakType = sentenceBreaks.indexOf(lastSentenceBreak);
                // Add 2 to include the period and space/newline
                chunk = chunk.substring(0, lastSentenceBreak + (breakType >= 3 ? 2 : 2));
            }
        }
        // Create chunkObj with proper type that includes optional metadata
        const chunkObj = {
            text: chunk.trim()
        };
        const structuredInfo = detectStructuredInfo(chunk);
        if (structuredInfo.hasCompanyValues || structuredInfo.hasInvestors || structuredInfo.hasLeadership ||
            structuredInfo.hasPricing || structuredInfo.hasProductFeatures || structuredInfo.hasSalesInfo) {
            const metadata = { isStructured: true };
            if (structuredInfo.hasCompanyValues) {
                metadata.infoType = 'company_values';
            }
            else if (structuredInfo.hasInvestors) {
                metadata.infoType = 'investors';
            }
            else if (structuredInfo.hasLeadership) {
                metadata.infoType = 'leadership';
            }
            else if (structuredInfo.hasPricing) {
                metadata.infoType = 'pricing';
            }
            else if (structuredInfo.hasProductFeatures) {
                metadata.infoType = 'product_features';
            }
            else if (structuredInfo.hasSalesInfo) {
                metadata.infoType = 'sales_info';
            }
            chunkObj.metadata = metadata;
        }
        chunks.push(chunkObj);
        currentIndex += chunk.length;
        // Add slight overlap for context if needed
        if (currentIndex < text.length) {
            const lastSentence = findLastSentence(chunk);
            if (lastSentence && lastSentence.length < chunkSize * 0.2) {
                currentIndex -= lastSentence.length;
            }
        }
    }
    return chunks;
}
/**
 * Find the last complete sentence in a text
 */
function findLastSentence(text) {
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 0) {
        return sentences[sentences.length - 1];
    }
    return null;
}
/**
 * Split text into chunks with enhanced contextual information
 *
 * This advanced chunking method extracts contextual information about each chunk
 * to improve retrieval accuracy and answer generation quality.
 *
 * @param text The text to split into chunks
 * @param chunkSize Size of each chunk
 * @param source Source identifier for the document
 * @param generateContext Whether to generate context for each chunk
 * @param existingContext Optional existing document context to use
 * @returns Array of chunks with contextual metadata
 */
const splitIntoChunksWithContext = async (text, chunkSize = 500, source = 'unknown', generateContext = true, existingContext) => {
    // First, generate chunks using the standard method as a base
    const baseChunks = splitIntoChunks(text, chunkSize, source);
    // If context generation is disabled, return the base chunks
    if (!generateContext) {
        return baseChunks;
    }
    // Extract document-level context if not already provided
    let documentContext;
    try {
        if (existingContext) {
            documentContext = existingContext;
            console.log('Using provided document context');
        }
        else {
            console.log('Extracting document context...');
            documentContext = await (0, geminiClient_js_1.extractDocumentContext)(text);
            console.log('Document context extracted successfully');
        }
    }
    catch (error) {
        console.error('Error extracting document context:', error);
        // If document context extraction fails, return base chunks
        return baseChunks;
    }
    // Process each chunk to add contextual information
    const enhancedChunks = [];
    console.log(`Processing ${baseChunks.length} chunks for contextual enhancement...`);
    // Process chunks in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < baseChunks.length; i += batchSize) {
        const batch = baseChunks.slice(i, i + batchSize);
        const batchPromises = batch.map(async (chunk) => {
            try {
                // Skip empty chunks
                if (!chunk.text.trim()) {
                    return {
                        text: chunk.text,
                        metadata: chunk.metadata
                    };
                }
                // Generate context for this chunk
                const chunkContext = await (0, geminiClient_js_1.generateChunkContext)(chunk.text, documentContext);
                // Create enhanced chunk with context
                return {
                    text: chunk.text,
                    metadata: {
                        ...(chunk.metadata || {}),
                        source,
                        context: chunkContext
                    }
                };
            }
            catch (error) {
                console.error(`Error generating context for chunk: ${error}`);
                // If chunk context generation fails, return the base chunk
                return {
                    text: chunk.text,
                    metadata: chunk.metadata
                };
            }
        });
        // Wait for all chunks in this batch to be processed
        const processBatchResults = await Promise.all(batchPromises);
        enhancedChunks.push(...processBatchResults);
        console.log(`Processed batch ${Math.ceil(i / batchSize) + 1}/${Math.ceil(baseChunks.length / batchSize)}`);
    }
    console.log(`Enhanced ${enhancedChunks.length} chunks with contextual information`);
    return enhancedChunks;
};
exports.splitIntoChunksWithContext = splitIntoChunksWithContext;
/**
 * Prepares text for embedding by incorporating contextual information
 * This is a critical part of the contextual retrieval system as it enriches the text
 * with semantic information before embedding
 *
 * @param chunk The contextual chunk containing text and metadata
 * @returns Enhanced text string to be embedded
 */
function prepareTextForEmbedding(chunk) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    // Start with original text
    const originalText = chunk.text;
    const contextParts = [];
    // Add document-level context if available
    if ((_a = chunk.metadata) === null || _a === void 0 ? void 0 : _a.parentDocument) {
        contextParts.push(`Document: ${chunk.metadata.parentDocument}`);
    }
    // Add source information if available
    if ((_b = chunk.metadata) === null || _b === void 0 ? void 0 : _b.source) {
        contextParts.push(`Source: ${chunk.metadata.source}`);
    }
    // --- DOCUMENT CONTEXT ---
    if ((_d = (_c = chunk.metadata) === null || _c === void 0 ? void 0 : _c.context) === null || _d === void 0 ? void 0 : _d.document) {
        const docContext = chunk.metadata.context.document;
        // Add document summary
        if (docContext.summary) {
            contextParts.push(`Document summary: ${docContext.summary}`);
        }
        // Add document topics
        if (docContext.mainTopics && docContext.mainTopics.length > 0) {
            contextParts.push(`Document topics: ${docContext.mainTopics.join(', ')}`);
        }
        // Add document type and technical level
        if (docContext.documentType) {
            let docTypeInfo = `Document type: ${docContext.documentType}`;
            if (docContext.technicalLevel !== undefined) {
                const techLevelTerms = ['non-technical', 'basic', 'intermediate', 'advanced'];
                const techLevel = techLevelTerms[Math.min(docContext.technicalLevel, 3)];
                docTypeInfo += `, ${techLevel} level`;
            }
            contextParts.push(docTypeInfo);
        }
        // Add audience information
        if (docContext.audienceType && docContext.audienceType.length > 0) {
            contextParts.push(`Audience: ${docContext.audienceType.join(', ')}`);
        }
    }
    // --- CHUNK CONTEXT ---
    if ((_e = chunk.metadata) === null || _e === void 0 ? void 0 : _e.context) {
        const context = chunk.metadata.context;
        // Add chunk description
        if (context.description) {
            contextParts.push(`Content: ${context.description}`);
        }
        // Add key points
        if (context.keyPoints && context.keyPoints.length > 0) {
            contextParts.push(`Key points: ${context.keyPoints.join('; ')}`);
        }
        // Add semantic markers for special content types
        const contentMarkers = [];
        if (context.isDefinition) {
            contentMarkers.push('definition');
        }
        if (context.containsExample) {
            contentMarkers.push('example');
        }
        if (contentMarkers.length > 0) {
            contextParts.push(`Contains: ${contentMarkers.join(', ')}`);
        }
        // Add related topics for better semantic search
        if (context.relatedTopics && context.relatedTopics.length > 0) {
            contextParts.push(`Related topics: ${context.relatedTopics.join(', ')}`);
        }
    }
    // --- VISUAL CONTENT ---
    // Add visual content information if available
    if (((_f = chunk.metadata) === null || _f === void 0 ? void 0 : _f.hasVisualContent) && Array.isArray(chunk.visualContent) && chunk.visualContent.length > 0) {
        const visualDescriptions = chunk.visualContent.map(visual => {
            let desc = `${visual.type}`;
            if (visual.description) {
                desc += `: ${visual.description.substring(0, 100)}`;
            }
            if (visual.detectedText) {
                const truncatedText = visual.detectedText.length > 50
                    ? visual.detectedText.substring(0, 50) + '...'
                    : visual.detectedText;
                desc += ` [Text: ${truncatedText}]`;
            }
            return desc;
        });
        contextParts.push(`Visual content: ${visualDescriptions.join(' | ')}`);
    }
    // Add structured info type if available
    if (((_g = chunk.metadata) === null || _g === void 0 ? void 0 : _g.isStructured) && ((_h = chunk.metadata) === null || _h === void 0 ? void 0 : _h.infoType)) {
        contextParts.push(`Content type: ${chunk.metadata.infoType.replace(/_/g, ' ')}`);
    }
    // If we have contextual parts, format them as a structured context prefix
    if (contextParts.length > 0) {
        // Group context by categories to make it more readable and useful for embedding
        return `[CONTEXT: ${contextParts.join(' | ')}] ${originalText}`;
    }
    // If no context is available, return the original text
    return originalText;
}

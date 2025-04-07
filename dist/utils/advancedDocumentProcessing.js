"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeDocument = analyzeDocument;
exports.generateSummaries = generateSummaries;
exports.identifySections = identifySections;
exports.splitSectionIntoChunks = splitSectionIntoChunks;
exports.createSmartChunks = createSmartChunks;
exports.enhanceChunkMetadata = enhanceChunkMetadata;
exports.processDocumentWithUnderstanding = processDocumentWithUnderstanding;
exports.analyzeQuery = analyzeQuery;
exports.calculateContentBoost = calculateContentBoost;
exports.processFileWithUnderstanding = processFileWithUnderstanding;
exports.processTextWithUnderstanding = processTextWithUnderstanding;
exports.extractText = extractText;
exports.storeSmartChunks = storeSmartChunks;
exports.splitTextIntoChunks = splitTextIntoChunks;
exports.createSmartChunkWithMetadata = createSmartChunkWithMetadata;
const documentProcessing_1 = require("./documentProcessing");
const vectorStore_1 = require("./vectorStore");
const openai_1 = require("openai");
// Initialize OpenAI API client
const openai = new openai_1.OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
/**
 * Use the LLM to analyze the document content
 */
async function analyzeDocument(text) {
    const analysisPrompt = `
    Analyze the following document content and provide structured metadata:
    
    1. Identify the document title or generate one if not clear
    2. Identify ALL main topics covered (list of 3-7 topics)
    3. Extract any key entities:
       - People mentioned
       - Products discussed
       - Features described
       - Projects referenced
    4. Identify content type (manual, policy, specs, tutorial, etc.)
    5. Estimate the technical complexity level (1-5)
    6. Determine if this contains sensitive/confidential information (true/false)
    
    Content: 
    ${text.substring(0, 4000)}
    
    Return your analysis as JSON with these fields:
    {
      "title": "Document title",
      "topics": ["topic1", "topic2", ...],
      "entities": {
        "people": ["name1", "name2", ...],
        "products": ["product1", "product2", ...],
        "features": ["feature1", "feature2", ...],
        "projects": ["project1", "project2", ...]
      },
      "contentType": "manual/policy/specs/etc",
      "technicalLevel": 1-5,
      "containsConfidential": true/false
    }
  `;
    try {
        const analysis = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: analysisPrompt }]
        });
        // Parse and return the analysis
        const content = analysis.choices[0].message.content || '{}';
        try {
            return JSON.parse(content);
        }
        catch (parseError) {
            console.warn("Failed to parse JSON from analyzeDocument response:", parseError);
            // Fallback to basic analysis
            return {
                title: extractTitle(content) || 'Untitled Document',
                topics: extractTopics(content) || ['general'],
                entities: {
                    people: [],
                    products: [],
                    features: [],
                    projects: []
                },
                contentType: extractContentType(content) || 'document',
                technicalLevel: extractTechLevel(content) || 3,
                containsConfidential: false
            };
        }
    }
    catch (error) {
        console.error('Error analyzing document:', error);
        // Return a basic analysis if the LLM analysis fails
        return {
            title: 'Untitled Document',
            topics: ['general'],
            entities: {
                people: [],
                products: [],
                features: [],
                projects: []
            },
            contentType: 'document',
            technicalLevel: 3,
            containsConfidential: false
        };
    }
}
/**
 * Generate multiple layers of document summaries
 */
async function generateSummaries(text, analysis) {
    const summaryPrompt = `
    Create the following summaries of this ${analysis.contentType} document:
    
    1. One-line summary (15-20 words)
    2. Paragraph summary (3-5 sentences)
    3. Detailed summary with section breakdown (300-500 words)
    4. List of key points (5-10 bullet points)
    
    Document:
    ${text.substring(0, 6000)}
    
    Return the summaries in this JSON format:
    {
      "oneLine": "One-line summary here",
      "paragraph": "Paragraph summary here",
      "detailed": "Detailed summary here",
      "keyPoints": ["point 1", "point 2", ...]
    }
  `;
    try {
        const summaryResponse = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: summaryPrompt }]
        });
        // Parse the summaries from the response
        const content = summaryResponse.choices[0].message.content || '{}';
        try {
            return JSON.parse(content);
        }
        catch (parseError) {
            console.warn("Failed to parse JSON from generateSummaries response:", parseError);
            // Create basic summaries from the response
            return {
                oneLine: analysis.title,
                paragraph: `Document about ${analysis.topics.join(', ')}.`,
                detailed: "No detailed summary available.",
                keyPoints: analysis.topics.map(topic => `Information about ${topic}`)
            };
        }
    }
    catch (error) {
        console.error('Error generating summaries:', error);
        // Return basic summaries if LLM fails
        return {
            oneLine: analysis.title,
            paragraph: `Document about ${analysis.topics.join(', ')}.`,
            detailed: "No detailed summary available.",
            keyPoints: analysis.topics.map(topic => `Information about ${topic}`)
        };
    }
}
/**
 * Identify logical sections within a document
 */
async function identifySections(text) {
    const sectionPrompt = `
    Divide the following document into logical sections.
    For each section, provide:
    1. A section title
    2. The section content
    
    Document:
    ${text.substring(0, 8000)}
    
    Return the sections in this JSON format:
    [
      {
        "title": "Section title",
        "text": "Section content"
      },
      ...
    ]
  `;
    try {
        const sectionsResponse = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: sectionPrompt }]
        });
        // Parse the sections from the response
        const content = sectionsResponse.choices[0].message.content || '{}';
        try {
            const parsed = JSON.parse(content);
            // Make sure we have an array of sections
            if (Array.isArray(parsed)) {
                return parsed;
            }
            else if (parsed.sections && Array.isArray(parsed.sections)) {
                return parsed.sections;
            }
        }
        catch (parseError) {
            console.warn("Failed to parse JSON from identifySections response:", parseError);
        }
        // If we couldn't parse correctly, return the whole text as one section
        return [{
                title: 'Document Content',
                text: text
            }];
    }
    catch (error) {
        console.error('Error identifying sections:', error);
        // Return the whole text as one section if LLM fails
        return [{
                title: 'Document Content',
                text: text
            }];
    }
}
/**
 * Split section into smaller chunks for embedding
 */
function splitSectionIntoChunks(sectionText, chunkSize = 500) {
    const chunks = [];
    if (sectionText.length <= chunkSize) {
        return [sectionText];
    }
    let currentIndex = 0;
    while (currentIndex < sectionText.length) {
        // Get a chunk of approximately the target size
        let chunk = sectionText.substring(currentIndex, currentIndex + chunkSize);
        // If we're not at the end of the text, try to break at a natural boundary
        if (currentIndex + chunkSize < sectionText.length) {
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
        chunks.push(chunk.trim());
        currentIndex += chunk.length;
        // Add slight overlap for context if needed
        if (currentIndex < sectionText.length) {
            // Find the last complete sentence for overlap
            const lastSentenceMatch = chunk.match(/[^.!?]+[.!?]+\s*$/);
            const lastSentence = lastSentenceMatch ? lastSentenceMatch[0] : '';
            if (lastSentence && lastSentence.length < chunkSize * 0.2) {
                currentIndex -= lastSentence.length;
            }
        }
    }
    return chunks;
}
/**
 * Create smart chunks that maintain document structure
 */
async function createSmartChunks(text, analysis, summaries, sections) {
    const chunks = [];
    // Create a chunk for the overall document
    chunks.push({
        text: summaries.paragraph,
        metadata: {
            source: analysis.title,
            chunkType: 'document_summary',
            topics: analysis.topics,
            contentType: analysis.contentType,
            technicalLevel: analysis.technicalLevel
        }
    });
    // Process each section into chunks
    for (const section of sections) {
        // Generate a summary for this section
        let sectionSummary = '';
        try {
            const sectionSummaryPrompt = `
        Summarize this section in 1-2 sentences:
        
        Section Title: ${section.title}
        Content: ${section.text.substring(0, 2000)}
      `;
            const summaryResponse = await openai.chat.completions.create({
                model: 'gpt-4',
                messages: [{ role: 'user', content: sectionSummaryPrompt }]
            });
            sectionSummary = summaryResponse.choices[0].message.content || '';
        }
        catch (error) {
            console.warn(`Error generating summary for section "${section.title}":`, error);
            sectionSummary = `Section about ${section.title}`;
        }
        // Add a chunk for the section summary
        chunks.push({
            text: sectionSummary,
            metadata: {
                source: `${analysis.title} - ${section.title}`,
                chunkType: 'section_summary',
                topics: analysis.topics,
                contentType: analysis.contentType,
                technicalLevel: analysis.technicalLevel
            }
        });
        // Split the section content into smaller chunks
        const contentChunks = splitSectionIntoChunks(section.text, 1000);
        for (let i = 0; i < contentChunks.length; i++) {
            chunks.push({
                text: contentChunks[i],
                metadata: {
                    source: `${analysis.title} - ${section.title} (Part ${i + 1}/${contentChunks.length})`,
                    chunkType: 'section_content',
                    topics: analysis.topics,
                    contentType: analysis.contentType,
                    technicalLevel: analysis.technicalLevel,
                    sectionTitle: section.title
                }
            });
        }
    }
    return chunks;
}
/**
 * Enhance chunks with rich metadata
 */
function enhanceChunkMetadata(chunk, analysis, source, page) {
    var _a;
    const now = new Date().toISOString();
    return {
        text: chunk.text,
        embedding: chunk.embedding || [], // Handle undefined case
        metadata: {
            source,
            section: (_a = chunk.metadata) === null || _a === void 0 ? void 0 : _a.sectionTitle,
            page,
            topics: analysis.topics,
            contentType: analysis.contentType,
            technicalLevel: analysis.technicalLevel,
            confidentiality: analysis.containsConfidential ? 'confidential' : 'public',
            relatedProducts: analysis.entities.products,
            relatedProjects: analysis.entities.projects,
            lastUpdated: now,
            documentSummary: '', // Removed reference to nonexistent property
            sectionSummary: '' // Removed reference to nonexistent property
        }
    };
}
/**
 * Main function to process new document with advanced understanding
 */
async function processDocumentWithUnderstanding(filePath, mimetype, filename) {
    try {
        // 1. Extract text from document
        const text = await (0, documentProcessing_1.extractText)(filePath, mimetype);
        // 2. Get LLM to analyze the full document
        const documentAnalysis = await analyzeDocument(text);
        // 3. Generate multiple document summaries
        const summaries = await generateSummaries(text, documentAnalysis);
        // 4. Create smart chunks with nested context
        const smartChunks = await createSmartChunks(text, documentAnalysis, summaries, await identifySections(text));
        // 5. Enhance each chunk with rich metadata
        const enhancedChunks = smartChunks.map(chunk => enhanceChunkMetadata(chunk, documentAnalysis, filename));
        // 6. Generate embeddings for all chunks and add to vector store
        for (const chunk of enhancedChunks) {
            chunk.embedding = await embedText(chunk.text);
            (0, vectorStore_1.addToVectorStore)(chunk);
        }
        return {
            analysis: documentAnalysis,
            chunkCount: enhancedChunks.length
        };
    }
    catch (error) {
        console.error('Error processing document with understanding:', error);
        throw new Error(`Failed to process document: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Analyze a query to determine its characteristics
 * This helps in optimizing retrieval and answer generation
 */
async function analyzeQuery(query) {
    const lowerQuery = query.toLowerCase();
    // Simple rule-based analysis
    // In a production system, this would be more sophisticated
    // and potentially use ML models for classification
    // Determine technical level
    const technicalTerms = [
        'algorithm', 'architecture', 'implementation', 'infrastructure',
        'backend', 'frontend', 'api', 'endpoint', 'protocol',
        'encryption', 'schema', 'database', 'integration'
    ];
    // Count technical terms
    const technicalTermCount = technicalTerms.filter(term => lowerQuery.includes(term)).length;
    let technicalLevel = 3; // Default mid-level
    technicalLevel += technicalTermCount * 0.5;
    // Check for simple language that would indicate lower technical level
    if (lowerQuery.includes('simple') ||
        lowerQuery.includes('easy') ||
        lowerQuery.includes('basics')) {
        technicalLevel -= 1;
    }
    // Determine expected response format
    let expectedFormat = 'text';
    if (lowerQuery.includes('step') ||
        lowerQuery.includes('guide') ||
        lowerQuery.includes('how to')) {
        expectedFormat = 'steps';
    }
    else if (lowerQuery.includes('list') ||
        lowerQuery.match(/what are( the)? (different|various|main|key)/)) {
        expectedFormat = 'list';
    }
    else if (lowerQuery.includes('table') ||
        lowerQuery.includes('compare') ||
        lowerQuery.includes('comparison')) {
        expectedFormat = 'table';
    }
    // Determine complexity
    const complexWords = [
        'differences', 'between', 'compare', 'explain', 'why',
        'how', 'technical', 'architecture', 'detail', 'versus'
    ];
    const complexWordCount = complexWords.filter(word => lowerQuery.includes(word)).length;
    let complexity = 2; // Default slightly below mid-level
    complexity += complexWordCount * 0.5;
    // Simple topic extraction
    // This is a placeholder for more sophisticated NER/topic modeling
    const potentialTopics = [
        'pricing', 'features', 'security', 'integration', 'api',
        'comparison', 'implementation', 'enterprise', 'support',
        'demo', 'trial', 'contract', 'discount', 'competitors'
    ];
    const topics = potentialTopics.filter(topic => lowerQuery.includes(topic));
    // Determine urgency
    let urgency = 1; // Default low urgency
    if (lowerQuery.includes('urgent') ||
        lowerQuery.includes('asap') ||
        lowerQuery.includes('immediately')) {
        urgency = 5;
    }
    else if (lowerQuery.includes('soon') ||
        lowerQuery.includes('quickly')) {
        urgency = 3;
    }
    // Normalize scores to intended ranges
    technicalLevel = Math.max(1, Math.min(5, technicalLevel));
    complexity = Math.max(1, Math.min(5, complexity));
    return {
        technicalLevel,
        expectedFormat,
        complexity,
        topics,
        urgency
    };
}
// Helper functions to extract information from non-JSON responses
function extractTitle(text) {
    const titleMatch = text.match(/title:.*?["'](.+?)["']/i);
    return titleMatch ? titleMatch[1] : null;
}
function extractTopics(text) {
    const topicsMatch = text.match(/topics:.*?\[(.*?)\]/i);
    if (topicsMatch && topicsMatch[1]) {
        return topicsMatch[1].split(',').map(t => t.trim().replace(/["']/g, ''));
    }
    return null;
}
function extractContentType(text) {
    const typeMatch = text.match(/contentType:.*?["'](.+?)["']/i);
    return typeMatch ? typeMatch[1].toLowerCase() : null;
}
function extractFormat(text) {
    const formatMatch = text.match(/expectedFormat:.*?["']?(list|explanation|steps|step-by-step|comparison|summary|detailed)["']?/i);
    return formatMatch ? formatMatch[1].toLowerCase() : null;
}
function extractTechLevel(text) {
    const levelMatch = text.match(/technicalLevel:.*?([1-5])/i);
    return levelMatch ? parseInt(levelMatch[1]) : null;
}
/**
 * Calculate content-based relevance boost factors
 */
function calculateContentBoost(queryAnalysis, chunk) {
    let boostFactor = 1.0;
    // Topic overlap
    const topicOverlap = queryAnalysis.topics.filter((topic) => chunk.metadata.topics.includes(topic)).length;
    if (topicOverlap > 0) {
        boostFactor *= 1.0 + (topicOverlap / queryAnalysis.topics.length);
    }
    // Technical level match
    const techLevelDifference = Math.abs(queryAnalysis.technicalLevel - chunk.metadata.technicalLevel);
    if (techLevelDifference <= 1) {
        boostFactor *= 1.2; // Boost if technical levels are a good match
    }
    // Structured content match
    if (queryAnalysis.expectedFormat === 'list' && chunk.text.includes('- ')) {
        boostFactor *= 1.3; // Boost list-like content for list queries
    }
    if (queryAnalysis.expectedFormat === 'steps' &&
        (chunk.text.includes('Step ') || chunk.text.includes('. '))) {
        boostFactor *= 1.3; // Boost step-like content for steps queries
    }
    // Recency boost
    const lastUpdated = new Date(chunk.metadata.lastUpdated).getTime();
    const now = new Date().getTime();
    const daysSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 30) {
        boostFactor *= 1.1; // Slight boost for recent content
    }
    return boostFactor;
}
/**
 * Process a file with full AI understanding
 */
async function processFileWithUnderstanding(file, useDefaultTitle = false) {
    try {
        // Extract text from the file
        const text = await extractText(file);
        // Process the extracted text
        return await processTextWithUnderstanding(text, file.originalname, useDefaultTitle);
    }
    catch (error) {
        console.error('Error processing file with understanding:', error);
        throw error;
    }
}
/**
 * Process text content with full AI understanding
 */
async function processTextWithUnderstanding(text, originalTitle, useDefaultTitle = false) {
    try {
        // Analyze the document to extract metadata
        const analysis = await analyzeDocument(text);
        // Use the provided title if available and requested
        if (useDefaultTitle && originalTitle) {
            analysis.title = originalTitle;
        }
        // Make sure we have a safe title for file operations
        const safeTitle = (analysis.title || originalTitle || 'document').replace(/[^a-zA-Z0-9-_]/g, '_');
        // Generate summaries
        const summaries = await generateSummaries(text, analysis);
        // Identify sections in the document
        const sections = await identifySections(text);
        // Create smart chunks that preserve document structure
        const chunks = await createSmartChunks(text, analysis, summaries, sections);
        // Store the chunks in the vector store
        const embeddings = await storeSmartChunks(chunks);
        return {
            title: analysis.title || 'Untitled Document',
            topics: analysis.topics,
            contentType: analysis.contentType,
            summaries,
            chunks: chunks.length,
            sections: sections.map(s => s.title)
        };
    }
    catch (error) {
        console.error('Error processing text with understanding:', error);
        throw error;
    }
}
/**
 * Extract text from a file
 */
async function extractText(file) {
    // For simplicity, we're just returning the file buffer as text
    // In a real implementation, you would use libraries like pdf-parse, docx, etc.
    return file.buffer.toString('utf-8');
}
/**
 * Store smart chunks in the vector store
 */
async function storeSmartChunks(chunks) {
    let storedCount = 0;
    for (const chunk of chunks) {
        try {
            // Generate embedding for the chunk text
            const embedding = await embedText(chunk.text);
            // Store in vector database
            (0, vectorStore_1.addToVectorStore)({
                text: chunk.text,
                metadata: chunk.metadata,
                embedding
            });
            storedCount++;
        }
        catch (error) {
            console.error('Error storing chunk:', error);
        }
    }
    return storedCount;
}
/**
 * Generate embedding for text
 */
async function embedText(text) {
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: text
        });
        return response.data[0].embedding;
    }
    catch (error) {
        console.error('Error generating embedding:', error);
        // Return a dummy embedding for error cases
        return Array(1536).fill(0);
    }
}
/**
 * Helper function to split text into chunks
 */
function splitTextIntoChunks(text, maxChunkSize = 1000) {
    // Implement text splitting logic that preserves paragraphs and sentence boundaries
    const chunks = [];
    // Simple implementation for now - split by paragraphs then recombine to stay under maxChunkSize
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = '';
    for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = paragraph;
        }
        else {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    return chunks;
}
/**
 * Create a smart chunk with metadata
 */
function createSmartChunkWithMetadata(text, section, analysis, partIndex, totalParts) {
    return {
        text,
        metadata: {
            source: `${analysis.title} - ${section.title} (Part ${partIndex}/${totalParts})`,
            chunkType: 'section_content',
            topics: analysis.topics,
            contentType: analysis.contentType,
            technicalLevel: analysis.technicalLevel,
            sectionTitle: section.title
        }
    };
}

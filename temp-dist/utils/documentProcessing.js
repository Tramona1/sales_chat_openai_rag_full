"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitIntoChunksWithContext = void 0;
exports.extractText = extractText;
exports.detectStructuredInfo = detectStructuredInfo;
exports.splitIntoChunks = splitIntoChunks;
exports.prepareTextForEmbedding = prepareTextForEmbedding;
var fs_1 = __importDefault(require("fs"));
var mammoth_1 = __importDefault(require("mammoth"));
var pdf_parse_1 = __importDefault(require("pdf-parse"));
var geminiClient_1 = require("./geminiClient");
var documentAnalysis_1 = require("./documentAnalysis");
/**
 * Extract text content from various document formats
 * @param filePath Path to the file
 * @param mimetype MIME type of the file
 * @returns Extracted text content
 */
function extractText(filePath, mimetype) {
    return __awaiter(this, void 0, void 0, function () {
        var dataBuffer, result, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 6, , 7]);
                    if (!(mimetype === 'application/pdf')) return [3 /*break*/, 2];
                    dataBuffer = fs_1.default.readFileSync(filePath);
                    return [4 /*yield*/, (0, pdf_parse_1.default)(dataBuffer)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.text];
                case 2:
                    if (!(mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) return [3 /*break*/, 4];
                    return [4 /*yield*/, extractTextFromDoc(filePath)];
                case 3:
                    result = _a.sent();
                    return [2 /*return*/, result];
                case 4:
                    if (mimetype === 'text/plain') {
                        return [2 /*return*/, fs_1.default.promises.readFile(filePath, 'utf-8')];
                    }
                    else {
                        throw new Error("Unsupported file type: ".concat(mimetype));
                    }
                    _a.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_1 = _a.sent();
                    console.error('Error extracting text:', error_1);
                    throw new Error("Failed to extract text from document: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)));
                case 7: return [2 /*return*/];
            }
        });
    });
}
function extractTextFromDoc(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var fileBuffer, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, fs_1.default.promises.readFile(filePath)];
                case 1:
                    fileBuffer = _a.sent();
                    return [4 /*yield*/, mammoth_1.default.extractRawText(fileBuffer)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.value];
                case 3:
                    error_2 = _a.sent();
                    console.error('Error extracting text from DOCX:', error_2);
                    throw new Error("Failed to extract text from DOCX file: ".concat(error_2.message || 'Unknown error'));
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Detect if text contains structured information like company values, investors,
 * leadership, pricing, or sales-related content
 */
function detectStructuredInfo(text) {
    var textLower = text.toLowerCase();
    // Detect company values
    var hasCompanyValues = textLower.includes('our values') ||
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
    var hasInvestors = textLower.includes('investor') ||
        textLower.includes('investors') ||
        textLower.includes('funding') ||
        textLower.includes('backed by') ||
        textLower.includes('investment') ||
        textLower.includes('venture capital') ||
        textLower.includes('series ') ||
        textLower.includes('financing') ||
        textLower.includes('raised');
    // Detect leadership information
    var hasLeadership = textLower.includes('founder') ||
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
    var hasPricing = textLower.includes('pricing') ||
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
    var hasProductFeatures = textLower.includes('feature') ||
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
    var hasSalesInfo = textLower.includes('sales pitch') ||
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
        hasCompanyValues: hasCompanyValues,
        hasInvestors: hasInvestors,
        hasLeadership: hasLeadership,
        hasPricing: hasPricing,
        hasProductFeatures: hasProductFeatures,
        hasSalesInfo: hasSalesInfo
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
function splitIntoChunks(text, chunkSize, source) {
    if (chunkSize === void 0) { chunkSize = 500; }
    // Remove excess whitespace
    var cleanedText = text.replace(/\s+/g, ' ').trim();
    if (cleanedText.length <= chunkSize) {
        // For small text, check if it contains structured information
        var structuredInfo = detectStructuredInfo(cleanedText);
        var metadata = {};
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
        return [{ text: cleanedText, metadata: metadata }];
    }
    // If this is a careers or about page, we may need special handling
    var isAboutPage = (source === null || source === void 0 ? void 0 : source.includes('/about')) || (source === null || source === void 0 ? void 0 : source.toLowerCase().includes('about us'));
    var isCareersPage = (source === null || source === void 0 ? void 0 : source.includes('/careers')) || (source === null || source === void 0 ? void 0 : source.toLowerCase().includes('careers'));
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
    var chunks = [];
    // Try to identify sections in the text
    var sections = identifySections(text);
    // If we identified structured sections, process them specially
    if (sections.length > 0) {
        for (var _i = 0, sections_1 = sections; _i < sections_1.length; _i++) {
            var section = sections_1[_i];
            var structuredInfo = detectStructuredInfo(section.text);
            var metadata = {};
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
                chunks.push({ text: section.text, metadata: metadata });
            }
            else {
                // If too large, split but preserve the metadata
                var sectionChunks = splitRegularContent(section.text, chunkSize);
                for (var _a = 0, sectionChunks_1 = sectionChunks; _a < sectionChunks_1.length; _a++) {
                    var chunk = sectionChunks_1[_a];
                    if (metadata.isStructured) {
                        chunk.metadata = __assign({}, metadata);
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
    var sections = [];
    // Common section indicators
    var sectionIndicators = [
        'our values', 'company values', 'our investors', 'our mission',
        'leadership', 'team', 'about us', 'our story', 'vision',
        'what we do', 'who we are', 'our investors'
    ];
    // Try to split by common headings and indicators
    var remainingText = text;
    // First pass: Look for section headings
    for (var _i = 0, sectionIndicators_1 = sectionIndicators; _i < sectionIndicators_1.length; _i++) {
        var indicator = sectionIndicators_1[_i];
        var indicatorRegex = new RegExp("(^|\\s)".concat(indicator, "[:\\s]"), 'i');
        var match = remainingText.match(indicatorRegex);
        if (match && match.index !== undefined) {
            // Find the next section indicator after this one
            var nextIndex = remainingText.length;
            for (var _a = 0, sectionIndicators_2 = sectionIndicators; _a < sectionIndicators_2.length; _a++) {
                var nextIndicator = sectionIndicators_2[_a];
                if (nextIndicator === indicator)
                    continue;
                var nextRegex = new RegExp("(^|\\s)".concat(nextIndicator, "[:\\s]"), 'i');
                var nextMatch = remainingText.slice(match.index + indicator.length).match(nextRegex);
                if (nextMatch && nextMatch.index !== undefined) {
                    nextIndex = Math.min(nextIndex, match.index + indicator.length + nextMatch.index);
                }
            }
            // Extract this section
            var sectionText = remainingText.slice(Math.max(0, match.index - 20), // Include some context before
            nextIndex + 20 // Include some context after
            ).trim();
            if (sectionText.length > 50) { // Ensure it's a meaningful section
                sections.push({ text: sectionText, type: indicator });
            }
        }
    }
    // If we didn't find sections, try another approach with paragraph breaks
    if (sections.length === 0) {
        var paragraphs = text.split(/\n\s*\n/);
        var currentSection = "";
        var currentType = undefined;
        for (var _b = 0, paragraphs_1 = paragraphs; _b < paragraphs_1.length; _b++) {
            var paragraph = paragraphs_1[_b];
            if (paragraph.trim().length < 10)
                continue; // Skip very short paragraphs
            // Check if this paragraph starts a new section
            var foundNewSection = false;
            for (var _c = 0, sectionIndicators_3 = sectionIndicators; _c < sectionIndicators_3.length; _c++) {
                var indicator = sectionIndicators_3[_c];
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
        sections.push({ text: text });
    }
    return sections;
}
/**
 * Split regular non-structured content into chunks of appropriate size
 * Enhanced to prioritize paragraph breaks for chunk boundaries
 */
function splitRegularContent(text, chunkSize) {
    // Initial cleaning
    var cleanedText = text.replace(/\s+/g, ' ').trim();
    // If the text is already small enough, return it as-is
    if (cleanedText.length <= chunkSize) {
        return [{ text: cleanedText }];
    }
    var chunks = [];
    // First, try to split on double newlines (paragraph breaks)
    var paragraphs = text.split(/\n\s*\n+/);
    var currentChunk = '';
    for (var _i = 0, paragraphs_2 = paragraphs; _i < paragraphs_2.length; _i++) {
        var paragraph = paragraphs_2[_i];
        // Clean the paragraph
        var cleanedParagraph = paragraph.replace(/\s+/g, ' ').trim();
        if (!cleanedParagraph)
            continue; // Skip empty paragraphs
        // If adding this paragraph exceeds the chunk size and we already have content in the chunk
        if (currentChunk.length > 0 && (currentChunk.length + cleanedParagraph.length + 1) > chunkSize) {
            // Save the current chunk
            chunks.push({ text: currentChunk });
            currentChunk = cleanedParagraph;
        }
        // If this single paragraph is larger than the chunk size
        else if (cleanedParagraph.length > chunkSize) {
            // If we have content in the current chunk, save it first
            if (currentChunk.length > 0) {
                chunks.push({ text: currentChunk });
                currentChunk = '';
            }
            // Split the large paragraph on sentence boundaries
            var sentences = cleanedParagraph.match(/[^.!?]+[.!?]+/g) || [cleanedParagraph];
            var sentenceChunk = '';
            for (var _a = 0, sentences_1 = sentences; _a < sentences_1.length; _a++) {
                var sentence = sentences_1[_a];
                if (sentenceChunk.length + sentence.length + 1 <= chunkSize || sentenceChunk.length === 0) {
                    sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
                }
                else {
                    chunks.push({ text: sentenceChunk });
                    sentenceChunk = sentence;
                }
            }
            // Add any remaining sentence chunk
            if (sentenceChunk) {
                if (currentChunk.length + sentenceChunk.length + 1 <= chunkSize) {
                    currentChunk += (currentChunk ? ' ' : '') + sentenceChunk;
                }
                else {
                    chunks.push({ text: sentenceChunk });
                }
            }
        }
        // Otherwise, add the paragraph to the current chunk
        else {
            currentChunk += (currentChunk ? ' ' : '') + cleanedParagraph;
        }
    }
    // Add the last chunk if there's any content left
    if (currentChunk) {
        chunks.push({ text: currentChunk });
    }
    return chunks;
}
/**
 * Find the last complete sentence in a text
 */
function findLastSentence(text) {
    var sentences = text.match(/[^.!?]+[.!?]+/g);
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
var splitIntoChunksWithContext = function (text_1) {
    var args_1 = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args_1[_i - 1] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([text_1], args_1, true), void 0, function (text, chunkSize, source, generateContext, existingContext) {
        var baseChunks, documentContext, documentAnalysis, error_3, enhancedChunks, batchSize, i, batch, batchPromises, processBatchResults;
        if (chunkSize === void 0) { chunkSize = 500; }
        if (source === void 0) { source = 'unknown'; }
        if (generateContext === void 0) { generateContext = true; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    baseChunks = splitIntoChunks(text, chunkSize, source);
                    // If context generation is disabled, return the base chunks
                    if (!generateContext) {
                        return [2 /*return*/, baseChunks];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    if (!existingContext) return [3 /*break*/, 2];
                    documentContext = existingContext;
                    console.log('Using provided document context');
                    return [3 /*break*/, 4];
                case 2:
                    console.log('Extracting document context...');
                    return [4 /*yield*/, (0, documentAnalysis_1.analyzeDocument)(text, source)];
                case 3:
                    documentAnalysis = _a.sent();
                    documentContext = documentAnalysis.documentContext;
                    console.log('Document context extracted successfully');
                    _a.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_3 = _a.sent();
                    console.error('Error extracting document context:', error_3);
                    // If document context extraction fails, return base chunks
                    return [2 /*return*/, baseChunks];
                case 6:
                    enhancedChunks = [];
                    console.log("Processing ".concat(baseChunks.length, " chunks for contextual enhancement..."));
                    batchSize = 5;
                    i = 0;
                    _a.label = 7;
                case 7:
                    if (!(i < baseChunks.length)) return [3 /*break*/, 10];
                    batch = baseChunks.slice(i, i + batchSize);
                    batchPromises = batch.map(function (chunk) { return __awaiter(void 0, void 0, void 0, function () {
                        var chunkContext, error_4;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    // Skip empty chunks
                                    if (!chunk.text.trim()) {
                                        return [2 /*return*/, {
                                                text: chunk.text,
                                                metadata: chunk.metadata
                                            }];
                                    }
                                    return [4 /*yield*/, (0, geminiClient_1.generateChunkContext)(chunk.text, documentContext)];
                                case 1:
                                    chunkContext = _a.sent();
                                    // Create enhanced chunk with context
                                    return [2 /*return*/, {
                                            text: chunk.text,
                                            metadata: __assign(__assign({}, (chunk.metadata || {})), { source: source, 
                                                // Map fields from generateChunkContext and add required defaults
                                                context: {
                                                    description: chunkContext.summary || '', // Use summary as description, or default
                                                    keyPoints: chunkContext.keyPoints || [], // Use existing keyPoints or default
                                                    isDefinition: false, // Default
                                                    containsExample: false, // Default
                                                    relatedTopics: [] // Default
                                                } })
                                        }];
                                case 2:
                                    error_4 = _a.sent();
                                    console.error("Error generating context for chunk: ".concat(error_4));
                                    // If chunk context generation fails, return the base chunk
                                    return [2 /*return*/, {
                                            text: chunk.text,
                                            metadata: chunk.metadata
                                        }];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.all(batchPromises)];
                case 8:
                    processBatchResults = _a.sent();
                    enhancedChunks.push.apply(enhancedChunks, processBatchResults);
                    console.log("Processed batch ".concat(Math.ceil(i / batchSize) + 1, "/").concat(Math.ceil(baseChunks.length / batchSize)));
                    _a.label = 9;
                case 9:
                    i += batchSize;
                    return [3 /*break*/, 7];
                case 10:
                    console.log("Enhanced ".concat(enhancedChunks.length, " chunks with contextual information"));
                    return [2 /*return*/, enhancedChunks];
            }
        });
    });
};
exports.splitIntoChunksWithContext = splitIntoChunksWithContext;
/**
 * Prepare text for embedding by adding contextual information
 * @param chunk Chunk with text and metadata
 * @returns Enhanced text string to be embedded
 */
function prepareTextForEmbedding(chunk) {
    var _a, _b, _c, _d, _e, _f;
    // Convert to our extended type
    var extendedChunk = asExtendedChunk(chunk);
    // Start with original text
    var originalText = extendedChunk.text;
    var contextParts = [];
    // Add source if available
    if ((_a = extendedChunk.metadata) === null || _a === void 0 ? void 0 : _a.source) {
        contextParts.push("Source: ".concat(extendedChunk.metadata.source));
    }
    // --- DOCUMENT CONTEXT ---
    if ((_b = extendedChunk.metadata) === null || _b === void 0 ? void 0 : _b.context) {
        // Convert to our extended context type
        var extendedContext = asExtendedContext(extendedChunk.metadata.context);
        if (extendedContext.document) {
            var docContext = extendedContext.document;
            // Add document summary
            if (docContext.summary) {
                contextParts.push("Document summary: ".concat(docContext.summary));
            }
            // Add document topics
            if (docContext.mainTopics && docContext.mainTopics.length > 0) {
                contextParts.push("Document topics: ".concat(docContext.mainTopics.join(', ')));
            }
            // Add document type and technical level
            if (docContext.documentType) {
                var docTypeInfo = "Document type: ".concat(docContext.documentType);
                if (docContext.technicalLevel !== undefined) {
                    var techLevelTerms = ['non-technical', 'basic', 'intermediate', 'advanced'];
                    var techLevel = techLevelTerms[Math.min(docContext.technicalLevel, 3)];
                    docTypeInfo += ", ".concat(techLevel, " level");
                }
                contextParts.push(docTypeInfo);
            }
            // Add audience information
            if (docContext.audienceType && docContext.audienceType.length > 0) {
                contextParts.push("Audience: ".concat(docContext.audienceType.join(', ')));
            }
        }
    }
    // --- CHUNK CONTEXT ---
    if ((_c = extendedChunk.metadata) === null || _c === void 0 ? void 0 : _c.context) {
        var context = extendedChunk.metadata.context;
        // Add chunk description
        if (context.description) {
            contextParts.push("Content: ".concat(context.description));
        }
        // Add key points
        if (context.keyPoints && context.keyPoints.length > 0) {
            contextParts.push("Key points: ".concat(context.keyPoints.join('; ')));
        }
        // Add semantic markers for special content types
        var contentMarkers = [];
        if (context.isDefinition) {
            contentMarkers.push('definition');
        }
        if (context.containsExample) {
            contentMarkers.push('example');
        }
        if (contentMarkers.length > 0) {
            contextParts.push("Contains: ".concat(contentMarkers.join(', ')));
        }
        // Add related topics for better semantic search
        if (context.relatedTopics && context.relatedTopics.length > 0) {
            contextParts.push("Related topics: ".concat(context.relatedTopics.join(', ')));
        }
    }
    // --- VISUAL CONTENT ---
    // Add visual content information if available
    if (((_d = extendedChunk.metadata) === null || _d === void 0 ? void 0 : _d.hasVisualContent) && Array.isArray(extendedChunk.visualContent) && extendedChunk.visualContent.length > 0) {
        var visualDescriptions = extendedChunk.visualContent.map(function (visual) {
            var desc = "".concat(visual.type);
            if (visual.description) {
                desc += ": ".concat(visual.description.substring(0, 100));
            }
            if (visual.detectedText) {
                var truncatedText = visual.detectedText.length > 50
                    ? visual.detectedText.substring(0, 50) + '...'
                    : visual.detectedText;
                desc += " [Text: ".concat(truncatedText, "]");
            }
            return desc;
        });
        contextParts.push("Visual content: ".concat(visualDescriptions.join(' | ')));
    }
    // Add structured info type if available
    if (((_e = extendedChunk.metadata) === null || _e === void 0 ? void 0 : _e.isStructured) && ((_f = extendedChunk.metadata) === null || _f === void 0 ? void 0 : _f.infoType)) {
        contextParts.push("Content type: ".concat(extendedChunk.metadata.infoType.replace(/_/g, ' ')));
    }
    // If we have contextual parts, format them as a structured context prefix
    if (contextParts.length > 0) {
        // Group context by categories to make it more readable and useful for embedding
        return "[CONTEXT: ".concat(contextParts.join(' | '), "] ").concat(originalText);
    }
    // If no context is available, return the original text
    return originalText;
}
// Type assertion function to ensure we're using our extended interfaces
function asExtendedChunk(chunk) {
    return chunk;
}
// Type assertion function to ensure we're using our extended context interface
function asExtendedContext(context) {
    return context;
}

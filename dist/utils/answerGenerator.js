/**
 * Answer generation utility for the RAG system
 * Generates accurate answers from search results using the OpenAI API
 * With fallback to Gemini for handling large contexts
 */
import { logError, logInfo, logWarning } from './logger';
import { generateGeminiChatCompletion } from './geminiClient';
import { AI_SETTINGS } from './modelConfig';
// Token estimation constants
const AVG_TOKENS_PER_WORD = 1.3; // A rough approximation for token estimation
const MAX_TOKENS_OPENAI = 8000; // Conservative limit for OpenAI (leaving room for response)
const MAX_CONTEXT_LENGTH = 15000; // Maximum context length for any model
/**
 * Estimate tokens in a text string
 * This is a rough estimation, not exact but helpful for preventing API errors
 */
function estimateTokenCount(text) {
    if (!text)
        return 0;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount * AVG_TOKENS_PER_WORD);
}
/**
 * Check if the query is a common greeting or conversational input with no information need
 * Using a much more restrictive list to ensure we search documents for most queries
 */
function isBasicConversational(query) {
    const conversationalPatterns = [
        // Basic greetings only
        'hello', 'hi', 'hey', 'greetings', 'howdy',
        // Simple gratitude
        'thanks', 'thank you',
        // Basic farewells
        'bye', 'goodbye'
    ];
    const lowerQuery = query.toLowerCase().trim();
    // Only match exact greetings or very simple patterns
    return conversationalPatterns.some(pattern => lowerQuery === pattern ||
        lowerQuery === pattern + '!' ||
        lowerQuery === pattern + '.');
}
/**
 * Handle simple conversational queries that don't need knowledge base
 */
async function handleConversationalQuery(query, conversationHistory) {
    const systemPrompt = `You are a helpful, friendly, and professional AI assistant for a sales team of Workstream, a company that provides HR, Payroll, and Hiring solutions for the hourly workforce.
You represent the company and should be helpful, friendly and concise.
You are part of the sales department and your job is to help the sales team with information.
When asked about specific details about the company, products, customers, etc., make sure when summarizing that you include only the most relevant information.`;
    // Process conversation history to a string format if provided
    const historyText = conversationHistory ? formatConversationHistory(conversationHistory) : '';
    let userPrompt = query;
    if (historyText) {
        userPrompt = `Previous conversation:\n${historyText}\n\nCurrent message: ${query}`;
    }
    try {
        return await generateGeminiChatCompletion(systemPrompt, userPrompt);
    }
    catch (error) {
        logError('Error generating conversational response with Gemini', error);
        return "Hello! I'm here to help with your sales questions. What would you like to know about our company, products, or services?";
    }
}
/**
 * Summarize context when it's too large
 * Uses Gemini for efficient summarization
 */
async function summarizeContext(query, context) {
    try {
        console.log(`Context too large (${estimateTokenCount(context)} tokens), summarizing with Gemini...`);
        const systemPrompt = `You are an expert summarizer for Workstream, an HR, Payroll, and Hiring platform for the hourly workforce. Your task is to condense the provided text to answer a specific question accurately.
IMPORTANT: When summarizing company-specific information about Workstream:
1. Make sure you are including all the information that is relevant to the question
2. Preserve specific names, numbers, dates, and technical details exactly as they appear
3. Do not generalize or substitute real company information
4. Be careful, and make sure you are including all the information that is relevant to the question

For investor-related questions, be sure to include:
- Names of all investors and investment firms mentioned
- Funding rounds and amounts
- Dates of investments
- Any quotes from investors`;
        const userPrompt = `Question: ${query}
    
Here is the content to summarize while keeping information relevant to the question:

${context}

Provide a detailed summary that maintains all key information and would allow someone to fully answer the question without needing the original text. 
For investor questions, include all investor names, funding rounds, and investment details exactly as they appear in the text.
Remember to maintain the company's voice - when using "our," "we," or "us," speak from Workstream's perspective.`;
        const summary = await generateGeminiChatCompletion(systemPrompt, userPrompt);
        console.log(`Successfully summarized context with Gemini. Reduced from ${estimateTokenCount(context)} to approximately ${estimateTokenCount(summary)} tokens`);
        return summary;
    }
    catch (error) {
        logError('Error summarizing context with Gemini', error);
        // If summarization fails, we'll need to truncate instead
        console.log('Falling back to simple truncation for context');
        // Take first part of each context item to fit within limits
        const contextItems = context.split('\n\n');
        let truncatedContext = '';
        const maxCharsPerItem = Math.floor(8000 / contextItems.length);
        for (const item of contextItems) {
            truncatedContext += item.substring(0, maxCharsPerItem) + '\n\n';
        }
        return truncatedContext;
    }
}
/**
 * Generate an answer using Gemini model
 */
async function generateGeminiAnswer(query, contextText, options) {
    // Format conversation history if provided
    const historyText = options.conversationHistory ?
        formatConversationHistory(options.conversationHistory) : '';
    const systemPrompt = `You are a knowledgeable AI assistant for Workstream, an HR, Payroll, and Hiring platform for the hourly workforce.
You have access to our company's knowledge base and should use that information to answer questions.

IMPORTANT: You represent our company. When answering questions about "our company," "our products," "our services," or referring to "we" or "us," you should speak from the perspective of a company representative.

Answer the user's question using the provided context. The context contains information from our company's knowledge base.

If the context doesn't contain enough information to fully answer the question, acknowledge that you don't have complete information on that specific topic in your knowledge base, but try to be helpful with what you do know.

Be conversational and professional in your response, as if you're having a discussion with a colleague.
${options.includeSourceCitations ? 'If appropriate, you may include source citations using [1], [2], etc. format to reference the provided context.' : 'Do not include explicit source citations in your answer.'}`;
    // Include conversation history if available
    let userPrompt;
    if (historyText) {
        userPrompt = `Previous conversation:\n${historyText}\n\nCurrent question: ${query}\n\nContext:\n${contextText}\n\nAnswer:`;
    }
    else {
        userPrompt = `Question: ${query}\n\nContext:\n${contextText}\n\nAnswer:`;
    }
    return await generateGeminiChatCompletion(systemPrompt, userPrompt);
}
/**
 * Generate an answer based on retrieved context and the user's query
 *
 * @param query The user's original query
 * @param searchResults The search results from the retrieval system
 * @param options Optional settings for answer generation
 * @returns A string with the generated answer
 */
export async function generateAnswer(query, searchResults, options = {}) {
    try {
        // Only handle basic greetings conversationally
        // Most questions should try to search the knowledge base
        if (isBasicConversational(query)) {
            // Use Gemini for conversational query as well for consistency
            try {
                logInfo('Handling basic conversational query with Gemini...');
                const systemPrompt = options.systemPrompt || `You are a helpful, friendly, and professional AI assistant for a sales team of Workstream, a company that provides HR, Payroll, and Hiring solutions for the hourly workforce.
You represent the company and should be helpful, friendly and concise.
You are part of the sales department and your job is to help the sales team with information.
When asked about specific details about the company, products, customers, etc., make sure when summarizing that you include only the most relevant information.`;
                const historyText = options.conversationHistory ? formatConversationHistory(options.conversationHistory) : '';
                let userPrompt = query;
                if (historyText) {
                    userPrompt = `Previous conversation:\n${historyText}\n\nCurrent message: ${query}`;
                }
                return await generateGeminiChatCompletion(systemPrompt, userPrompt);
            }
            catch (convError) {
                logError('Error generating conversational response with Gemini', convError);
                return "Hello! I'm here to help with your sales questions. What would you like to know about our company, products, or services?";
            }
        }
        // Use options or defaults
        const model = options.model || AI_SETTINGS.defaultModel;
        const includeSourceCitations = options.includeSourceCitations ?? true;
        const maxSourcesInAnswer = options.maxSourcesInAnswer || 10;
        // For company-specific questions with no results, we need to acknowledge the limitation
        if (!searchResults || searchResults.length === 0) {
            const companySpecificTerms = [
                'company', 'our', 'we', 'us', 'client', 'customer', 'product',
                'service', 'price', 'pricing', 'feature', 'offering', 'team', 'investor'
            ];
            const lowerQuery = query.toLowerCase();
            const isLikelyCompanySpecific = companySpecificTerms.some(term => lowerQuery.includes(term));
            // Use a company-specific fallback message with more helpful information
            if (isLikelyCompanySpecific) {
                // Determine which topics are being asked about to provide relevant information
                const isInvestorQuery = lowerQuery.includes('investor') || lowerQuery.includes('funding');
                const isCustomerQuery = lowerQuery.includes('customer') || lowerQuery.includes('client');
                const isProductQuery = lowerQuery.includes('product') || lowerQuery.includes('feature');
                let fallbackPrompt = `You are a knowledgeable sales representative for Workstream, an HR, Payroll, and Hiring platform for the hourly workforce.

The user asked: "${query}"

Unfortunately, we don't have specific information in our knowledge base to fully answer this particular question. However, please provide:
1. A helpful response that acknowledges the specific limitation
2. Share general information we do know about the topic (if available)
3. Offer to help with related information we might have

`;
                // Add topic-specific context to help generate a better fallback response
                if (isInvestorQuery) {
                    fallbackPrompt += `
For investor-related questions:
- We know Workstream is backed by several investors including GGV Capital, Bond, Coatue, Basis Set Ventures, CRV, and Peterson Ventures
- We've had funding rounds including a Series A and Series B
- Our investors page is at https://www.workstream.us/investors
        
Please incorporate this general investor information while clearly stating that you don't have the specific details requested.`;
                }
                if (isCustomerQuery) {
                    fallbackPrompt += `
For customer-related questions:
- Workstream serves hourly workforce businesses across various industries
- We have case studies and customer testimonials on our website
        
Please incorporate this general customer information while clearly stating that you don't have the specific details requested.`;
                }
                if (isProductQuery) {
                    fallbackPrompt += `
For product-related questions:
- Workstream offers HR, Payroll, and Hiring solutions for the hourly workforce
- Our platform includes features for recruitment, onboarding, and workforce management
        
Please incorporate this general product information while clearly stating that you don't have the specific details requested.`;
                }
                // For fallback message with topic context
                let userPrompt = query;
                if (options.conversationHistory) {
                    const formattedHistory = formatConversationHistory(options.conversationHistory);
                    if (formattedHistory) {
                        userPrompt = `Previous conversation:\n${formattedHistory}\n\nCurrent question: ${query}`;
                    }
                }
                try {
                    logWarning('No search results found, generating fallback message with Gemini...');
                    return await generateGeminiChatCompletion("You are a helpful AI assistant.", fallbackPrompt);
                }
                catch (fallbackError) {
                    logError('Error generating fallback message with Gemini', fallbackError);
                    return "I couldn't find specific information on that topic in our knowledge base. Is there something else I can help you find?";
                }
            }
            else {
                // Standard fallback for non-company specific queries with no results
                return "I couldn't find information related to your query in the knowledge base.";
            }
        }
        // Prepare context from search results
        let contextText = "";
        const sources = [];
        searchResults.slice(0, maxSourcesInAnswer).forEach((result, index) => {
            contextText += `Source [${index + 1}]: ${result.source || 'Unknown'}\nContent: ${result.text}\n\n`;
            if (result.source) {
                sources.push(result.source);
            }
        });
        // Estimate token count for the combined query + context
        const promptEstimate = estimateTokenCount(query + contextText);
        logInfo(`Estimated prompt tokens (query + context): ${promptEstimate}`);
        // Check if context needs summarization (Use a Gemini-friendly limit, e.g., ~30k tokens for Flash 1.5 context window, be conservative)
        // Let's use a conservative limit like 28000 tokens to leave space for query, prompt, and response
        const MAX_GEMINI_CONTEXT_TOKENS = 28000;
        if (promptEstimate > MAX_GEMINI_CONTEXT_TOKENS) {
            logWarning(`Context estimate (${promptEstimate} tokens) exceeds limit (${MAX_GEMINI_CONTEXT_TOKENS}). Summarizing...`);
            contextText = await summarizeContext(query, contextText);
            logInfo(`Summarized context token estimate: ${estimateTokenCount(contextText)}`);
        }
        // Prepare prompts for the final answer generation using Gemini
        const systemPrompt = options.systemPrompt || AI_SETTINGS.systemPrompt;
        const historyText = options.conversationHistory ? formatConversationHistory(options.conversationHistory) : '';
        let userPrompt;
        if (historyText) {
            userPrompt = `Previous conversation:\n${historyText}\n\nCurrent question: ${query}\n\nUse the following context to answer the question:
${contextText}\nAnswer:`;
        }
        else {
            userPrompt = `Question: ${query}\n\nUse the following context to answer the question:
${contextText}\nAnswer:`;
        }
        // Use Gemini for the final answer generation
        logInfo(`Generating final answer with Gemini model: ${model}...`);
        try {
            return await generateGeminiChatCompletion(systemPrompt, userPrompt);
        }
        catch (generationError) {
            logError('Error generating final answer with Gemini', generationError);
            return "I apologize, but I encountered an issue generating a final answer. Please try rephrasing your question or try again later.";
        }
    }
    catch (error) {
        logError('Error in generateAnswer function', error);
        return "An unexpected error occurred while processing your request.";
    }
}
/**
 * Generate an answer based on retrieved context with multi-modal awareness
 * This function handles both text and visual elements in the search results
 *
 * @param query The user's original query
 * @param searchResults The multi-modal search results from the retrieval system
 * @param options Optional settings for answer generation
 * @returns A string with the generated answer
 */
export async function generateAnswerWithVisualContext(query, searchResults, options = {}) {
    try {
        // Only handle basic greetings conversationally 
        if (isBasicConversational(query)) {
            return await handleConversationalQuery(query, options.conversationHistory);
        }
        // Use options or defaults
        const model = options.model || AI_SETTINGS.defaultModel;
        const includeSourceCitations = options.includeSourceCitations ?? true;
        const maxSourcesInAnswer = options.maxSourcesInAnswer || 10;
        const visualFocus = options.visualFocus || false;
        const visualTypes = options.visualTypes || [];
        const includeImageUrls = options.includeImageUrls ?? true; // Default to true for including image URLs
        // For company-specific questions with no results, fall back to standard handling
        if (!searchResults || searchResults.length === 0) {
            // Reuse the no-results logic from the standard generateAnswer function
            const lowerQuery = query.toLowerCase();
            const companySpecificTerms = [
                'company', 'our', 'we', 'us', 'client', 'customer', 'product',
                'service', 'price', 'pricing', 'feature', 'offering', 'team', 'investor'
            ];
            const isLikelyCompanySpecific = companySpecificTerms.some(term => lowerQuery.includes(term));
            if (isLikelyCompanySpecific) {
                // Determine topics for fallback message
                const isInvestorQuery = lowerQuery.includes('investor') || lowerQuery.includes('funding');
                const isCustomerQuery = lowerQuery.includes('customer') || lowerQuery.includes('client');
                const isProductQuery = lowerQuery.includes('product') || lowerQuery.includes('feature');
                // Enhanced visual query detection
                const isVisualQuery = visualFocus ||
                    lowerQuery.includes('chart') ||
                    lowerQuery.includes('image') ||
                    lowerQuery.includes('diagram') ||
                    lowerQuery.includes('picture') ||
                    lowerQuery.includes('graph') ||
                    lowerQuery.includes('table') ||
                    lowerQuery.includes('figure') ||
                    lowerQuery.includes('visual') ||
                    lowerQuery.includes('illustration') ||
                    lowerQuery.includes('screenshot');
                let fallbackPrompt = `You are a knowledgeable sales representative for Workstream, an HR, Payroll, and Hiring platform for the hourly workforce.

The user asked: "${query}"

Unfortunately, we don't have specific information in our knowledge base to fully answer this particular question. However, please provide:
1. A helpful response that acknowledges the specific limitation
2. Share general information we do know about the topic (if available)
3. Offer to help with related information we might have
`;
                // Add visual-specific context if needed
                if (isVisualQuery) {
                    fallbackPrompt += `
For visual-related questions:
- We have various charts, diagrams, and images in our documentation
- We can provide visual materials on request for specific topics
- Mention that you don't have the specific visual content they're looking for but could help them find related information

Please acknowledge that you don't have the specific visual content they're asking about.`;
                }
                // Add other context types from the original function...
                if (isInvestorQuery) {
                    fallbackPrompt += `
For investor-related questions:
- We know Workstream is backed by several investors including GGV Capital, Bond, Coatue, Basis Set Ventures, CRV, and Peterson Ventures
- We've had funding rounds including a Series A and Series B
- Our investors page is at https://www.workstream.us/investors
        
Please incorporate this general investor information while clearly stating that you don't have the specific details requested.`;
                }
                if (isCustomerQuery) {
                    fallbackPrompt += `
For customer-related questions:
- Workstream serves hourly workforce businesses across various industries
- We have case studies and customer testimonials on our website
        
Please incorporate this general customer information while clearly stating that you don't have the specific details requested.`;
                }
                if (isProductQuery) {
                    fallbackPrompt += `
For product-related questions:
- Workstream offers HR, Payroll, and Hiring solutions for the hourly workforce
- Our platform includes features for recruitment, onboarding, and workforce management
        
Please incorporate this general product information while clearly stating that you don't have the specific details requested.`;
                }
                // For fallback message with topic context
                let userPrompt = query;
                if (options.conversationHistory) {
                    const formattedHistory = formatConversationHistory(options.conversationHistory);
                    if (formattedHistory) {
                        userPrompt = `Previous conversation:\n${formattedHistory}\n\nCurrent question: ${query}`;
                    }
                }
                return await generateGeminiChatCompletion(fallbackPrompt, userPrompt);
            }
            // For truly general questions, use a more helpful response
            const fallbackSystemPrompt = `You are a helpful AI assistant for the sales team of our company.
You should be friendly, concise, and helpful.
If the question seems to be asking for specific company information, products, pricing, or sales data, explain that you don't have that specific information in your knowledge base yet, but you'd be happy to help with any other information about our products or services.
Always maintain the perspective that you are part of the company's sales team.`;
            // For general fallback system prompt 
            let userPrompt = query;
            if (options.conversationHistory) {
                const formattedHistory = formatConversationHistory(options.conversationHistory);
                if (formattedHistory) {
                    userPrompt = `Previous conversation:\n${formattedHistory}\n\nCurrent question: ${query}`;
                }
            }
            return await generateGeminiChatCompletion(fallbackSystemPrompt, userPrompt);
        }
        // Detect specific visual types requested in the query
        const queryLower = query.toLowerCase();
        const requestedVisualTypes = new Set();
        // Enhanced visual type detection
        const visualTypeMapping = [
            { terms: ['chart', 'graph', 'plot'], type: 'chart' },
            { terms: ['table', 'grid', 'spreadsheet'], type: 'table' },
            { terms: ['diagram', 'flowchart', 'architecture'], type: 'diagram' },
            { terms: ['screenshot', 'screen capture', 'screen shot'], type: 'screenshot' },
            { terms: ['photo', 'picture', 'image', 'photo', 'photograph'], type: 'image' },
            { terms: ['figure', 'illustration', 'visual'], type: 'figure' },
            { terms: ['infographic', 'data visualization'], type: 'infographic' },
        ];
        // Check query for visual type references
        visualTypeMapping.forEach(mapping => {
            if (mapping.terms.some(term => queryLower.includes(term))) {
                requestedVisualTypes.add(mapping.type);
            }
        });
        // Add any visual types from options
        if (visualTypes && visualTypes.length > 0) {
            visualTypes.forEach(type => requestedVisualTypes.add(type.toLowerCase()));
        }
        // Format the context with enhanced handling for visual content
        const formattedContextItems = searchResults
            .slice(0, maxSourcesInAnswer)
            .map((item, index) => {
            // Build the source information
            let sourceInfo = '';
            if (item.source) {
                sourceInfo = `Source: ${item.source}`;
                if (item.metadata?.page) {
                    sourceInfo += `, Page: ${item.metadata.page}`;
                }
            }
            // Enhanced visual content formatting with consistent structure
            let visualContent = [];
            let imageUrls = [];
            // Process visualContent array if present
            if (item.visualContent && item.visualContent.length > 0) {
                item.visualContent.forEach(visual => {
                    // Format visual type for better readability
                    const formattedType = formatVisualType(visual.type);
                    // Generate a unique reference ID for this visual
                    const visualRefId = `visual-${index}-${visualContent.length + 1}`;
                    // Check if this visual matches any specifically requested types
                    const isRequestedType = requestedVisualTypes.size === 0 ||
                        requestedVisualTypes.has(visual.type.toLowerCase());
                    // Build the formatted visual information
                    let visualInfo = `[${formattedType}]: ${visual.description}`;
                    // Add extracted text if available, with cleaner formatting
                    if (visual.extractedText && visual.extractedText.trim()) {
                        // Truncate and clean extracted text if too long
                        const cleanedText = formatExtractedText(visual.extractedText, 150);
                        visualInfo += `\nText content: ${cleanedText}`;
                    }
                    // Handle structured data with better formatting
                    if (visual.structuredData) {
                        const structuredDataSummary = formatStructuredData(visual.structuredData);
                        if (structuredDataSummary) {
                            visualInfo += `\nData content: ${structuredDataSummary}`;
                        }
                    }
                    // Add image URL if available and enabled
                    if (includeImageUrls && visual.imageUrl) {
                        // Add to separate array for final prompt construction
                        imageUrls.push(`${visualRefId}: ${visual.imageUrl}`);
                        // Reference the image in the visual description
                        visualInfo += `\nImage reference: ${visualRefId}`;
                    }
                    // Add relevance indicator for requested visual types
                    if (requestedVisualTypes.size > 0) {
                        visualInfo += isRequestedType ?
                            '\n[RELEVANT TO QUERY]' :
                            '\n[SUPPLEMENTARY VISUAL]';
                    }
                    visualContent.push(visualInfo);
                });
            }
            // Handle matchedVisual format (direct match in result)
            if (item.matchedVisual && (!item.visualContent || item.visualContent.length === 0)) {
                const visual = item.matchedVisual;
                const formattedType = formatVisualType(visual.type);
                const visualRefId = `visual-${index}-direct`;
                // Build the formatted visual information
                let visualInfo = `[${formattedType}]: ${visual.description}`;
                // Add extracted text if available
                if (visual.extractedText && visual.extractedText.trim()) {
                    const cleanedText = formatExtractedText(visual.extractedText, 150);
                    visualInfo += `\nText content: ${cleanedText}`;
                }
                // Handle structured data with better formatting
                if (visual.structuredData) {
                    const structuredDataSummary = formatStructuredData(visual.structuredData);
                    if (structuredDataSummary) {
                        visualInfo += `\nData content: ${structuredDataSummary}`;
                    }
                }
                // Add image URL if available and enabled
                if (includeImageUrls && visual.imageUrl) {
                    imageUrls.push(`${visualRefId}: ${visual.imageUrl}`);
                    visualInfo += `\nImage reference: ${visualRefId}`;
                }
                // Add match type indicator
                visualInfo += '\n[DIRECTLY MATCHED VISUAL]';
                visualContent.push(visualInfo);
            }
            // Include formatted visual content if available
            let visualInfoBlock = '';
            if (visualContent.length > 0) {
                visualInfoBlock = `\n\nVISUAL CONTENT (${visualContent.length}):\n${visualContent.join('\n\n')}`;
            }
            // Include match type information if available
            let matchTypeInfo = '';
            if (item.matchType) {
                matchTypeInfo = `\nMatch type: ${item.matchType.toUpperCase()}`;
            }
            // Combine all context information
            return {
                text: `[${index + 1}] ${item.text.trim()}${visualInfoBlock}${matchTypeInfo}\n${sourceInfo}`,
                imageUrls: imageUrls
            };
        });
        // Extract the text and image URLs
        const contextTextArray = formattedContextItems.map(item => item.text);
        const allImageUrls = formattedContextItems.flatMap(item => item.imageUrls);
        // Combine the context text
        const contextText = contextTextArray.join('\n\n');
        // Add image URLs to the end if available
        const imageUrlsText = allImageUrls.length > 0 ?
            `\n\nIMAGE REFERENCES:\n${allImageUrls.join('\n')}` : '';
        // Complete context text with image URLs
        const fullContextText = contextText + imageUrlsText;
        // Estimate token count for context and history
        // Handle conversation history that might be a string or array of message objects
        let historyText = '';
        if (options.conversationHistory) {
            historyText = formatConversationHistory(options.conversationHistory);
        }
        const promptOverhead = estimateTokenCount(`Question: ${query}\n\nContext:\n\n\nAnswer:`);
        const historyTokens = estimateTokenCount(historyText);
        const contextTokens = estimateTokenCount(fullContextText);
        const totalEstimatedTokens = promptOverhead + historyTokens + contextTokens;
        console.log(`[Multi-Modal] Estimated tokens: ${totalEstimatedTokens} (Context: ${contextTokens}, History: ${historyTokens}, Overhead: ${promptOverhead})`);
        console.log(`[Multi-Modal] Visual content: ${allImageUrls.length} images referenced`);
        // We'll use Gemini for:
        // 1. Multi-modal content (has visual focus)
        // 2. Large context
        // 3. When specific visual types are requested
        const useGemini = totalEstimatedTokens > MAX_TOKENS_OPENAI ||
            visualFocus ||
            requestedVisualTypes.size > 0;
        // If total is too large, summarize the context
        let finalContextText = fullContextText;
        if (totalEstimatedTokens > MAX_CONTEXT_LENGTH) {
            console.log(`[Multi-Modal] Context too large (${totalEstimatedTokens} tokens), applying summarization`);
            // Preserve image URLs when summarizing
            const contextWithoutUrls = contextText;
            const summarizedContext = await summarizeContext(query, contextWithoutUrls);
            finalContextText = summarizedContext + imageUrlsText;
        }
        if (useGemini) {
            console.log(`[Multi-Modal] Using Gemini for answer generation with visual context (${totalEstimatedTokens} tokens)`);
            // Create an enhanced system prompt for visual content with improved instructions
            const systemPrompt = `You are a knowledgeable AI assistant for our company's sales team.
You have access to our company's knowledge base, which includes both text and visual content descriptions.

IMPORTANT: You represent our company. When answering questions about "our company," "our products," "our services," or referring to "we" or "us," you should speak from the perspective of a company representative.

Answer the user's question using the provided context, which contains:
1. Text snippets from our knowledge base
2. Descriptions of visual content (images, charts, diagrams, tables) 
3. Image references that may be displayed to the user

VISUAL CONTENT GUIDELINES:
${visualFocus || requestedVisualTypes.size > 0 ? '- This query is specifically about visual content, so prioritize information from the visual descriptions' : '- Include visual information where relevant to the query'}
- When referencing visuals, use their type and a brief description: "our chart showing monthly sales trends" or "our diagram of the software architecture"
- If image references are provided, mention them when discussing related visuals: "You can refer to the chart (image-reference-id) showing..."
- For charts and graphs: describe the trends, key data points, and conclusions that can be drawn
- For diagrams: explain the components, relationships, and overall structure
- For tables: summarize the most important data points and patterns
- For screenshots: describe what the interface shows and its key elements

NEVER use phrases like "as shown in the image" or "as you can see" since the user cannot directly see the visual content.
${includeSourceCitations ? 'If appropriate, include source citations using [1], [2], etc. format to reference the provided context.' : 'Do not include explicit source citations in your answer.'}

If the context doesn't contain enough information to fully answer the question, acknowledge this limitation while being helpful with the information you do have.`;
            // For knowledge-based questions
            let userPrompt;
            if (options.conversationHistory) {
                const formattedHistory = formatConversationHistory(options.conversationHistory);
                if (formattedHistory) {
                    userPrompt = `Previous conversation:\n${formattedHistory}\n\nCurrent question: ${query}\n\nContext:\n${finalContextText}\n\nAnswer:`;
                }
                else {
                    userPrompt = `Question: ${query}\n\nContext:\n${finalContextText}\n\nAnswer:`;
                }
            }
            else {
                userPrompt = `Question: ${query}\n\nContext:\n${finalContextText}\n\nAnswer:`;
            }
            try {
                return await generateGeminiChatCompletion(systemPrompt, userPrompt);
            }
            catch (error) {
                logError('[Multi-Modal] Error generating answer with Gemini', error);
                return 'I apologize, but I encountered an issue processing your visual content query. Please try again with a more specific question.';
            }
        }
        // Use OpenAI for non-visual or smaller contexts
        console.log(`[Multi-Modal] Using OpenAI (${model}) for answer generation with ${totalEstimatedTokens} estimated tokens`);
        // Create enhanced system prompt for knowledge-based questions with visual awareness
        const systemPrompt = `You are a knowledgeable AI assistant for our company's sales team.
You have access to our company's knowledge base, which includes both text and visual content descriptions.

IMPORTANT: You represent our company. When answering questions about "our company," "our products," "our services," or referring to "we" or "us," you should speak from the perspective of a company representative.

Answer the user's question using the provided context, which contains:
1. Text snippets from our knowledge base
2. Descriptions of visual content (images, charts, diagrams, tables) 
3. Image references that may be displayed to the user

VISUAL CONTENT GUIDELINES:
- When referencing visuals, use their type and a brief description: "our chart showing monthly sales trends" or "our diagram of the software architecture"
- If image references are provided, mention them when discussing related visuals: "You can refer to the chart (image-reference-id) showing..."
- For charts and graphs: describe the trends, key data points, and conclusions that can be drawn
- For diagrams: explain the components, relationships, and overall structure
- For tables: summarize the most important data points and patterns
- For screenshots: describe what the interface shows and its key elements

NEVER use phrases like "as shown in the image" or "as you can see" since the user cannot directly see the visual content.
${includeSourceCitations ? 'If appropriate, include source citations using [1], [2], etc. format to reference the provided context.' : 'Do not include explicit source citations in your answer.'}

If the context doesn't contain enough information to fully answer the question, acknowledge this limitation while being helpful with the information you do have.`;
        // For knowledge-based questions
        let userPrompt;
        if (options.conversationHistory) {
            const formattedHistory = formatConversationHistory(options.conversationHistory);
            if (formattedHistory) {
                userPrompt = `Previous conversation:\n${formattedHistory}\n\nCurrent question: ${query}\n\nContext:\n${finalContextText}\n\nAnswer:`;
            }
            else {
                userPrompt = `Question: ${query}\n\nContext:\n${finalContextText}\n\nAnswer:`;
            }
        }
        else {
            userPrompt = `Question: ${query}\n\nContext:\n${finalContextText}\n\nAnswer:`;
        }
        // Set a timeout
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                resolve("I apologize, but it's taking me longer than expected to process your request with the visual content. Please try again or rephrase your question.");
            }, options.timeout || 15000);
        });
        try {
            // Generate the answer using the LLM
            const answerPromise = generateGeminiChatCompletion(systemPrompt, userPrompt);
            return await Promise.race([answerPromise, timeoutPromise]);
        }
        catch (error) {
            // Check if error is token limit related
            const errorStr = String(error);
            if (errorStr.includes('context_length_exceeded') ||
                errorStr.includes('maximum context length') ||
                errorStr.includes('Request too large') ||
                errorStr.includes('rate_limit_exceeded')) {
                console.log('[Multi-Modal] Attempting with fallback model Gemini due to token limits...');
                // Import the Gemini client
                const { generateGeminiChatCompletion } = await import('./geminiClient');
                return await generateGeminiChatCompletion(systemPrompt, userPrompt);
            }
            // Re-throw other errors
            throw error;
        }
    }
    catch (error) {
        logError('[Multi-Modal] Error generating answer with visual context', error);
        return 'Sorry, I encountered an error while processing your request about visual content. Please try again.';
    }
}
/**
 * Format visual type for better readability
 */
function formatVisualType(type) {
    if (!type)
        return 'VISUAL';
    // Handle common type variations
    const lowerType = type.toLowerCase();
    // Map type to standardized format
    const typeMap = {
        'chart': 'CHART',
        'graph': 'CHART',
        'table': 'TABLE',
        'diagram': 'DIAGRAM',
        'screenshot': 'SCREENSHOT',
        'image': 'IMAGE',
        'photo': 'IMAGE',
        'figure': 'FIGURE',
        'infographic': 'INFOGRAPHIC',
        'unknown': 'VISUAL'
    };
    // Return standardized type or capitalized original
    return typeMap[lowerType] || type.toUpperCase();
}
/**
 * Format extracted text for better presentation
 */
function formatExtractedText(text, maxLength = 150) {
    if (!text)
        return '';
    // Clean up the text
    let cleanedText = text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, ' ')
        .trim();
    // Truncate if needed
    if (cleanedText.length > maxLength) {
        cleanedText = cleanedText.substring(0, maxLength) + '...';
    }
    return cleanedText;
}
/**
 * Format structured data for better presentation
 */
function formatStructuredData(data) {
    if (!data)
        return '';
    try {
        if (typeof data === 'object') {
            // Handle arrays differently than objects
            if (Array.isArray(data)) {
                // If it's a simple array, join with commas
                if (data.length <= 5 && data.every(item => typeof item !== 'object')) {
                    return `[${data.join(', ')}]`;
                }
                // For longer or complex arrays, summarize
                return `Array with ${data.length} items`;
            }
            // For objects, summarize key fields
            const keys = Object.keys(data);
            if (keys.length <= 3) {
                // For simple objects, show all properties
                return JSON.stringify(data).substring(0, 100) + (JSON.stringify(data).length > 100 ? '...' : '');
            }
            // For complex objects, just list the keys
            return `Object with properties: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`;
        }
        // For strings or numbers, return as is
        return String(data).substring(0, 100) + (String(data).length > 100 ? '...' : '');
    }
    catch (e) {
        // Fall back to simple string representation if an error occurs
        return 'Complex data structure';
    }
}
// Helper function to convert conversation history to string format
function formatConversationHistory(history) {
    if (!history)
        return '';
    if (typeof history === 'string') {
        return history.trim();
    }
    else if (Array.isArray(history)) {
        return history
            .map(msg => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            return `${role}: ${msg.content}`;
        })
            .join('\n');
    }
    return '';
}

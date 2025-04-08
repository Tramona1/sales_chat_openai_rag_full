"use strict";
/**
 * Answer generation utility for the RAG system
 * Generates accurate answers from search results using the OpenAI API
 * With fallback to Gemini for handling large contexts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAnswer = generateAnswer;
const errorHandling_1 = require("./errorHandling");
const openaiClient_1 = require("./openaiClient");
const geminiClient_1 = require("./geminiClient");
const modelConfig_1 = require("./modelConfig");
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
 * Handle conversational input with a general LLM response
 */
async function handleConversationalQuery(query, conversationHistory) {
    const systemPrompt = `You are a helpful, friendly, and professional AI assistant for a sales team of Workstream, a company that provides HR, Payroll, and Hiring solutions for the hourly workforce.
You represent the company and should be helpful, friendly and concise.
You are part of the sales department and your job is to help the sales team with information.
When asked about specific details about the company, products, customers, etc., make sure when summarizing that you include only the most relevant information.`;
    // If we have conversation history, include it in the prompt
    let userPrompt = query;
    if (conversationHistory && conversationHistory.trim()) {
        userPrompt = `Previous conversation:\n${conversationHistory.trim()}\n\nCurrent message: ${query}`;
    }
    try {
        return await (0, openaiClient_1.generateChatCompletion)(systemPrompt, userPrompt, 'gpt-3.5-turbo');
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error generating conversational response', error);
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
        const summary = await (0, geminiClient_1.generateGeminiChatCompletion)(systemPrompt, userPrompt);
        console.log(`Successfully summarized context with Gemini. Reduced from ${estimateTokenCount(context)} to approximately ${estimateTokenCount(summary)} tokens`);
        return summary;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error summarizing context with Gemini', error);
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
 * Generate answer with Gemini
 * Used when context is too large for OpenAI or as a fallback
 */
async function generateGeminiAnswer(query, contextText, options) {
    const systemPrompt = `You are a knowledgeable AI assistant for Workstream, an HR, Payroll, and Hiring platform for the hourly workforce.
You have access to our company's knowledge base and should use that information to answer questions.

IMPORTANT: You represent our company. When answering questions about "our company," "our products," "our services," or referring to "we" or "us," you should speak from the perspective of a company representative.

Answer the user's question using ONLY the provided context. The context contains information from our company's knowledge base.

GUIDELINES FOR SPECIFIC TOPICS:
1. For investor-related questions:
   - Cite ONLY investors mentioned in the context
   - Include funding details EXACTLY as they appear in the context
   - Do not make up or infer investor information not explicitly stated
   - If asked about "our investors," only mention those in the context

2. For company information:
   - Stick to facts from the context
   - Maintain the company voice using "we" and "our"
   - If information is not in the context, acknowledge this limitation

If the context doesn't contain enough information to fully answer the question, acknowledge that you don't have complete information on that specific topic in your knowledge base, but try to be helpful with what you do know.

Be conversational and professional in your response, as if you're having a discussion with a colleague.
${options.includeSourceCitations ? 'If appropriate, you may include source citations using [1], [2], etc. format to reference the provided context.' : 'Do not include explicit source citations in your answer.'}`;
    // Include conversation history if available
    let userPrompt;
    if (options.conversationHistory && options.conversationHistory.trim()) {
        userPrompt = `Previous conversation:\n${options.conversationHistory.trim()}\n\nCurrent question: ${query}\n\nContext:\n${contextText}\n\nAnswer:`;
    }
    else {
        userPrompt = `Question: ${query}\n\nContext:\n${contextText}\n\nAnswer:`;
    }
    try {
        return await (0, geminiClient_1.generateGeminiChatCompletion)(systemPrompt, userPrompt);
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error generating answer with Gemini', error);
        return "I apologize, but I'm having trouble processing this request at the moment. Please try asking again, perhaps with a more specific question about our products or services.";
    }
}
/**
 * Generate an answer based on retrieved context and the user's query
 *
 * @param query The user's original query
 * @param searchResults The search results from the retrieval system
 * @param options Optional settings for answer generation
 * @returns A string with the generated answer
 */
async function generateAnswer(query, searchResults, options = {}) {
    var _a, _b;
    try {
        // Only handle basic greetings conversationally
        // Most questions should try to search the knowledge base
        if (isBasicConversational(query)) {
            return await handleConversationalQuery(query, options.conversationHistory);
        }
        // Use options or defaults
        const model = options.model || modelConfig_1.AI_SETTINGS.defaultModel;
        const includeSourceCitations = (_a = options.includeSourceCitations) !== null && _a !== void 0 ? _a : true;
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
                // Include conversation history if available
                let userPrompt = query;
                if (options.conversationHistory && options.conversationHistory.trim()) {
                    userPrompt = `Previous conversation:\n${options.conversationHistory.trim()}\n\nCurrent question: ${query}`;
                }
                return await (0, openaiClient_1.generateChatCompletion)(fallbackPrompt, userPrompt, model);
            }
            // For truly general questions, use a more helpful response
            const fallbackSystemPrompt = `You are a helpful AI assistant for the sales team of our company.
You should be friendly, concise, and helpful.
If the question seems to be asking for specific company information, products, pricing, or sales data, explain that you don't have that specific information in your knowledge base yet, but you'd be happy to help with any other information about our products or services.
Always maintain the perspective that you are part of the company's sales team.`;
            // Include conversation history if available
            let userPrompt = query;
            if (options.conversationHistory && options.conversationHistory.trim()) {
                userPrompt = `Previous conversation:\n${options.conversationHistory.trim()}\n\nCurrent question: ${query}`;
            }
            return await (0, openaiClient_1.generateChatCompletion)(fallbackSystemPrompt, userPrompt, model);
        }
        // Format the context for the LLM when we have relevant documents
        let contextText = searchResults
            .slice(0, maxSourcesInAnswer)
            .map((item, index) => {
            let source = '';
            if (item.source) {
                source = `Source: ${item.source}`;
            }
            return `[${index + 1}] ${item.text.trim()}\n${source}`;
        })
            .join('\n\n');
        // Estimate token count of context and conversation history
        const historyText = ((_b = options.conversationHistory) === null || _b === void 0 ? void 0 : _b.trim()) || '';
        const promptOverhead = estimateTokenCount(`Question: ${query}\n\nContext:\n\n\nAnswer:`);
        const historyTokens = estimateTokenCount(historyText);
        const contextTokens = estimateTokenCount(contextText);
        const totalEstimatedTokens = promptOverhead + historyTokens + contextTokens;
        console.log(`Estimated tokens: ${totalEstimatedTokens} (Context: ${contextTokens}, History: ${historyTokens}, Overhead: ${promptOverhead})`);
        // Determine if we should use Gemini directly due to large context
        const useGeminiDirectly = totalEstimatedTokens > MAX_TOKENS_OPENAI;
        // If total is too large, we need to summarize the context
        if (totalEstimatedTokens > MAX_CONTEXT_LENGTH) {
            console.log(`Context too large (${totalEstimatedTokens} tokens), applying summarization`);
            contextText = await summarizeContext(query, contextText);
        }
        if (useGeminiDirectly) {
            console.log(`Using Gemini for answer generation due to large context (${totalEstimatedTokens} tokens)`);
            return await generateGeminiAnswer(query, contextText, {
                includeSourceCitations,
                conversationHistory: options.conversationHistory
            });
        }
        // Proceed with OpenAI if context is manageable
        console.log(`Using OpenAI (${model}) for answer generation with ${totalEstimatedTokens} estimated tokens`);
        // Create system prompt for knowledge-based questions
        const systemPrompt = `You are a knowledgeable AI assistant for our company's sales team.
You have access to our company's knowledge base and should use that information to answer questions.

IMPORTANT: You represent our company. When answering questions about "our company," "our products," "our services," or referring to "we" or "us," you should speak from the perspective of a company representative.

Answer the user's question using the provided context. The context contains information from our company's knowledge base.

If the context doesn't contain enough information to fully answer the question, acknowledge that you don't have complete information on that specific topic in your knowledge base, but try to be helpful with what you do know.

Be conversational and professional in your response, as if you're having a discussion with a colleague.
${includeSourceCitations ? 'If appropriate, you may include source citations using [1], [2], etc. format to reference the provided context.' : 'Do not include explicit source citations in your answer.'}`;
        // Include conversation history if available
        let userPrompt;
        if (options.conversationHistory && options.conversationHistory.trim()) {
            userPrompt = `Previous conversation:\n${options.conversationHistory.trim()}\n\nCurrent question: ${query}\n\nContext:\n${contextText}\n\nAnswer:`;
        }
        else {
            userPrompt = `Question: ${query}\n\nContext:\n${contextText}\n\nAnswer:`;
        }
        // Set a timeout
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                resolve("I apologize, but it's taking me longer than expected to process your request. Please try again or rephrase your question.");
            }, options.timeout || 15000);
        });
        try {
            // Generate the answer using the LLM
            const answerPromise = (0, openaiClient_1.generateChatCompletion)(systemPrompt, userPrompt, model);
            return await Promise.race([answerPromise, timeoutPromise]);
        }
        catch (error) {
            // Check if error is token limit related
            const errorStr = String(error);
            if (errorStr.includes('context_length_exceeded') ||
                errorStr.includes('maximum context length') ||
                errorStr.includes('Request too large') ||
                errorStr.includes('rate_limit_exceeded')) {
                console.log('Attempting with fallback model Gemini due to token limits...');
                return await generateGeminiAnswer(query, contextText, {
                    includeSourceCitations,
                    conversationHistory: options.conversationHistory
                });
            }
            // Re-throw other errors
            throw error;
        }
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error generating answer', error);
        return 'Sorry, I encountered an error while processing your request. Please try again.';
    }
}

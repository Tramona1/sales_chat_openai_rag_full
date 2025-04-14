/**
 * Answer Generation Module
 *
 * This module provides functions for generating answers based on search results.
 */
import { generateAnswer as generateAnswerFromGenerator } from './answerGenerator';
import { logError, logInfo } from './logger';
/**
 * Generate an answer from retrieved search results
 *
 * @param query The user's original query
 * @param searchResults The search results to generate an answer from
 * @param options Additional options for answer generation
 * @returns The generated answer
 */
export async function generateAnswer(query, searchResults, options = {}) {
    try {
        // Call the actual implementation from answerGenerator
        return await generateAnswerFromGenerator(query, searchResults, {
            includeSourceCitations: options.includeSourceCitations,
            maxSourcesInAnswer: options.maxSourcesInAnswer,
            model: options.model,
            timeout: options.timeout,
            conversationHistory: options.conversationHistory
        });
    }
    catch (error) {
        logError('Error generating answer', error);
        return "I'm sorry, I encountered an error while trying to generate an answer. Please try again with a different query.";
    }
}
/**
 * Summarize large context to fit within token limits
 *
 * @param query User query
 * @param context Original context text that may be too large
 * @returns Summarized context that fits within token limits
 */
async function summarizeContext(query, context) {
    try {
        // First, estimate token count in the context
        const estimatedTokens = estimateTokenCount(context);
        const MAX_INPUT_TOKENS = 30000; // Maximum tokens for context summarization
        // If context is already small enough, return as is
        if (estimatedTokens <= MAX_INPUT_TOKENS) {
            return context;
        }
        logInfo(`Context size (${estimatedTokens} tokens) exceeds summarization input limit, chunking before summarization`);
        // Split context into individual items
        const contextItems = context.split('\n\n').filter(Boolean);
        // If we only have a few items, summarize them individually
        if (contextItems.length <= 5) {
            const summarizedItems = await Promise.all(contextItems.map(async (item) => {
                // Only summarize large items
                if (estimateTokenCount(item) > 3000) {
                    return summarizeItemWithGemini(item, query);
                }
                return item;
            }));
            return summarizedItems.join('\n\n');
        }
        // For many items, use a hierarchical approach
        // First, group items into batches
        const batchSize = Math.ceil(contextItems.length / Math.ceil(estimatedTokens / MAX_INPUT_TOKENS));
        const batches = [];
        for (let i = 0; i < contextItems.length; i += batchSize) {
            batches.push(contextItems.slice(i, i + batchSize).join('\n\n'));
        }
        // Summarize each batch
        const summarizedBatches = await Promise.all(batches.map(async (batch) => {
            return summarizeBatchWithGemini(batch, query);
        }));
        // Combine batch summaries
        const batchSummaries = summarizedBatches.join('\n\n');
        // If the combined summaries are still too large, do a final summarization
        if (estimateTokenCount(batchSummaries) > MAX_INPUT_TOKENS) {
            return await summarizeFinalWithGemini(batchSummaries, query);
        }
        return batchSummaries;
    }
    catch (error) {
        // Fallback to simple truncation if summarization fails
        logError('Error in summarizeContext:', error);
        logInfo('Falling back to simple truncation for context');
        // Take first part of each context item to fit within limits
        const contextItems = context.split('\n\n');
        let truncatedContext = '';
        const maxCharsPerItem = Math.floor(10000 / contextItems.length);
        for (const item of contextItems) {
            truncatedContext += item.substring(0, maxCharsPerItem) + '\n\n';
        }
        return truncatedContext;
    }
}
/**
 * Summarize a single context item (document)
 */
async function summarizeItemWithGemini(item, query) {
    try {
        const systemPrompt = 'You are an expert document summarizer. Create a concise summary that preserves the essential information from the text provided, focusing on factual content, data points, and specific details that might be relevant to answering questions.';
        const userPrompt = `Summarize the following text to capture all key information that might help answer queries, especially about: ${query}

TEXT:
${item}

YOUR TASK:
- Focus on preserving specific facts, numbers, names, and technical details
- Maintain all key information and examples
- Keep your summary informative and comprehensive, but more concise than the original`;
        // Import the Gemini client
        const { generateGeminiChatCompletion } = await import('./geminiClient');
        const summary = await generateGeminiChatCompletion(systemPrompt, userPrompt);
        return summary;
    }
    catch (error) {
        logError('Error in summarizeItemWithGemini:', error);
        // Return a truncated version of the original if summarization fails
        return item.substring(0, 2000) + '...';
    }
}
/**
 * Summarize a batch of context items
 */
async function summarizeBatchWithGemini(batch, query) {
    try {
        const systemPrompt = 'You are an expert document summarizer for a RAG system. Your task is to create a concise summary of multiple information sources, preserving all key information that could be used to answer specific questions accurately.';
        const userPrompt = `Summarize the following collection of documents to help answer questions about: ${query}

DOCUMENTS:
${batch}

Create a comprehensive summary that:
1. Preserves all key facts, data points, and details
2. Maintains the original meaning and intent
3. Includes all information that might be relevant to the user's query
4. Organizes information logically`;
        // Import the Gemini client
        const { generateGeminiChatCompletion } = await import('./geminiClient');
        const summary = await generateGeminiChatCompletion(systemPrompt, userPrompt);
        return summary;
    }
    catch (error) {
        logError('Error in summarizeBatchWithGemini:', error);
        // Return a truncated version of the original if summarization fails
        return batch.substring(0, 4000) + '...';
    }
}
/**
 * Create a final summary for very large contexts
 */
async function summarizeFinalWithGemini(batchSummaries, query) {
    try {
        const systemPrompt = 'You are an expert information synthesizer for a RAG system. Your task is to create a final, comprehensive summary of multiple document summaries, preserving all key information needed to answer questions accurately.';
        const userPrompt = `Create a final synthesis of these document summaries to help answer questions related to: ${query}

SUMMARIES:
${batchSummaries}

Your synthesis should:
1. Combine all key information from the summaries
2. Eliminate redundancy while preserving unique details
3. Organize information in a coherent structure
4. Ensure all details relevant to the query are included`;
        // Import the Gemini client
        const { generateGeminiChatCompletion } = await import('./geminiClient');
        const summary = await generateGeminiChatCompletion(systemPrompt, userPrompt);
        return summary;
    }
    catch (error) {
        logError('Error in summarizeFinalWithGemini:', error);
        // Return a truncated version of the original if summarization fails
        const items = batchSummaries.split('\n\n');
        let truncated = '';
        const maxCharsPerItem = Math.floor(8000 / items.length);
        for (const item of items) {
            truncated += item.substring(0, maxCharsPerItem) + '\n\n';
        }
        return truncated;
    }
}
/**
 * Estimate token count for a text
 *
 * @param text Text to estimate token count for
 * @returns Estimated token count
 */
function estimateTokenCount(text) {
    if (!text)
        return 0;
    // Rough estimation: 1 token ≈ 4 characters for English text
    // This is a conservative estimate; actual tokens may be fewer
    return Math.ceil(text.length / 4);
}

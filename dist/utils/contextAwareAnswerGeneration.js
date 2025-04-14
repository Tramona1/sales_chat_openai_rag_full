/**
 * Context-Aware Answer Generation Utilities
 *
 * This module provides functions for generating answers that take advantage
 * of contextual and multi-modal information for more accurate responses.
 */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { getModelForTask } from './modelConfig';
import { isFeatureEnabled } from './featureFlags';
import { recordMetric } from './performanceMonitoring';
/**
 * Default answer generation options
 */
const DEFAULT_OPTIONS = {
    includeSourceCitations: true,
    maxSourcesInAnswer: 3,
    conversationHistory: '',
    useContextualInformation: true,
    useMultiModalContent: true,
    responseFormat: 'markdown'
};
/**
 * Get the API model for answer generation
 */
function getAnswerGenerationModel() {
    // Get the appropriate model for answer generation
    const modelConfig = getModelForTask(undefined, 'chat');
    if (modelConfig.provider === 'gemini') {
        // Initialize Gemini model
        const apiKey = process.env.GEMINI_API_KEY || '';
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set in environment variables');
        }
        const genAI = new GoogleGenerativeAI(apiKey);
        return genAI.getGenerativeModel({
            model: modelConfig.model,
            generationConfig: {
                temperature: modelConfig.settings.temperature || 0.2,
                maxOutputTokens: modelConfig.settings.maxTokens || 2048,
                topP: modelConfig.settings.topP || 0.95,
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
    else {
        // Use OpenAI as fallback
        throw new Error('OpenAI integration should be handled separately');
    }
}
/**
 * Generate a context-aware answer using Gemini
 *
 * @param query The user's query
 * @param searchResults The retrieved search results
 * @param options Options for answer generation
 * @returns The generated answer
 */
export async function generateContextAwareAnswer(query, searchResults, options = {}) {
    const startTime = Date.now();
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    try {
        // Check if we have enough context
        if (!searchResults || searchResults.length === 0) {
            return "I don't have enough information to answer this question.";
        }
        // Sort search results by score
        const sortedResults = [...searchResults].sort((a, b) => b.score - a.score);
        // Prepare context from search results
        let context = prepareSearchContext(sortedResults, mergedOptions);
        // Get the generation model
        const model = getAnswerGenerationModel();
        // Create system prompt
        const systemPrompt = mergedOptions.systemPrompt || createDefaultSystemPrompt(mergedOptions);
        // Create the complete prompt
        const prompt = `
${systemPrompt}

QUERY: ${query}

CONTEXT:
${context}

${mergedOptions.conversationHistory ? `PREVIOUS CONVERSATION:\n${mergedOptions.conversationHistory}\n\n` : ''}

Please provide a comprehensive answer to the query based only on the information in the context. 
${mergedOptions.includeSourceCitations ? 'Include source citations where appropriate using [Source: X] notation.' : ''}
If the context doesn't contain the information needed, acknowledge that you don't have enough information.
`;
        // Generate the answer using Gemini
        const result = await model.generateContent(prompt);
        const answer = result.response.text();
        // Record metrics
        recordMetric('answerGeneration', 'contextAwareGemini', Date.now() - startTime, true, {
            contextSize: searchResults.length,
            hasMultiModal: searchResults.some(result => result.visualContent && result.visualContent.length > 0),
            useContextual: mergedOptions.useContextualInformation,
            useMultiModal: mergedOptions.useMultiModalContent,
            outputLength: answer.length
        });
        return answer;
    }
    catch (error) {
        console.error('Error generating context-aware answer:', error);
        // Record the error
        recordMetric('answerGeneration', 'contextAwareGemini', Date.now() - startTime, false, {
            error: error.message
        });
        // Fallback response
        return "I'm sorry, I encountered an error while generating your answer. Please try again.";
    }
}
/**
 * Generate an answer that specifically incorporates visual information
 *
 * @param query The user's query
 * @param searchResults The retrieved search results
 * @param options Options for answer generation
 * @returns The generated answer
 */
export async function generateAnswerWithVisualContext(query, searchResults, options = {}) {
    const startTime = Date.now();
    const mergedOptions = {
        ...DEFAULT_OPTIONS,
        ...options,
        useMultiModalContent: true // Force multi-modal context
    };
    try {
        // Check if we have enough context
        if (!searchResults || searchResults.length === 0) {
            return "I don't have enough information to answer this question.";
        }
        // Filter results to prioritize those with visual content
        const resultsWithVisuals = searchResults.filter(result => result.visualContent && result.visualContent.length > 0);
        // If no results with visuals, fall back to regular context-aware answer
        if (resultsWithVisuals.length === 0) {
            return generateContextAwareAnswer(query, searchResults, options);
        }
        // Prioritize results with visuals, but include some without if needed
        const visualResults = resultsWithVisuals.sort((a, b) => b.score - a.score);
        const textOnlyResults = searchResults
            .filter(result => !result.visualContent || result.visualContent.length === 0)
            .sort((a, b) => b.score - a.score);
        // Combine results, prioritizing visual content
        let combinedResults = [];
        const maxResults = Math.min(10, visualResults.length + textOnlyResults.length);
        // Aim for at least 2/3 visual results if available
        const visualQuota = Math.min(Math.ceil(maxResults * 0.67), visualResults.length);
        const textQuota = Math.min(maxResults - visualQuota, textOnlyResults.length);
        combinedResults = [
            ...visualResults.slice(0, visualQuota),
            ...textOnlyResults.slice(0, textQuota)
        ].sort((a, b) => b.score - a.score);
        // Create enhanced system prompt for visual context
        const visualSystemPrompt = `You are an AI assistant that understands both text and visual information.
You will be given a query and context that includes descriptions of visual content (images, charts, diagrams, etc.).

When answering the query:
1. Incorporate relevant information from both text and visual content
2. If visuals contain important data, explain what they show and how it relates to the query
3. Describe relevant charts, diagrams, or images in your answer when they help explain concepts
4. For charts and data visualizations, explain key metrics, trends, or comparisons they illustrate
5. Mention when your answer is based on visual content vs. textual content

Aim for a comprehensive response that seamlessly integrates insights from both text and visual sources.`;
        // Override system prompt if not explicitly provided
        const finalOptions = {
            ...mergedOptions,
            systemPrompt: options.systemPrompt || visualSystemPrompt
        };
        // Generate answer using the enhanced context
        return generateContextAwareAnswer(query, combinedResults, finalOptions);
    }
    catch (error) {
        console.error('Error generating answer with visual context:', error);
        // Record the error
        recordMetric('answerGeneration', 'visualContextGemini', Date.now() - startTime, false, {
            error: error.message
        });
        // Fallback to regular context-aware answer
        try {
            return generateContextAwareAnswer(query, searchResults, options);
        }
        catch (fallbackError) {
            return "I'm sorry, I encountered an error while generating your answer. Please try again.";
        }
    }
}
/**
 * Prepare search context for answer generation
 *
 * @param searchResults Sorted search results
 * @param options Answer generation options
 * @returns Formatted context string
 */
function prepareSearchContext(searchResults, options) {
    // Limit the number of results to include
    const limitedResults = searchResults.slice(0, options.maxSourcesInAnswer || 5);
    // Format each result
    const formattedResults = limitedResults.map((result, index) => {
        let content = `SOURCE ${index + 1}: ${result.source}\n`;
        content += `TEXT: ${result.text}\n`;
        // Include contextual information if available and enabled
        if (options.useContextualInformation) {
            const metadata = result.metadata || {};
            if (metadata.context) {
                const context = metadata.context;
                content += `CONTEXT:\n`;
                if (context.description) {
                    content += `- Description: ${context.description}\n`;
                }
                if (context.keyPoints && context.keyPoints.length > 0) {
                    content += `- Key Points: ${context.keyPoints.join(', ')}\n`;
                }
                if (context.isDefinition) {
                    content += `- This text contains a definition\n`;
                }
                if (context.containsExample) {
                    content += `- This text contains examples\n`;
                }
                if (context.relatedTopics && context.relatedTopics.length > 0) {
                    content += `- Related Topics: ${context.relatedTopics.join(', ')}\n`;
                }
            }
            // Include document-level context if available
            if (metadata.documentSummary) {
                content += `DOCUMENT SUMMARY: ${metadata.documentSummary}\n`;
            }
            if (metadata.documentType) {
                content += `DOCUMENT TYPE: ${metadata.documentType}\n`;
            }
            if (metadata.primaryTopics) {
                content += `MAIN TOPICS: ${metadata.primaryTopics}\n`;
            }
        }
        // Include visual content if available and enabled
        if (options.useMultiModalContent && result.visualContent && result.visualContent.length > 0) {
            content += `VISUAL CONTENT:\n`;
            result.visualContent.forEach((visual, vIndex) => {
                content += `- Visual ${vIndex + 1} (${visual.type}): ${visual.description}\n`;
                if (visual.text) {
                    content += `  Text in visual: ${visual.text}\n`;
                }
            });
        }
        return content;
    });
    return formattedResults.join('\n---\n\n');
}
/**
 * Create a default system prompt based on options
 */
function createDefaultSystemPrompt(options) {
    let prompt = `You are an AI assistant providing answers based on the given context.`;
    if (options.useContextualInformation) {
        prompt += `
When answering:
- Use the contextual information provided to understand how different pieces of information relate to each other
- Pay attention to document summaries and key points to get a better understanding of the overall content
- Consider the document type and technical level to adjust your response appropriately
- When a text contains definitions or examples, use that information in your answer`;
    }
    if (options.useMultiModalContent) {
        prompt += `
When visual content is mentioned:
- Incorporate relevant information from images, charts, or diagrams
- Explain what the visuals show and how they relate to the query
- For charts and data visualizations, describe key trends or metrics
- Include information from both text and visuals in a coherent way`;
    }
    prompt += `
Your answer should be:
- Comprehensive and accurate based on the provided context
- Well-structured and easy to understand
- Focused on directly answering the query
${options.includeSourceCitations ? '- Including appropriate source citations using [Source: X] format' : ''}

Do not include information not present in the context. If you don't have enough information to answer, say so clearly.`;
    return prompt;
}
/**
 * Entry point for answer generation that selects the appropriate method
 * based on query type and available context
 */
export async function generateAnswer(query, searchResults, options = {}) {
    // Detect if query is likely about visual content
    const visualKeywords = [
        'image', 'picture', 'photo', 'chart', 'graph', 'diagram', 'figure',
        'table', 'illustration', 'visual', 'shown', 'displayed', 'see'
    ];
    const hasVisualKeyword = visualKeywords.some(keyword => query.toLowerCase().includes(keyword));
    // Check if results contain visual content
    const hasVisualResults = searchResults.some(result => result.visualContent && result.visualContent.length > 0);
    // Check if multi-modal features are enabled
    const multiModalEnabled = isFeatureEnabled('multiModalSearch') &&
        options.useMultiModalContent !== false;
    // Decide which generation method to use
    if (multiModalEnabled && (hasVisualKeyword || hasVisualResults)) {
        return generateAnswerWithVisualContext(query, searchResults, options);
    }
    else {
        return generateContextAwareAnswer(query, searchResults, options);
    }
}

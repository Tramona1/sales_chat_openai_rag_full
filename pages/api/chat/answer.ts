import { NextApiRequest, NextApiResponse } from 'next';
import { hybridSearch, fallbackSearch } from '@/utils/hybridSearch';
import { generateChatCompletion } from '@/utils/openaiClient';
import { VectorStoreItem } from '@/utils/vectorStore';

/**
 * Handle user query and generate response
 */
export async function handleQuery(query: string): Promise<{ 
  answer: string, 
  sources: string[], 
  statusCode: number,
  error?: string
}> {
  try {
    console.log(`Processing query: ${query}`);
    
    // First try standard search (excluding deprecated docs by default)
    let searchResponse = await hybridSearch(query);
    let searchResults = Array.from(searchResponse); // Use iterator protocol for backward compatibility
    
    // If no results, try fallback search
    if (searchResults.length === 0) {
      console.log('No results from primary search, trying fallback search');
      const fallbackResponse = await fallbackSearch(query);
      searchResults = Array.from(fallbackResponse);
    }
    
    // If still no results, return a no-results message
    if (searchResults.length === 0) {
      console.log('No results found even with fallback search');
      return {
        answer: "I'm sorry, but I couldn't find information related to your question in my knowledge base.",
        sources: [],
        statusCode: 404
      };
    }
    
    // Prepare context from search results
    const context = searchResults
      .map(item => {
        const source = item.metadata?.source || 'unknown';
        const lastUpdated = item.metadata?.lastUpdated 
          ? `(Last updated: ${new Date(item.metadata.lastUpdated).toLocaleDateString()})` 
          : '';
        const authoritative = item.metadata?.isAuthoritative === 'true' 
          ? ' [AUTHORITATIVE SOURCE]' 
          : '';
        
        return `SOURCE [${source}]${authoritative}${lastUpdated}:\n${item.text}\n`;
      })
      .join('\n\n');
    
    // Create prompt for LLM
    const systemPrompt = `You are a helpful AI assistant that accurately answers user questions 
based on the context provided. If the context doesn't contain the relevant information, 
acknowledge that you don't know instead of making up an answer.

When referencing information, include the source identifier (e.g., "According to [SOURCE-123]...").
Prioritize information from sources marked as "AUTHORITATIVE SOURCE" when there are conflicts in the provided context.
Use the most recently updated information when available.`;

    const userPrompt = `CONTEXT:\n${context}\n\nQUESTION: ${query}\n\nAnswer the question based only on the provided context. Include relevant SOURCE references.`;
    
    // Generate answer using LLM
    const answer = await generateChatCompletion(systemPrompt, userPrompt);
    
    // Extract sources from results
    const sources = searchResults
      .map(item => item.metadata?.source || '')
      .filter(source => source !== '');
    
    // Return the answer and sources
    return {
      answer,
      sources,
      statusCode: 200
    };
  } catch (error) {
    console.error('Error generating answer:', error);
    return {
      answer: "I'm sorry, there was an error processing your question. Please try again later.",
      sources: [],
      statusCode: 500,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * API handler for chat answers
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  // Extract query from request body
  const { query } = req.body;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ message: 'Missing or invalid query parameter' });
  }
  
  try {
    // Process the query
    const { answer, sources, statusCode, error } = await handleQuery(query);
    
    // Return the response
    return res.status(statusCode).json({
      answer,
      sources,
      error
    });
  } catch (error) {
    console.error('Error in API handler:', error);
    return res.status(500).json({
      message: 'An unexpected error occurred',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 
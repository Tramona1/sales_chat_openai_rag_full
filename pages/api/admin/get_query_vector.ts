// pages/api/admin/get_query_vector.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getEmbeddingClient } from '../../../utils/embeddingClient'; // Adjust path as necessary
import { logError, logInfo } from '../../../utils/logger'; // Adjust path as necessary
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

interface ResponseData {
  vector?: number[];
  error?: string;
  dimension?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { queryText } = req.body;

  if (!queryText || typeof queryText !== 'string' || queryText.trim() === '') {
    return res.status(400).json({ error: 'Query text is required and must be a non-empty string.' });
  }

  logInfo('[API /admin/get_query_vector] Received request', { queryText });

  try {
    const embeddingClient = getEmbeddingClient();
    
    // Generate the embedding using the RETRIEVAL_QUERY task type (default for embedText)
    const vector = await embeddingClient.embedText(queryText);
    const dimension = embeddingClient.getDimensions();

    if (!vector || vector.length === 0) {
      logError('[API /admin/get_query_vector] EmbedText returned empty vector', { queryText });
      return res.status(500).json({ error: 'Failed to generate embedding: Empty vector returned.' });
    }

    logInfo('[API /admin/get_query_vector] Successfully generated vector', { queryText, dimension });
    return res.status(200).json({ vector, dimension });

  } catch (error: any) {
    logError('[API /admin/get_query_vector] Error generating embedding', { queryText, error: error.message, stack: error.stack });
    return res.status(500).json({ error: `Error generating embedding: ${error.message}` });
  }
} 
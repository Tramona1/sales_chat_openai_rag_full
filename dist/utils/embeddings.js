/**
 * Utility for generating and working with text embeddings
 */
import { logInfo, logError } from './logger';
/**
 * Generate an embedding vector for the given text
 *
 * @param text The text to embed
 * @returns A vector of floating point numbers representing the text embedding
 */
export async function embed(text) {
    try {
        // This is a placeholder implementation that should be replaced with a real embedding model
        // You could use OpenAI's embeddings API, Hugging Face, or another embedding service
        logInfo(`Generating embedding for text (${text.length} chars)`);
        // For now, generate a random vector of 384 dimensions (common for small embedding models)
        // This is just for testing and should be replaced with real embeddings
        const dimensions = 384;
        const randomVector = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
        // Normalize the vector to have unit length
        return normalizeVector(randomVector);
    }
    catch (error) {
        logError('Error generating embedding:', error);
        throw new Error('Failed to generate embedding');
    }
}
/**
 * Normalize a vector to have unit length (L2 norm)
 */
function normalizeVector(vector) {
    // Calculate the L2 norm (Euclidean length) of the vector
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    // Normalize each component by dividing by the norm
    return vector.map(val => val / norm);
}

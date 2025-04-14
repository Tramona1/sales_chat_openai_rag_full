"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cosineSimilarity = cosineSimilarity;
var dotenv_1 = __importDefault(require("dotenv"));
var path_1 = __importDefault(require("path")); // Keep path for dotenv
// Load environment variables
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
// TODO: Define more specific types based on Supabase schema if needed
// e.g., type DocumentChunk = Database['public']['Tables']['document_chunks']['Row'];
// Remove old file system imports and variables
// import fs from 'fs';
// import path from 'path';
// const VECTOR_STORE_DIR = path.join(process.cwd(), 'data', 'vector_batches');
// const BATCH_INDEX_FILE = path.join(process.cwd(), 'data', 'batch_index.json');
// const MAX_BATCH_SIZE = 1000;
// let vectorStore: VectorStoreItem[] = []; // REMOVED - No longer in-memory
// let activeBatches: string[] = []; // REMOVED
// REMOVED File I/O Functions:
// initVectorStore()
// loadVectorStore()
// createNewBatch()
// saveBatch()
// saveVectorStore()
function cosineSimilarity(vecA, vecB) {
    // Keep this utility function as it's pure math
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
        // console.error("Invalid vectors for cosine similarity", { aLength: vecA?.length, bLength: vecB?.length });
        return 0;
    }
    var dotProduct = 0.0;
    var normA = 0.0;
    var normB = 0.0;
    for (var i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    var normA_sqrt = Math.sqrt(normA);
    var normB_sqrt = Math.sqrt(normB);
    if (normA_sqrt === 0 || normB_sqrt === 0) {
        // console.warn("Zero vector encountered in cosine similarity");
        return 0;
    }
    var similarity = dotProduct / (normA_sqrt * normB_sqrt);
    // Clamp similarity to [-1, 1] due to potential floating point inaccuracies
    return Math.max(-1, Math.min(1, similarity));
}
// REMOVED - Obsolete/duplicate Supabase implementation moved to supabaseClient.ts
// export async function getSimilarItems(
//   queryEmbedding: number[],
//   limit: number = 5,
//   options?: { match_threshold?: number } // Add options object for flexibility
// ): Promise<(VectorStoreItem & { score: number })[]> { // Ensure score is part of the return type
// 
//   const match_threshold = options?.match_threshold ?? 0.7; // Default threshold
//   const match_count = limit;
// 
//   try {
//     const client = getSupabaseAdmin(); // Get the initialized client
//     const { data, error } = await client.rpc('search_vectors', {
//       query_embedding: queryEmbedding,
//       match_threshold,
//       match_count
//     });
// 
//     if (error) {
//       console.error('Error fetching similar items from Supabase:', error);
//       throw new Error(`Failed to get similar items: ${error.message}`);
//     }
// 
//     if (!data) {
//     return [];
//   }
//   
//     // Map RPC result (which includes 'similarity') to VectorStoreItem & { score: number }
//     const results: (VectorStoreItem & { score: number })[] = data.map((item: any) => ({
//       id: item.id,
//       document_id: item.document_id,
//       chunk_index: item.chunk_index,
//       // We defined the search_vectors function to return original_text as 'content'
//       // Handle both column names for robustness
//       originalText: item.original_text || item.content || '',
//       text: item.text || item.content || '',
//       metadata: item.metadata,
//       embedding: [], // Embedding not returned by search_vectors, set empty array
//       score: item.similarity // Map similarity to score
//     }));
// 
//     return results;
// 
//   } catch (error) {
//     console.error('Supabase RPC failed in getSimilarItems:', error);
//     // Re-throw or handle as appropriate for the application
//     throw error;
//   }
// }
// REMOVED - Obsolete implementation, handled by factory/supabaseClient
// export async function clearVectorStore(): Promise<void> {
// ... (warnings removed)
// }
// REMOVED - Obsolete implementation, handled by factory/supabaseClient
// export async function getVectorStoreSize(): Promise<number> {
// ... (implementation removed)
// }
// REMOVED - Obsolete implementation, handled by factory/supabaseClient
// export async function getAllVectorStoreItems(): Promise<VectorStoreItem[]> {
// ... (implementation removed)
// }
// Initial load is no longer needed as we query DB directly
// loadVectorStore(); 

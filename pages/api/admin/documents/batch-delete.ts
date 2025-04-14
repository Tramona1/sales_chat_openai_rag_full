import { NextApiRequest, NextApiResponse } from 'next';
import { standardizeApiErrorResponse } from '../../../../utils/errorHandling';
import { logError, logInfo } from '../../../../utils/logger'; // Use correct logger path
import { getSupabaseAdmin } from '../../../../utils/supabaseClient'; // Import Supabase client

// Remove obsolete file system imports and constants
// import path from 'path';
// import fs from 'fs';
// const VECTOR_STORE_DIR = path.join(process.cwd(), 'data', 'vector_batches');
// const BATCH_INDEX_FILE = path.join(process.cwd(), 'data', 'batch_index.json');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: { 
        message: 'Method Not Allowed', 
        code: 'method_not_allowed' 
      } 
    });
  }

  // Extract the document IDs from the request body
  const { documentIds } = req.body;
  
  if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
    return res.status(400).json({ 
      error: { 
        message: 'Document IDs are required and must be an array', 
        code: 'invalid_request' 
      } 
    });
  }
  
  logInfo(`Received request to batch delete ${documentIds.length} documents`, { documentIds });

  try {
    const supabase = getSupabaseAdmin();

    // 1. Find chunks associated with the document IDs to confirm existence
    const { data: chunksData, error: fetchError } = await supabase
      .from('document_chunks')
      .select('id, document_id') // Select only necessary fields
      .in('document_id', documentIds);

    if (fetchError) {
      logError('Error fetching document chunks for deletion', fetchError);
      throw new Error(`Failed to fetch document chunks: ${fetchError.message}`);
    }

    const chunksToDelete = chunksData || [];
    const chunkIdsToDelete = chunksToDelete.map(chunk => chunk.id);
    const foundDocumentIds = [...new Set(chunksToDelete.map(chunk => chunk.document_id))];
    const notFoundIds = documentIds.filter(id => !foundDocumentIds.includes(id));

    logInfo(`Found ${chunksToDelete.length} chunks for ${foundDocumentIds.length} documents. IDs not found: ${notFoundIds.length}`, { foundDocumentIds, notFoundIds });

    if (foundDocumentIds.length === 0) {
      logInfo('No matching documents found for deletion.');
      return res.status(404).json({
        success: false,
        message: 'None of the specified documents were found.',
        deletedCount: 0,
        deletedIds: [],
        notFoundIds: documentIds,
        failedIds: []
      });
    }

    // Track deletion results
    let deletedChunkCount = 0;
    let deletedDocCount = 0;
    const failedChunkDeletions: string[] = []; // Store chunk IDs that failed
    const failedDocDeletions: string[] = [];   // Store document IDs that failed

    // 2. Delete the chunks from document_chunks table
    if (chunkIdsToDelete.length > 0) {
      logInfo(`Attempting to delete ${chunkIdsToDelete.length} chunks...`);
      const { count: chunkDeleteCount, error: deleteChunkError } = await supabase
        .from('document_chunks')
        .delete({ count: 'exact' }) // Get count of deleted rows
        .in('id', chunkIdsToDelete);

      deletedChunkCount = chunkDeleteCount ?? 0;

      if (deleteChunkError) {
        // Log error but proceed to attempt document deletion
        logError('Error deleting document chunks', { error: deleteChunkError, chunkIds: chunkIdsToDelete });
        // Consider all related documents potentially failed if chunks couldn't be deleted reliably
        failedDocDeletions.push(...foundDocumentIds); 
      } else {
        logInfo(`Successfully deleted ${deletedChunkCount} chunks.`);
      }
    }

    // 3. Delete the documents from the 'documents' table
    // Filter out documents that already failed due to chunk deletion errors
    const documentsToDelete = foundDocumentIds.filter(id => !failedDocDeletions.includes(id));
    if (documentsToDelete.length > 0) {
      logInfo(`Attempting to delete ${documentsToDelete.length} documents from documents table...`);
      const { count: docDeleteCount, error: deleteDocError } = await supabase
        .from('documents') // Assuming 'documents' table name
        .delete({ count: 'exact' })
        .in('id', documentsToDelete);

      deletedDocCount = docDeleteCount ?? 0;

      if (deleteDocError) {
        logError('Error deleting documents from documents table', { error: deleteDocError, documentIds: documentsToDelete });
        // Add these documents to the failed list
        failedDocDeletions.push(...documentsToDelete);
      } else {
        logInfo(`Successfully deleted ${deletedDocCount} documents from the documents table.`);
      }
    }

    // Determine final success/failure lists
    const successfullyDeletedIds = foundDocumentIds.filter(id => !failedDocDeletions.includes(id));
    // Combine IDs not found initially and IDs that failed during deletion attempts
    const failedOrNotFoundIds = [...new Set([...notFoundIds, ...failedDocDeletions])]; 

    logInfo(`Batch deletion completed. Success: ${successfullyDeletedIds.length}, Failed/Not Found: ${failedOrNotFoundIds.length}`);

    // Return the results
    return res.status(200).json({
      success: true, // Indicates the API call itself succeeded
      message: `Processed ${documentIds.length} documents. Deleted: ${successfullyDeletedIds.length}, Failed/Not Found: ${failedOrNotFoundIds.length}`,
      deletedCount: successfullyDeletedIds.length,
      deletedIds: successfullyDeletedIds,
      // Keep separate lists for clarity
      notFoundIds: notFoundIds, 
      failedIds: failedDocDeletions 
    });
    
  } catch (error) {
    logError('Critical error during batch delete process', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json({
      ...errorResponse,
      success: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred during batch deletion.',
      code: 'batch_delete_failed'
    });
  }
} 
import { createClient } from '@supabase/supabase-js';
import { logError, logInfo } from './logger';
// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
/**
 * Upload an image file to Supabase Storage
 */
export async function uploadImage(file, fileName, documentId) {
    try {
        // Define the storage path based on document ID
        // This groups related images together and avoids collisions
        const storagePath = `documents/${documentId}/${fileName}`;
        // Upload the file to Supabase Storage
        const { data, error } = await supabase
            .storage
            .from('visual_content')
            .upload(storagePath, file, {
            upsert: true,
            contentType: getContentType(fileName)
        });
        if (error) {
            logError('Error uploading image to Supabase Storage:', error);
            return null;
        }
        // Get the public URL
        const { data: publicUrlData } = supabase
            .storage
            .from('visual_content')
            .getPublicUrl(storagePath);
        return publicUrlData.publicUrl;
    }
    catch (error) {
        logError('Error in uploadImage:', error);
        return null;
    }
}
/**
 * Get content type based on file extension
 */
function getContentType(fileName) {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const contentTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
        'pdf': 'application/pdf'
    };
    return contentTypes[extension] || 'application/octet-stream';
}
/**
 * Delete an image from Supabase Storage
 */
export async function deleteImage(url) {
    try {
        // Extract path from URL
        const path = url.split('visual_content/')[1];
        if (!path) {
            logError('Invalid storage URL format:', url);
            return false;
        }
        // Delete the file
        const { error } = await supabase
            .storage
            .from('visual_content')
            .remove([path]);
        if (error) {
            logError('Error deleting image from Supabase Storage:', error);
            return false;
        }
        logInfo(`Successfully deleted image: ${path}`);
        return true;
    }
    catch (error) {
        logError('Error in deleteImage:', error);
        return false;
    }
}
/**
 * Get image URLs for a document
 */
export async function getDocumentImages(documentId) {
    try {
        // List files in the document's folder
        const { data, error } = await supabase
            .storage
            .from('visual_content')
            .list(`documents/${documentId}`);
        if (error) {
            logError('Error listing images for document:', error);
            return [];
        }
        if (!data || data.length === 0) {
            return [];
        }
        // Convert to public URLs
        return data.map(file => {
            const path = `documents/${documentId}/${file.name}`;
            const { data } = supabase
                .storage
                .from('visual_content')
                .getPublicUrl(path);
            return data.publicUrl;
        });
    }
    catch (error) {
        logError('Error in getDocumentImages:', error);
        return [];
    }
}

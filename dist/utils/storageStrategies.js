/**
 * Storage Strategies
 *
 * This module defines strategies for storing different types of content,
 * including images and other binary assets.
 */
import fs from 'fs/promises';
import path from 'path';
import { getSafeFilename } from './fileUtils';
import { generateRandomId } from './hashUtils';
import { logError, logInfo } from './logger';
import { getSupabaseAdmin } from './supabaseClient';
/**
 * File system based storage strategy
 */
class FileSystemStorageStrategy {
    constructor() {
        this.storageDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage', 'images');
        this.baseUrl = process.env.STORAGE_BASE_URL || '/api/assets';
        // Ensure storage directory exists
        this.initStorage();
    }
    async initStorage() {
        try {
            await fs.mkdir(this.storageDir, { recursive: true });
        }
        catch (error) {
            logError('Failed to initialize storage directory', error);
        }
    }
    async uploadImage(filePath, filename) {
        try {
            const safeFilename = getSafeFilename(filename);
            const imageId = generateRandomId('img');
            const storagePath = path.join(this.storageDir, `${imageId}_${safeFilename}`);
            // Copy file to storage location
            await fs.copyFile(filePath, storagePath);
            logInfo(`Uploaded image to ${storagePath}`);
            return imageId;
        }
        catch (error) {
            logError('Failed to upload image to filesystem', error);
            throw new Error('Failed to upload image');
        }
    }
    async getPublicUrl(imageId) {
        try {
            // Find the file with the matching image ID prefix
            const files = await fs.readdir(this.storageDir);
            const matchingFile = files.find(file => file.startsWith(`${imageId}_`));
            if (!matchingFile) {
                throw new Error(`Image with ID ${imageId} not found`);
            }
            return `${this.baseUrl}/${matchingFile}`;
        }
        catch (error) {
            logError('Failed to get public URL', error);
            return `${this.baseUrl}/not-found.png`;
        }
    }
    async deleteImage(imageId) {
        try {
            // Find the file with the matching image ID prefix
            const files = await fs.readdir(this.storageDir);
            const matchingFile = files.find(file => file.startsWith(`${imageId}_`));
            if (!matchingFile) {
                return false;
            }
            await fs.unlink(path.join(this.storageDir, matchingFile));
            return true;
        }
        catch (error) {
            logError('Failed to delete image', error);
            return false;
        }
    }
}
/**
 * Supabase storage strategy
 */
class SupabaseStorageStrategy {
    constructor() {
        this.bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'approved-documents';
        this.baseUrl = process.env.STORAGE_BASE_URL || '';
        // Make sure bucket exists when initializing
        this.initBucket();
    }
    async initBucket() {
        try {
            const supabase = getSupabaseAdmin();
            logInfo(`Checking Supabase storage bucket: ${this.bucketName}`);
            const { data, error } = await supabase.storage.getBucket(this.bucketName);
            if (error) {
                // Check if it's a "not found" error
                const errorMessage = error.message || '';
                if (errorMessage.includes('not found') || errorMessage.includes('Not found')) {
                    // Create bucket if it doesn't exist
                    logInfo(`Bucket not found, creating bucket: ${this.bucketName}`);
                    await supabase.storage.createBucket(this.bucketName, {
                        public: true
                    });
                    logInfo(`Created Supabase storage bucket: ${this.bucketName}`);
                }
                else {
                    logError('Error checking Supabase bucket', error);
                }
            }
            else {
                logInfo(`Successfully connected to bucket: ${this.bucketName}`);
            }
        }
        catch (error) {
            logError('Failed to initialize Supabase storage bucket', error);
        }
    }
    async uploadImage(filePath, filename) {
        try {
            const supabase = getSupabaseAdmin();
            const fileContent = await fs.readFile(filePath);
            const safeFilename = getSafeFilename(filename);
            const imageId = generateRandomId('img');
            const storagePath = `${imageId}_${safeFilename}`;
            // Upload to Supabase Storage
            const { error } = await supabase.storage
                .from(this.bucketName)
                .upload(storagePath, fileContent);
            if (error) {
                throw error;
            }
            logInfo(`Uploaded image to Supabase: ${storagePath}`);
            return imageId;
        }
        catch (error) {
            logError('Failed to upload image to Supabase', error);
            throw new Error('Failed to upload image');
        }
    }
    async getPublicUrl(imageId) {
        try {
            const supabase = getSupabaseAdmin();
            // List files to find the matching image ID
            const { data, error } = await supabase.storage
                .from(this.bucketName)
                .list();
            if (error) {
                throw error;
            }
            const matchingFile = data.find(file => file.name.startsWith(`${imageId}_`));
            if (!matchingFile) {
                throw new Error(`Image with ID ${imageId} not found`);
            }
            // Get public URL
            const { data: urlData } = supabase.storage
                .from(this.bucketName)
                .getPublicUrl(matchingFile.name);
            return urlData.publicUrl;
        }
        catch (error) {
            logError('Failed to get public URL from Supabase', error);
            return `${this.baseUrl}/not-found.png`;
        }
    }
    async deleteImage(imageId) {
        try {
            const supabase = getSupabaseAdmin();
            // List files to find the matching image ID
            const { data, error } = await supabase.storage
                .from(this.bucketName)
                .list();
            if (error) {
                throw error;
            }
            const matchingFile = data.find(file => file.name.startsWith(`${imageId}_`));
            if (!matchingFile) {
                return false;
            }
            // Delete the file
            const { error: deleteError } = await supabase.storage
                .from(this.bucketName)
                .remove([matchingFile.name]);
            return !deleteError;
        }
        catch (error) {
            logError('Failed to delete image from Supabase', error);
            return false;
        }
    }
}
// Determine which strategy to use based on environment
const useSupabaseStorage = process.env.USE_SUPABASE === 'true';
// Export the appropriate strategy
export const visualStorageStrategy = useSupabaseStorage
    ? new SupabaseStorageStrategy()
    : new FileSystemStorageStrategy();
// Log which strategy is being used
logInfo(`Using ${useSupabaseStorage ? 'Supabase' : 'filesystem'} storage strategy`);

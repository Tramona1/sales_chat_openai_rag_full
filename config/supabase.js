/**
 * Supabase Configuration
 * 
 * This file contains configuration settings for connecting to Supabase.
 * The values can be overridden using environment variables.
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Supabase connection settings
export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iqnxlmfyduuxfrtsrzcu.supabase.co';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxbnhsbWZ5ZHV1eGZydHNyemN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxNjU5MTQsImV4cCI6MjA1OTc0MTkxNH0.yuC4l0nDq9H59clOhXY8LnkgP3cLF3dafJm-LsuMKLA';
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Table names (for consistent reference across the application)
export const TABLES = {
  DOCUMENTS: 'documents',
  DOCUMENT_CHUNKS: 'document_chunks',
  VECTOR_ITEMS: 'vector_items',
  CORPUS_STATISTICS: 'corpus_statistics',
  VISUAL_CONTENT: 'visual_content'
};

/**
 * Creates a Supabase client with the provided key or falls back to the anon key
 * @param {string} [key] - Optional API key to use (defaults to anon key)
 * @returns {Object} Supabase client
 */
export function createSupabaseClient(key = SUPABASE_ANON_KEY) {
  return createClient(SUPABASE_URL, key);
}

/**
 * Creates a Supabase client with the service role key
 * for admin operations that require elevated privileges
 * @returns {Object} Supabase client with service role
 * @throws {Error} If the service role key is not available
 */
export function createServiceClient() {
  if (!SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_KEY is not defined in environment variables');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export default {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  serviceKey: SUPABASE_SERVICE_KEY,
  tables: TABLES,
  createClient: createSupabaseClient,
  createServiceClient
}; 
/**
 * Supabase client utilities for Vercel deployments
 * 
 * This module provides specialized Supabase client creation functions
 * that are optimized for the Vercel serverless environment.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logError, logInfo, logDebug } from './logger';

/**
 * Validates Supabase configuration presence
 * @returns Boolean indicating if required configuration is present
 */
export function validateSupabaseConfig(): boolean {
  // Check for the presence of required environment variables
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_KEY;
  
  // Enhanced debugging for Vercel
  console.log('[VERCEL DEBUG] Supabase config validation:');
  console.log(`[VERCEL DEBUG] - hasUrl: ${hasUrl} (${process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 15)}...)`);
  console.log(`[VERCEL DEBUG] - hasAnonKey: ${hasAnonKey}`);
  console.log(`[VERCEL DEBUG] - hasServiceKey: ${hasServiceKey}`);
  console.log(`[VERCEL DEBUG] - Environment: VERCEL=${process.env.VERCEL}, NODE_ENV=${process.env.NODE_ENV}`);
  
  // Debug output for Vercel deployments
  logDebug('Supabase config validation:', {
    hasUrl,
    hasAnonKey, 
    hasServiceKey,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 10) + '...' || 'not set'
  });
  
  return hasUrl && (hasAnonKey || hasServiceKey);
}

/**
 * Creates a Supabase client with service role permissions for Vercel
 * @returns A Supabase client or null if configuration is missing
 */
export function createVercelServiceClient(): SupabaseClient | null {
  try {
    console.log('[VERCEL DEBUG] Creating Vercel service client');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    console.log(`[VERCEL DEBUG] - supabaseUrl set: ${!!supabaseUrl}`);
    console.log(`[VERCEL DEBUG] - supabaseKey set: ${!!supabaseKey}`);
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[VERCEL DEBUG] Missing Supabase credentials for service client');
      logError('Missing Supabase credentials for service client. Check environment variables.');
      return null;
    }
    
    try {
      console.log('[VERCEL DEBUG] Attempting to create Supabase client');
      const client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      });
      
      console.log('[VERCEL DEBUG] Supabase client created successfully');
      
      // Test if the client methods are available
      if (typeof client.from !== 'function') {
        console.error('[VERCEL DEBUG] Supabase client missing .from() method!');
      }
      
      return client;
    } catch (createError) {
      console.error('[VERCEL DEBUG] Error during client creation:', createError);
      throw createError;
    }
  } catch (error) {
    console.error('[VERCEL DEBUG] Error in createVercelServiceClient:', error);
    logError('Error creating Vercel service client:', error);
    return null;
  }
}

/**
 * Gets a Supabase client for use in Vercel environments
 * @returns A Supabase client or null if configuration is missing
 */
export function getVercelSupabase(): SupabaseClient | null {
  console.log('[VERCEL DEBUG] Getting Vercel Supabase client');
  try {
    const client = createVercelServiceClient();
    console.log(`[VERCEL DEBUG] Client created: ${!!client}`);
    return client;
  } catch (error) {
    console.error('[VERCEL DEBUG] Error in getVercelSupabase:', error);
    logError('Error in getVercelSupabase:', error);
    return null;
  }
}

/**
 * Gets an admin Supabase client for use in Vercel environments
 * @returns A Supabase client with admin permissions
 */
export function getVercelSupabaseAdmin(): SupabaseClient | null {
  console.log('[VERCEL DEBUG] Getting Vercel Supabase admin client');
  const client = createVercelServiceClient();
  console.log(`[VERCEL DEBUG] Admin client created: ${!!client}`);
  return client;
}

/**
 * Tests connection to Supabase in Vercel environment
 * @returns Promise that resolves to a boolean indicating if the connection was successful
 */
export async function testVercelSupabaseConnection(): Promise<boolean> {
  console.log('[VERCEL DEBUG] Testing Vercel Supabase connection');
  try {
    const supabase = getVercelSupabase();
    if (!supabase) {
      console.error('[VERCEL DEBUG] Failed to create Supabase client for connection test');
      logError('Failed to create Supabase client for connection test');
      return false;
    }
    
    console.log('[VERCEL DEBUG] Testing connection by querying document_chunks table');
    try {
      const { data, error } = await supabase
        .from('document_chunks')
        .select('id')
        .limit(1);
        
      if (error) {
        console.error('[VERCEL DEBUG] Supabase connection test failed:', error);
        logError('Supabase connection test failed:', error);
        return false;
      }
      
      console.log('[VERCEL DEBUG] Supabase connection test successful');
      logInfo('Supabase connection test successful');
      return true;
    } catch (queryError) {
      console.error('[VERCEL DEBUG] Error during connection test query:', queryError);
      return false;
    }
  } catch (error) {
    console.error('[VERCEL DEBUG] Error in testVercelSupabaseConnection:', error);
    logError('Error testing Supabase connection:', error);
    return false;
  }
}

/**
 * Explicitly checks if the company_information_cache table exists
 * @returns Promise that resolves to boolean indicating if cache table exists
 */
export async function checkCacheTableExists(): Promise<boolean> {
  console.log('[VERCEL DEBUG] Checking if company_information_cache table exists');
  try {
    const supabase = getVercelSupabase();
    if (!supabase) {
      console.error('[VERCEL DEBUG] Failed to create Supabase client for table check');
      return false;
    }
    
    // Try to query the table
    const { data, error } = await supabase
      .from('company_information_cache')
      .select('id')
      .limit(1);
      
    if (error) {
      // Check if the error indicates the table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.error('[VERCEL DEBUG] Table company_information_cache does not exist');
        return false;
      }
      
      console.error('[VERCEL DEBUG] Error checking table existence:', error);
      return false;
    }
    
    console.log('[VERCEL DEBUG] Table company_information_cache exists');
    return true;
  } catch (error) {
    console.error('[VERCEL DEBUG] Error checking cache table:', error);
    return false;
  }
} 
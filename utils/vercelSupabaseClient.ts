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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      logError('Missing Supabase credentials for service client. Check environment variables.');
      return null;
    }
    
    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
  } catch (error) {
    logError('Error creating Vercel service client:', error);
    return null;
  }
}

/**
 * Gets a Supabase client for use in Vercel environments
 * @returns A Supabase client or null if configuration is missing
 */
export function getVercelSupabase(): SupabaseClient | null {
  try {
    return createVercelServiceClient();
  } catch (error) {
    logError('Error in getVercelSupabase:', error);
    return null;
  }
}

/**
 * Gets an admin Supabase client for use in Vercel environments
 * @returns A Supabase client with admin permissions
 */
export function getVercelSupabaseAdmin(): SupabaseClient | null {
  return createVercelServiceClient();
}

/**
 * Tests connection to Supabase in Vercel environment
 * @returns Promise that resolves to a boolean indicating if the connection was successful
 */
export async function testVercelSupabaseConnection(): Promise<boolean> {
  try {
    const supabase = getVercelSupabase();
    if (!supabase) {
      logError('Failed to create Supabase client for connection test');
      return false;
    }
    
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id')
      .limit(1);
      
    if (error) {
      logError('Supabase connection test failed:', error);
      return false;
    }
    
    logInfo('Supabase connection test successful');
    return true;
  } catch (error) {
    logError('Error testing Supabase connection:', error);
    return false;
  }
} 
/**
 * Supabase client utilities specifically optimized for Vercel deployment
 * 
 * This module provides helper functions for working with Supabase
 * in a Vercel deployment environment, with additional fallbacks
 * and diagnostic information.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logError, logInfo, logDebug } from '../lib/logging';

// Environment variables for Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Placeholder for cached clients
let serviceClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

/**
 * Validates that all required Supabase configuration is available
 */
export function validateSupabaseConfig(): boolean {
  const missingVars = [];
  
  if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missingVars.push('SUPABASE_ANON_KEY');
  if (!SUPABASE_SERVICE_KEY) missingVars.push('SUPABASE_SERVICE_KEY');
  
  if (missingVars.length > 0) {
    console.error(`[CRITICAL] Missing Supabase environment variables: ${missingVars.join(', ')}`);
    return false;
  }
  
  return true;
}

/**
 * Creates a service client with fallback for Vercel
 */
export function createVercelServiceClient(): SupabaseClient | null {
  // Return cached client if available
  if (serviceClient) return serviceClient;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    logError('[Vercel] Missing Supabase configuration for service client');
    return null;
  }
  
  try {
    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    
    logInfo('[Vercel] Service client created successfully');
    return serviceClient;
  } catch (error) {
    logError('[Vercel] Error creating service client', error);
    return null;
  }
}

/**
 * Creates an admin client with fallback for Vercel
 */
export function createVercelAdminClient(): SupabaseClient | null {
  // Return cached client if available
  if (adminClient) return adminClient;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    logError('[Vercel] Missing Supabase configuration for admin client');
    // Log diagnostic information for troubleshooting
    console.error('URL Set:', !!SUPABASE_URL);
    console.error('Service Key Set:', !!SUPABASE_SERVICE_KEY);
    
    // Try to get more information about what's happening
    try {
      console.error('URL Length:', SUPABASE_URL?.length || 0);
      console.error('Service Key Length:', SUPABASE_SERVICE_KEY?.length || 0);
      
      // Try to check for common issues
      if (SUPABASE_URL?.includes('undefined') || SUPABASE_SERVICE_KEY?.includes('undefined')) {
        console.error('Environment variables contain "undefined" string - this indicates a configuration issue');
      }
    } catch (diagnosticError) {
      console.error('Error during diagnostics:', diagnosticError);
    }
    
    return null;
  }
  
  try {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: 'public',
      },
    });
    
    logInfo('[Vercel] Admin client created successfully');
    return adminClient;
  } catch (error) {
    logError('[Vercel] Error creating admin client', error);
    return null;
  }
}

/**
 * Gets a Supabase client suitable for Vercel deployments
 * Tries to handle Vercel-specific environment issues
 */
export function getVercelSupabase(): SupabaseClient | null {
  return createVercelServiceClient();
}

/**
 * Gets a Supabase admin client suitable for Vercel deployments
 * Tries to handle Vercel-specific environment issues
 */
export function getVercelSupabaseAdmin(): SupabaseClient | null {
  return createVercelAdminClient();
}

/**
 * Tests the connection to Supabase
 */
export async function testVercelSupabaseConnection(): Promise<boolean> {
  try {
    const client = getVercelSupabase();
    if (!client) return false;
    
    const { data, error } = await client.from('document_chunks').select('id').limit(1);
    return !error && Array.isArray(data);
  } catch (error) {
    logError('[Vercel] Error testing Supabase connection', error);
    return false;
  }
} 
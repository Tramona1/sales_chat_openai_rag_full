/**
 * Supabase utilities for the Sales Chat RAG system
 * 
 * This module provides helper functions for interacting with Supabase.
 */

import { getSupabase } from '../utils/supabaseClient';
import { logError } from './logging';

/**
 * Tests the connection to Supabase
 * @returns A boolean indicating whether the connection was successful
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    // Simple query to test connection
    const supabase = getSupabase();
    if (!supabase) return false;
    
    const { data, error } = await supabase.from('document_chunks').select('id').limit(1);
    return !error;
  } catch (e) {
    logError('Error testing Supabase connection:', e);
    return false;
  }
} 
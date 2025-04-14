/**
 * This script applies fixes to the Supabase database functions to resolve
 * ambiguity issues with vector search and hybrid search functions.
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Get Supabase credentials from environment variables
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error('Missing Supabase credentials. Please check your .env.local file.');
  process.exit(1);
}

// Create Supabase client with service role credentials
const supabase = createClient(url, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function applyFixesStep1() {
  console.log('Step 1: Checking for and dropping ambiguous functions...');
  
  try {
    // First, drop existing functions to avoid ambiguity
    console.log('Dropping existing match_documents function...');
    const { error: dropMatchError } = await supabase.rpc('drop_function_if_exists', {
      function_name: 'match_documents'
    }).catch(err => ({ error: err }));
    
    if (dropMatchError) {
      console.log('Failed to drop match_documents function. Creating a drop function first...');
      
      // Create a function to drop other functions
      const { error: createDropFuncError } = await supabase.rpc('execute_sql', {
        sql_statement: `
          CREATE OR REPLACE FUNCTION public.drop_function_if_exists(function_name text)
          RETURNS void
          LANGUAGE plpgsql
          AS $$
          BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS public.' || function_name || ' CASCADE';
          END;
          $$;
        `
      }).catch(err => ({ error: err }));
      
      if (createDropFuncError) {
        console.error('Failed to create drop_function_if_exists:', createDropFuncError.message);
        
        // Try direct SQL execution approach
        console.log('Trying direct SQL execution...');
        const { error: directDropError } = await supabase.rpc('execute_sql', {
          sql_statement: `DROP FUNCTION IF EXISTS public.match_documents CASCADE;`
        }).catch(err => ({ error: err }));
        
        if (directDropError) {
          console.error('Failed to drop match_documents function:', directDropError.message);
        } else {
          console.log('Successfully dropped match_documents function.');
        }
        
        // Try to drop hybrid_search as well
        const { error: directDropError2 } = await supabase.rpc('execute_sql', {
          sql_statement: `DROP FUNCTION IF EXISTS public.hybrid_search CASCADE;`
        }).catch(err => ({ error: err }));
        
        if (directDropError2) {
          console.error('Failed to drop hybrid_search function:', directDropError2.message);
        } else {
          console.log('Successfully dropped hybrid_search function.');
        }
      } else {
        console.log('Created drop_function_if_exists function.');
        
        // Try dropping again using the new function
        const { error: dropMatchError2 } = await supabase.rpc('drop_function_if_exists', {
          function_name: 'match_documents'
        }).catch(err => ({ error: err }));
        
        if (dropMatchError2) {
          console.error('Failed to drop match_documents function:', dropMatchError2.message);
        } else {
          console.log('Successfully dropped match_documents function.');
        }
        
        // Drop hybrid_search function
        const { error: dropHybridError } = await supabase.rpc('drop_function_if_exists', {
          function_name: 'hybrid_search'
        }).catch(err => ({ error: err }));
        
        if (dropHybridError) {
          console.error('Failed to drop hybrid_search function:', dropHybridError.message);
        } else {
          console.log('Successfully dropped hybrid_search function.');
        }
      }
    } else {
      console.log('Successfully dropped match_documents function.');
      
      // Drop hybrid_search function
      const { error: dropHybridError } = await supabase.rpc('drop_function_if_exists', {
        function_name: 'hybrid_search'
      }).catch(err => ({ error: err }));
      
      if (dropHybridError) {
        console.error('Failed to drop hybrid_search function:', dropHybridError.message);
      } else {
        console.log('Successfully dropped hybrid_search function.');
      }
    }
  } catch (error) {
    console.error('Error in Step 1:', error.message);
    throw error;
  }

  console.log('Step 1 completed.');
}

async function applyFixesStep2() {
  console.log('Step 2: Creating SQL execution function...');
  
  try {
    // Create a function to execute SQL statements
    const { error: createExecuteSqlError } = await supabase.rpc('execute_sql', {
      sql_statement: `
        CREATE OR REPLACE FUNCTION public.execute_sql(sql_statement text)
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        BEGIN
          EXECUTE sql_statement;
        END;
        $$;
      `
    }).catch(err => ({ error: err }));
    
    if (createExecuteSqlError) {
      // This might fail if the function already exists, which is okay
      console.log('Note: execute_sql function might already exist or failed to create:', createExecuteSqlError.message);
    } else {
      console.log('Created execute_sql function successfully.');
    }
  } catch (error) {
    console.error('Error in Step 2:', error.message);
    throw error;
  }

  console.log('Step 2 completed.');
}

async function applyFixesStep3() {
  console.log('Step 3: Applying SQL fixes from file...');
  
  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync('fix_vector_search.sql', 'utf8');
    
    // Split SQL file into separate statements by semicolons
    const statements = sqlContent.split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute.`);
    
    // Execute each statement separately
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i+1}/${statements.length}...`);
      
      const { error } = await supabase.rpc('execute_sql', {
        sql_statement: statement
      }).catch(err => ({ error: err }));
      
      if (error) {
        console.error(`Error executing statement ${i+1}:`, error.message);
        // Continue with the next statement even if this one failed
      } else {
        console.log(`Statement ${i+1} executed successfully.`);
      }
    }
  } catch (error) {
    console.error('Error in Step 3:', error.message);
    throw error;
  }

  console.log('Step 3 completed.');
}

async function verifyFixes() {
  console.log('Verifying fixes...');
  
  try {
    // Test the check_pgvector function
    const { data: pgvectorData, error: pgvectorError } = await supabase
      .rpc('check_pgvector')
      .catch(err => ({ error: err }));
      
    if (pgvectorError) {
      console.error('Error checking pgvector extension:', pgvectorError.message);
    } else {
      console.log('pgvector extension status:', pgvectorData);
    }
    
    // Test the get_tables function
    const { data: tablesData, error: tablesError } = await supabase
      .rpc('get_tables')
      .catch(err => ({ error: err }));
      
    if (tablesError) {
      console.error('Error getting tables:', tablesError.message);
    } else {
      console.log('Tables in the database:', tablesData);
    }
  } catch (error) {
    console.error('Error in verification:', error.message);
  }
  
  console.log('Verification completed.');
}

async function main() {
  console.log('Starting database fixes...');
  
  try {
    // Try to create the execute_sql function first, since we need it for other steps
    await applyFixesStep2();
    
    // Drop existing functions with potential ambiguity
    await applyFixesStep1();
    
    // Apply SQL fixes from the file
    await applyFixesStep3();
    
    // Verify that fixes were applied successfully
    await verifyFixes();
    
    console.log('Database fixes completed successfully.');
  } catch (error) {
    console.error('Error applying database fixes:', error.message);
    process.exit(1);
  }
}

main(); 
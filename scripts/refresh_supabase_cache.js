// Refresh the Supabase schema cache by forcing a reconnection
// This script should be run after making schema changes to ensure the cache is updated

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Supabase configuration is missing. Check your .env files.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to refresh schema cache
async function refreshSchemaCache() {
  console.log('Refreshing Supabase schema cache...');
  
  try {
    // First, check if we can connect to Supabase
    const { data: testData, error: testError } = await supabase
      .from('analytics_events')
      .select('id')
      .limit(1);
      
    if (testError) {
      if (testError.message.includes('does not exist')) {
        console.error('Table analytics_events does not exist. Please run the SQL script first.');
      } else {
        console.error('Error testing connection:', testError.message);
      }
    } else {
      console.log('Successfully connected to Supabase');
    }

    // Check for event_data column
    console.log('Checking for event_data column...');
    const { data, error } = await supabase.rpc('check_column_exists', { 
      table_name: 'analytics_events',
      column_name: 'event_data'
    });
    
    if (error) {
      console.log('RPC function not found, trying a direct insert to refresh cache');
      
      // Try a simple insert to force schema refresh
      const { error: insertError } = await supabase
        .from('analytics_events')
        .insert({
          event_type: 'cache_refresh',
          event_data: { message: 'Refreshing schema cache' },
          timestamp: new Date().toISOString()
        });
        
      if (insertError) {
        console.error('Error inserting test event:', insertError.message);
        
        if (insertError.message.includes('does not exist')) {
          console.log('Creating check_column_exists function...');
          
          // Create the function if it doesn't exist
          const { error: createFnError } = await supabase.rpc('create_check_column_function');
          
          if (createFnError) {
            console.error('Error creating function:', createFnError.message);
          }
        }
      } else {
        console.log('Successfully inserted test event, schema cache should be refreshed');
      }
    } else {
      console.log('Column check result:', data);
    }
    
    console.log('Schema cache refresh complete!');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the refresh
refreshSchemaCache()
  .then(() => {
    console.log('Schema cache refresh operation completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error in schema cache refresh:', err);
    process.exit(1);
  }); 
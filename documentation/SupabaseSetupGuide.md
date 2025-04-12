# Supabase Setup Guide

This guide will walk you through setting up Supabase for the Sales Knowledge Assistant project.

## Prerequisites

1. A Supabase account (sign up at [https://supabase.com](https://supabase.com) if you don't have one)
2. Access to the Supabase dashboard

## Step 1: Create a Supabase Project

1. Log in to the [Supabase dashboard](https://app.supabase.com)
2. Click "New Project"
3. Fill in the following details:
   - Name: `sales-knowledge-assistant` (or your preferred name)
   - Database Password: Create a strong password
   - Region: Choose the region closest to your users
4. Click "Create New Project"
5. Wait for your project to be provisioned (this may take a few minutes)

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to "Settings" > "API"
2. Copy the following values:
   - Project URL (under "Project URL")
   - anon/public key (under "Project API keys")
   - service_role key (under "Project API keys") - keep this secure!

3. Add these values to your `.env` file:
   ```
   SUPABASE_URL=your_project_url
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_KEY=your_service_role_key
   USE_SUPABASE=true
   ```

## Step 3: Set Up the Database Schema

1. Go to the "SQL Editor" in your Supabase dashboard
2. Create a new query

### Step 3.1: Create the exec_sql Function

1. Copy the contents of `scripts/create_exec_sql.sql` and paste it into the SQL Editor
2. Run the query to create the `exec_sql` function
3. This function will allow you to execute SQL commands programmatically

### Step 3.2: Set Up the Database Schema

1. Copy the contents of `scripts/setup_supabase_schema.sql` and paste it into the SQL Editor
2. Run the query to create all required tables, indexes, and functions
3. Verify that all tables were created successfully by checking the "Table Editor"

## Step 4: Initialize the Storage

1. Navigate to "Storage" in your Supabase dashboard
2. Create a new bucket named "documents" 
3. Set the privacy level to "Private" (not public)

## Step 5: Test Your Setup

1. Run the migration script to test your connection:
   ```bash
   node scripts/migrateToSupabase.js
   ```

2. If successful, you should see data being migrated to your Supabase database

## Step 6: Update Your Application

1. Ensure `USE_SUPABASE=true` is set in your `.env` file
2. Restart your application to start using Supabase for data storage

## Troubleshooting

- If you encounter permission errors, make sure you're using the correct service role key
- If tables aren't being created, check the SQL query for syntax errors
- For any other issues, refer to the [Supabase documentation](https://supabase.com/docs) 
#!/bin/bash

# Extract Supabase credentials from .env file
SUPABASE_URL=$(grep SUPABASE_URL .env | cut -d '=' -f2 | tr -d '\n')
SUPABASE_ANON_KEY=$(grep SUPABASE_ANON_KEY .env | cut -d '=' -f2 | tr -d '\n')

echo "Using Supabase URL: $SUPABASE_URL"
echo "Using Supabase Anon Key: ${SUPABASE_ANON_KEY:0:10}... (truncated for security)"

echo "Testing direct query to document_chunks table for 'workstream'..."
curl -s -X GET "$SUPABASE_URL/rest/v1/document_chunks?select=id,document_id,text&text=ilike.*workstream*&limit=5" \
-H "apikey: $SUPABASE_ANON_KEY" \
-H "Authorization: Bearer $SUPABASE_ANON_KEY" | jq . 
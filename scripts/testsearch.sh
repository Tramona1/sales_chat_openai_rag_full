#!/bin/bash

# Extract Supabase credentials from .env file
SUPABASE_URL=$(grep SUPABASE_URL .env | cut -d '=' -f2 | tr -d '\n')
SUPABASE_ANON_KEY=$(grep SUPABASE_ANON_KEY .env | cut -d '=' -f2 | tr -d '\n')
SUPABASE_SERVICE_KEY=$(grep SUPABASE_SERVICE_KEY .env | cut -d '=' -f2 | tr -d '\n')

echo "Using Supabase URL: $SUPABASE_URL"
echo "Using Supabase Anon Key: ${SUPABASE_ANON_KEY:0:10}... (truncated for security)"

# Create a condensed vector embedding (768 zeros for testing)
ZEROS_EMBEDDING=$(printf '%s' '['; for i in {1..767}; do printf '0,'; done; printf '0]')
echo "Created zero embedding vector for testing..."

# Set output file for results
OUTPUT_FILE="test_results.json"
ERROR_FILE="test_errors.json"
echo "Results will be saved to $OUTPUT_FILE"
echo "" > $OUTPUT_FILE  # Clear the file
echo "" > $ERROR_FILE   # Clear the error file

# Function to check for error response
check_error() {
  if grep -q '"code":' "$OUTPUT_FILE"; then
    echo "ERROR: API returned an error response:"
    cat "$OUTPUT_FILE"
    cp "$OUTPUT_FILE" "$ERROR_FILE"
    return 1
  fi
  return 0
}

# Function to count results efficiently
count_results() {
  # Use jq if available for more reliable JSON parsing
  if command -v jq &> /dev/null; then
    RESULT_COUNT=$(jq 'length' "$OUTPUT_FILE" 2>/dev/null || echo 0)
  else
    RESULT_COUNT=$(grep -o '"id":' "$OUTPUT_FILE" | wc -l)
  fi
  echo "$RESULT_COUNT"
}

# Try using service key instead
USE_SERVICE_KEY=false

echo "==================================================="
echo "TEST 1: Basic query with NO filters"
echo "==================================================="
echo "Running query 'workstream' with no filters..."

# Choose which key to use
AUTH_KEY=$SUPABASE_ANON_KEY
if [ "$USE_SERVICE_KEY" = true ]; then
  AUTH_KEY=$SUPABASE_SERVICE_KEY
  echo "Using service key for authentication"
fi

# Make the API call with detailed error handling
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/hybrid_search" \
-H "Content-Type: application/json" \
-H "apikey: $AUTH_KEY" \
-H "Authorization: Bearer $AUTH_KEY" \
-d '{
  "query_text": "workstream",
  "query_embedding": '"${ZEROS_EMBEDDING}"',
  "match_count": 5,
  "match_threshold": 0.1,
  "vector_weight": 0.1,
  "keyword_weight": 0.9,
  "filter": {}
}' > $OUTPUT_FILE

# Check for errors
if check_error; then
  # Display count of results
  RESULT_COUNT=$(count_results)
  echo "Query returned $RESULT_COUNT results"
  
  # Show first result if available
  if [ "$RESULT_COUNT" -gt 0 ] && command -v jq &> /dev/null; then
    echo "First result:"
    jq '.[0]' "$OUTPUT_FILE"
  fi
else
  echo "Failed to get results for Test 1 - check $ERROR_FILE for details"
fi
echo ""

echo "==================================================="
echo "TEST 2: Query with 'GENERAL' category filter"
echo "==================================================="
echo "Running query 'workstream' with primaryCategory=GENERAL filter..."
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/hybrid_search" \
-H "Content-Type: application/json" \
-H "apikey: $AUTH_KEY" \
-H "Authorization: Bearer $AUTH_KEY" \
-d '{
  "query_text": "workstream",
  "query_embedding": '"${ZEROS_EMBEDDING}"',
  "match_count": 5,
  "match_threshold": 0.1,
  "vector_weight": 0.1,
  "keyword_weight": 0.9,
  "filter": {"primaryCategory": "GENERAL"}
}' > $OUTPUT_FILE

# Check for errors
if check_error; then
  # Display count of results
  RESULT_COUNT=$(count_results)
  echo "Query with GENERAL category returned $RESULT_COUNT results"
else
  echo "Failed to get results for Test 2 - check $ERROR_FILE for details"
fi
echo ""

echo "==================================================="
echo "TEST 3: Query with 'HIRING' category filter"
echo "==================================================="
echo "Running query 'workstream' with primaryCategory=HIRING filter..."
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/hybrid_search" \
-H "Content-Type: application/json" \
-H "apikey: $AUTH_KEY" \
-H "Authorization: Bearer $AUTH_KEY" \
-d '{
  "query_text": "workstream",
  "query_embedding": '"${ZEROS_EMBEDDING}"',
  "match_count": 5,
  "match_threshold": 0.1,
  "vector_weight": 0.1,
  "keyword_weight": 0.9,
  "filter": {"primaryCategory": "HIRING"}
}' > $OUTPUT_FILE

# Check for errors
if check_error; then
  # Display count of results
  RESULT_COUNT=$(count_results)
  echo "Query with HIRING category returned $RESULT_COUNT results"
else
  echo "Failed to get results for Test 3 - check $ERROR_FILE for details"
fi
echo ""

echo "==================================================="
echo "TEST 4: Query with technical level filter (1-3)"
echo "==================================================="
echo "Running query 'workstream' with technicalLevel filter..."
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/hybrid_search" \
-H "Content-Type: application/json" \
-H "apikey: $AUTH_KEY" \
-H "Authorization: Bearer $AUTH_KEY" \
-d '{
  "query_text": "workstream",
  "query_embedding": '"${ZEROS_EMBEDDING}"',
  "match_count": 5,
  "match_threshold": 0.1,
  "vector_weight": 0.1,
  "keyword_weight": 0.9,
  "filter": {"technicalLevelMin": 1, "technicalLevelMax": 3}
}' > $OUTPUT_FILE

# Check for errors
if check_error; then
  # Display count of results
  RESULT_COUNT=$(count_results)
  echo "Query with technical level filter returned $RESULT_COUNT results"
else
  echo "Failed to get results for Test 4 - check $ERROR_FILE for details"
fi
echo ""

echo "==================================================="
echo "TEST 5: Query with custom document_id filter"
echo "==================================================="
# Extract a document ID from the first test result
SAMPLE_DOC_ID=$(jq -r '.[0].document_id' "$OUTPUT_FILE" 2>/dev/null)
if [ -z "$SAMPLE_DOC_ID" ] || [ "$SAMPLE_DOC_ID" = "null" ]; then
  echo "No document ID found in previous results. Using placeholder."
  SAMPLE_DOC_ID="placeholder-id"
fi
echo "Testing with document_id: $SAMPLE_DOC_ID"

curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/hybrid_search" \
-H "Content-Type: application/json" \
-H "apikey: $AUTH_KEY" \
-H "Authorization: Bearer $AUTH_KEY" \
-d '{
  "query_text": "workstream",
  "query_embedding": '"${ZEROS_EMBEDDING}"',
  "match_count": 5,
  "match_threshold": 0.1,
  "vector_weight": 0.1,
  "keyword_weight": 0.9,
  "filter": {"customFilters": {"document_id": "'"$SAMPLE_DOC_ID"'"}}
}' > $OUTPUT_FILE

# Check for errors
if check_error; then
  # Display count of results
  RESULT_COUNT=$(count_results)
  echo "Query with document_id filter returned $RESULT_COUNT results"
else
  echo "Failed to get results for Test 5 - check $ERROR_FILE for details"
fi
echo ""

echo "==================================================="
echo "TEST 6: Original structure with categories nested array"
echo "==================================================="
echo "Testing original filter structure to compare..."
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/hybrid_search" \
-H "Content-Type: application/json" \
-H "apikey: $AUTH_KEY" \
-H "Authorization: Bearer $AUTH_KEY" \
-d '{
  "query_text": "workstream",
  "query_embedding": '"${ZEROS_EMBEDDING}"',
  "match_count": 5,
  "match_threshold": 0.1,
  "vector_weight": 0.1,
  "keyword_weight": 0.9,
  "filter": {"categories": [{"name": "GENERAL", "type": "primary"}]}
}' > $OUTPUT_FILE

# Check for errors
if check_error; then
  # Display count of results
  RESULT_COUNT=$(count_results)
  echo "Query with original nested categories structure returned $RESULT_COUNT results"
else
  echo "Failed to get results for Test 6 - check $ERROR_FILE for details"
fi
echo ""

echo "==================================================="
echo "Testing complete. Detailed results saved to $OUTPUT_FILE"
echo "==================================================="
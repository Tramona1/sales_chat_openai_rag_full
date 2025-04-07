# Workstream Crawl Data Processing Guide

This document explains how to use the crawl data processing script to ingest the large workstream crawl dataset into our enhanced RAG system with metadata extraction.

## Overview

The `process_crawl_data.ts` script processes web crawler output data, extracting metadata, generating embeddings, and storing the results in the vector database. This script is designed to handle large datasets efficiently through stream processing and batching.

## Features

- **Stream Processing**: Processes large files line by line to manage memory usage
- **Batch Processing**: Processes documents in configurable batches to optimize API usage
- **Progress Tracking**: Maintains a state file for resumability in case of interruptions
- **Error Handling**: Logs errors for failed documents without stopping the process
- **Backup & Safety**: Automatically backs up existing vector store data before processing
- **Gemini AI Integration**: Uses Google AI for cost-effective metadata extraction
- **Automatic Fallback**: Uses OpenAI for maximum reliability

## Prerequisites

1. Workstream crawl data file in JSON format (one JSON object per line)
2. Node.js and npm/yarn installed
3. OpenAI API key configured in your `.env` file
4. Google AI API key configured in your `.env` file for Gemini (optional but recommended)

## Usage

### Basic Usage

```bash
npm run process:crawl-data
```

This will process the crawl data file at the default location (`data/workstream_crawl_data.json`).

### Specifying a Custom File Path

```bash
npm run process:crawl-data -- /path/to/your/workstream_crawl_data.json
```

### Advanced Usage Options

```bash
# Skip already processed documents (resume processing)
npm run process:crawl-data -- --skip-processed

# Process without clearing existing data
npm run process:crawl-data -- --no-clear

# Specify batch size (default is 5)
npm run process:crawl-data -- --batch-size=10

# Combine options
npm run process:crawl-data -- data/custom_crawl.json --skip-processed --batch-size=10
```

### Configuration

You can modify the configuration in the script:

```typescript
const CONFIG = {
  // Path to the crawl data file
  crawlDataPath: process.argv[2] || path.join(process.cwd(), 'data/workstream_crawl_data.json'),
  
  // Output directory for processed data
  outputDir: path.join(process.cwd(), 'data/processed'),
  
  // Backup directory for the current vector store (if it exists)
  backupDir: path.join(process.cwd(), 'data/backups', new Date().toISOString().replace(/:/g, '-')),
  
  // Number of documents to process in each batch
  batchSize: 10,
  
  // Whether to clear the existing vector store
  clearExistingData: true,
  
  // Whether to skip documents that have already been processed
  skipProcessed: true,
  
  // State file to track progress (for resumability)
  stateFile: path.join(process.cwd(), 'data/process_state.json'),
  
  // Error log file
  errorLogFile: path.join(process.cwd(), 'data/processing_errors.json')
};
```

## Expected Crawl Data Format

Each line in the crawl data file should contain a valid JSON object with the following structure:

```json
{
  "url": "https://example.com/page",
  "title": "Page Title",
  "content": "The full text content of the page...",
  "timestamp": "2023-04-06T12:34:56Z"
}
```

### Troubleshooting JSON Parsing Errors

If you are encountering JSON parsing errors like the following:
```
Error parsing document: SyntaxError: Unexpected token : in JSON at position 15
```

These errors typically occur when:

1. **Invalid JSON Format**: Each line must contain a complete, valid JSON object.
2. **Newlines in JSON Content**: The content field may contain newlines that break the line-by-line processing.
3. **Special Characters**: The JSON may contain unescaped special characters.

#### Resolution Steps:

1. **Validate Your Crawl Data**:
   Run your crawl data file through a JSON validator. You can use a tool like `jq`:
   ```bash
   cat your_crawl_data.json | jq -c '.url' > /dev/null
   ```

2. **Fix Common Issues**:
   - Ensure each JSON object is on a single line
   - Properly escape special characters in JSON strings
   - Remove any control characters or invalid UTF-8 sequences

3. **Data Preprocessing Script**:
   We've added a preprocessing script to help fix common JSON issues:
   ```bash
   npm run preprocess:crawl-data -- your_crawl_data.json
   ```
   This will create a fixed version at `your_crawl_data.fixed.json`

4. **Manual JSON Fix Options**:
   For individual corrupt lines, you can identify and fix them with:
   ```bash
   # Find the problematic line number
   grep -n "problem text" your_crawl_data.json
   
   # Extract the line for inspection
   sed -n '123p' your_crawl_data.json > line_to_fix.json
   
   # After fixing, replace the line
   sed -i '123s/.*/.../g' your_crawl_data.json
   ```

## Monitoring Progress

The script outputs detailed progress information:

```
Starting crawl data processing: data/crawl_data.json
Total documents to process: 1250
Already processed: 0
Processing batch 1 of 5 documents...
Extracting metadata for https://example.com/page1
Extracting metadata for https://example.com/page2
...
Progress: 2.4% (30/1250)
```

## Handling Interruptions

If the process is interrupted, you can resume by running:

```bash
npm run process:crawl-data -- --skip-processed
```

The script keeps track of processed documents and will continue from where it left off.

## Error Handling

Processing errors are logged to `logs/processing_errors.log` with detailed error information and document IDs. Failed documents can be reprocessed later by:

1. Extracting failed document IDs from the log
2. Creating a new crawl data file with just those documents
3. Running the process again with that file

## After Processing

Once processing is complete:

1. Documents will be stored in the vector database
2. Embeddings will be generated for each document
3. BM25 corpus statistics will be calculated for hybrid search
4. A processing summary will be displayed

## Performance Considerations

- **API Rate Limits**: The script respects API rate limits through batching
- **Memory Usage**: Stream processing ensures low memory footprint
- **Processing Time**: Expect 3-5 seconds per document on average
- **Cost**: Using Gemini significantly reduces API costs (see docs/gemini_integration.md)

## Troubleshooting

### Common Issues

1. **Out of Memory**: Decrease batch size in CONFIG
2. **API Rate Limits**: Add delay between batches or decrease batch size
3. **Malformed JSON**: Check error log for specific line numbers with parsing issues

### Logs

- Processing state: `data/process_state.json`
- Error log: `data/processing_errors.json`
- Vector store backup: `data/backups/{timestamp}/`

### Additional Tips

- **Missing API Keys**: Ensure OpenAI and/or Google AI API keys are set in .env
- **Memory Issues**: Reduce batch size with --batch-size option
- **Network Errors**: Script will retry API calls with exponential backoff
- **JSON Parsing Errors**: Verify crawl data format matches the expected structure and follow the JSON fixing steps in the section above

## After Processing

Once processing is complete:

1. The vector store will contain all processed documents with enhanced metadata
2. BM25 corpus statistics will be regenerated
3. The system is ready to use Smart Ingestion + Query Routing 
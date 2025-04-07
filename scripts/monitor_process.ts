/**
 * Process Monitor Script
 * 
 * This script monitors the progress of the crawl data processing.
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  // State file to monitor
  stateFile: path.join(process.cwd(), 'data/process_state.json'),
  
  // How often to check the state file (in ms)
  checkInterval: 5000,
  
  // How long to run the monitor (in ms, 0 for indefinite)
  duration: 0
};

// Function to read and display the current processing state
async function displayProcessingState(): Promise<void> {
  try {
    if (!fs.existsSync(CONFIG.stateFile)) {
      console.log('No state file found. Processing may not have started yet.');
      return;
    }
    
    const stateData = await fs.promises.readFile(CONFIG.stateFile, 'utf-8');
    const state = JSON.parse(stateData);
    
    // Clear the console
    console.clear();
    
    // Print the current state
    console.log('=== CRAWL DATA PROCESSING MONITOR ===');
    console.log(`Total documents: ${state.totalDocuments}`);
    console.log(`Processed documents: ${state.processedDocuments}`);
    console.log(`Failed documents: ${state.failedDocuments}`);
    console.log(`Progress: ${((state.processedDocuments / state.totalDocuments) * 100).toFixed(2)}%`);
    console.log(`Last processed: ${state.lastProcessedId}`);
    console.log(`Start time: ${new Date(state.startTime).toLocaleString()}`);
    console.log(`Last update: ${new Date(state.lastUpdateTime).toLocaleString()}`);
    console.log(`Running for: ${formatDuration(new Date(state.startTime), new Date(state.lastUpdateTime))}`);
    console.log('\nPress Ctrl+C to stop monitoring');
  } catch (error) {
    console.error('Error reading state file:', error);
  }
}

// Format the duration between two dates
function formatDuration(start: Date, end: Date): string {
  const durationMs = end.getTime() - start.getTime();
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
}

// Start the monitoring process
async function startMonitoring(): Promise<void> {
  console.log('Starting process monitoring...');
  
  // Display the initial state
  await displayProcessingState();
  
  // Set up the interval to periodically check the state
  const intervalId = setInterval(displayProcessingState, CONFIG.checkInterval);
  
  // If a duration is specified, stop after that time
  if (CONFIG.duration > 0) {
    setTimeout(() => {
      clearInterval(intervalId);
      console.log('Monitoring stopped after specified duration.');
    }, CONFIG.duration);
  }
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(intervalId);
    console.log('\nMonitoring stopped.');
    process.exit(0);
  });
}

// Run the monitoring if this script is executed directly
if (require.main === module) {
  startMonitoring()
    .catch(error => {
      console.error('Error running monitor:', error);
      process.exit(1);
    });
}

export { startMonitoring }; 
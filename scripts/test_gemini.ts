/**
 * Test script for Gemini API integration
 * 
 * This script tests the Gemini API integration by extracting metadata
 * from a sample document and comparing it with GPT-4 extraction.
 */

import { extractMetadata } from '../utils/metadataExtractor';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Sample document to test metadata extraction
const SAMPLE_DOCUMENT = `
SalesBuddy AI is available in three pricing tiers: Starter ($499/month for up to 10 users), 
Professional ($999/month for up to 25 users), and Enterprise ($2,499/month for unlimited users). 
The Professional plan includes all Starter features plus custom training and CRM integration. 
The Enterprise plan adds advanced analytics and dedicated support. 
Annual billing offers a 20% discount on all plans.
`;

// Main test function
async function testGeminiMetadataExtraction() {
  console.log('Testing Gemini metadata extraction...');
  console.time('Gemini extraction');
  
  try {
    // Extract metadata using Gemini
    const geminiMetadata = await extractMetadata(
      SAMPLE_DOCUMENT, 
      'test-document',
      { model: 'gemini', useCaching: false }
    );
    
    console.timeEnd('Gemini extraction');
    console.log('\nGemini Metadata Result:');
    console.log('------------------------');
    console.log('Primary Category:', geminiMetadata.primaryCategory);
    console.log('Technical Level:', geminiMetadata.technicalLevel);
    console.log('Summary:', geminiMetadata.summary);
    console.log('Keywords:', geminiMetadata.keywords.join(', '));
    console.log('Entities:', geminiMetadata.entities.map(e => `${e.name} (${e.type})`).join(', '));
    
    // For comparison, also extract with OpenAI GPT
    console.log('\nFor comparison, extracting with OpenAI GPT...');
    console.time('OpenAI extraction');
    
    const openaiMetadata = await extractMetadata(
      SAMPLE_DOCUMENT, 
      'test-document',
      { model: 'gpt-3.5-turbo-1106', useCaching: false }
    );
    
    console.timeEnd('OpenAI extraction');
    console.log('\nOpenAI Metadata Result:');
    console.log('------------------------');
    console.log('Primary Category:', openaiMetadata.primaryCategory);
    console.log('Technical Level:', openaiMetadata.technicalLevel);
    console.log('Summary:', openaiMetadata.summary);
    console.log('Keywords:', openaiMetadata.keywords.join(', '));
    console.log('Entities:', openaiMetadata.entities.map(e => `${e.name} (${e.type})`).join(', '));
    
  } catch (error) {
    console.error('Error testing Gemini metadata extraction:', error);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testGeminiMetadataExtraction()
    .then(() => console.log('\nTest completed'))
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testGeminiMetadataExtraction }; 
// Test script for Gemini API key
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Setup dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from both .env and .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Get API key from environment
const apiKey = process.env.GOOGLE_AI_API_KEY;
console.log('Using API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'Not found');

// Function to test text generation
async function testGeminiGeneration() {
  try {
    console.log('Initializing Google AI with API key...');
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // List available models
    console.log('Testing model access...');
    
    // Generate content
    console.log('Testing content generation with gemini-pro...');
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const result = await model.generateContent("Write a one sentence test response.");
    const response = await result.response;
    const text = response.text();
    
    console.log('Generation successful!');
    console.log('Response:', text);
    return true;
  } catch (error) {
    console.error('Error testing Gemini generation:');
    console.error(error);
    return false;
  }
}

// Function to test embeddings
async function testGeminiEmbeddings() {
  try {
    console.log('\nTesting embeddings with text-embedding-004...');
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    
    const result = await model.embedContent("This is a test sentence for embeddings.");
    const embedding = result.embedding.values;
    
    console.log('Embedding successful!');
    console.log(`Embedding dimensions: ${embedding.length}`);
    console.log('First 5 values:', embedding.slice(0, 5));
    return true;
  } catch (error) {
    console.error('Error testing Gemini embeddings:');
    console.error(error);
    return false;
  }
}

// Run tests
async function runTests() {
  console.log('=== GEMINI API KEY TESTING ===');
  
  const genResult = await testGeminiGeneration();
  const embedResult = await testGeminiEmbeddings();
  
  console.log('\n=== TEST RESULTS ===');
  console.log('Text Generation:', genResult ? '✅ PASSED' : '❌ FAILED');
  console.log('Embeddings:', embedResult ? '✅ PASSED' : '❌ FAILED');
  
  if (!genResult || !embedResult) {
    console.log('\n⚠️ At least one test failed. Ensure your API key is valid and has the necessary permissions.');
  } else {
    console.log('\n🎉 All tests passed! Your Gemini API key is working correctly.');
  }
}

runTests().catch(console.error); 
// Test script for chat functionality
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';

// Setup dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Configuration
const SERVER_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-production-url.com' 
  : 'http://localhost:3000';

console.log(`Testing against server: ${SERVER_URL}`);

// Helper function for API calls
async function callApi(endpoint, data) {
  try {
    const response = await fetch(`${SERVER_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    return await response.json();
  } catch (error) {
    console.error(`API call failed to ${endpoint}:`, error);
    return { error: error.message, success: false };
  }
}

// Test cases
async function testBasicChatQuery() {
  console.log('\n🧪 Testing basic chat query...');
  
  const testQuery = 'What is sales enablement?';
  const result = await callApi('/api/chat', {
    message: testQuery,
    previousMessages: []
  });
  
  if (!result.response) {
    console.error('❌ Basic chat test failed: No response received');
    return { success: false, error: 'No response' };
  }
  
  console.log(`✅ Received response (${result.response.length} chars)`);
  return { 
    success: true, 
    details: { 
      responseLength: result.response.length,
      usedContext: !!result.usedContext,
      executionTimeMs: result.executionTimeMs || 'N/A'
    } 
  };
}

async function testConversationHistory() {
  console.log('\n🧪 Testing conversation history...');
  
  const previousMessages = [
    { role: 'user', content: 'What is sales enablement?' },
    { role: 'assistant', content: 'Sales enablement is the process of providing sales teams with the resources they need to sell more effectively.' }
  ];
  
  const testQuery = 'Can you elaborate on that?';
  const result = await callApi('/api/chat', {
    message: testQuery,
    previousMessages
  });
  
  if (!result.response) {
    console.error('❌ Conversation history test failed: No response received');
    return { success: false, error: 'No response' };
  }
  
  console.log(`✅ Received follow-up response (${result.response.length} chars)`);
  return { 
    success: true, 
    details: { 
      responseLength: result.response.length,
      usedContext: !!result.usedContext,
      executionTimeMs: result.executionTimeMs || 'N/A'
    } 
  };
}

async function testEmptyQuery() {
  console.log('\n🧪 Testing empty query handling...');
  
  const result = await callApi('/api/chat', {
    message: '',
    previousMessages: []
  });
  
  if (result.error) {
    console.log('✅ Empty query correctly resulted in an error response');
    return { success: true, details: { error: result.error } };
  } else {
    console.error('❌ Empty query test failed: Should have received an error');
    return { success: false, error: 'No error for empty query' };
  }
}

async function testCompanyQuery() {
  console.log('\n🧪 Testing company-specific query...');
  
  const testQuery = 'Tell me about Microsoft sales strategies';
  const result = await callApi('/api/chat', {
    message: testQuery,
    previousMessages: [],
    companyContext: {
      companyName: 'Microsoft',
      companyInfo: 'Microsoft Corporation is an American multinational technology company.'
    }
  });
  
  if (!result.response) {
    console.error('❌ Company query test failed: No response received');
    return { success: false, error: 'No response' };
  }
  
  const companyMentioned = result.response.toLowerCase().includes('microsoft');
  console.log(`✅ Received company-specific response (${result.response.length} chars)`);
  console.log(`   Company mentioned in response: ${companyMentioned ? 'Yes' : 'No'}`);
  
  return { 
    success: true, 
    details: { 
      responseLength: result.response.length,
      companyMentioned,
      usedContext: !!result.usedContext,
      executionTimeMs: result.executionTimeMs || 'N/A'
    } 
  };
}

// Run all tests
async function runTests() {
  console.log('📋 Starting chat functionality tests...');
  
  const startTime = Date.now();
  const results = {
    basicChat: await testBasicChatQuery(),
    conversationHistory: await testConversationHistory(),
    emptyQuery: await testEmptyQuery(),
    companyQuery: await testCompanyQuery()
  };
  
  // Calculate results
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  
  console.log('\n📊 Test Results Summary:');
  console.log(`   Total tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests}`);
  console.log(`   Failed: ${failedTests}`);
  console.log(`   Time: ${(Date.now() - startTime) / 1000}s`);
  
  if (failedTests === 0) {
    console.log('\n✅ All tests passed! Chat functionality appears to be working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the detailed results above.');
  }
  
  return {
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests
    },
    details: results
  };
}

// Run the tests when directly invoked
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runTests().catch(error => {
    console.error('Error running tests:', error);
    process.exit(1);
  });
}

// Export for use in other scripts
export {
  testBasicChatQuery,
  testConversationHistory,
  testEmptyQuery,
  testCompanyQuery,
  runTests
}; 
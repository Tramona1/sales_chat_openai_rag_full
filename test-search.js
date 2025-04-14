// Simple script to test the query API directly
import fetch from 'node-fetch';

async function testSearch(query) {
  try {
    console.log(`Testing search with query: "${query}"`);
    
    const response = await fetch('http://localhost:3001/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 5,
        useContextualRetrieval: true,
        searchMode: 'hybrid'
      }),
    });

    const data = await response.json();
    
    console.log('\nAPI Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.log('\nSearch failed with error:', data.error);
    } else {
      console.log('\nSearch succeeded!');
      if (data.answer) {
        console.log('\nAnswer:', data.answer);
      }
    }
  } catch (error) {
    console.error('Error making API request:', error);
  }
}

// Test with a simple query
const query = process.argv[2] || 'What is Workstream';
testSearch(query); 
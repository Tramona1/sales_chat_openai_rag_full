/**
 * Simple Test File for MetadataUtils
 * 
 * This file contains both the implementation and test for metadata utilities
 * to avoid import resolution issues.
 */

// EntityType and ConfidenceLevel (simplified versions of the enums)
const EntityType = {
  PERSON: 'person',
  ORGANIZATION: 'organization',
  PRODUCT: 'product',
  FEATURE: 'feature',
  PRICE: 'price',
  DATE: 'date',
  LOCATION: 'location'
};

const ConfidenceLevel = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNCERTAIN: 'uncertain'
};

/**
 * Parse entities from a vector store item's metadata
 * Handles both string and object representations
 * 
 * @param entities The entities value from metadata.entities (could be string or object)
 * @returns Parsed array of ExtractedEntity objects, or empty array if invalid
 */
function parseEntities(entities) {
  try {
    // If it's undefined or null, return empty array
    if (!entities) {
      return [];
    }
    
    // If it's already an array, return it
    if (Array.isArray(entities)) {
      return entities;
    }
    
    // If it's a string, try to parse it as JSON
    if (typeof entities === 'string') {
      try {
        const parsed = JSON.parse(entities);
        if (Array.isArray(parsed)) {
          return parsed;
        } else {
          // If parsed but not an array, it might be an older format
          // with nested properties like { people: [], companies: [] }
          const extractedEntities = [];
          
          // Handle older format with categorized entities
          if (parsed.people && Array.isArray(parsed.people)) {
            parsed.people.forEach((person) => {
              if (typeof person === 'string') {
                extractedEntities.push({
                  name: person,
                  type: EntityType.PERSON,
                  confidence: ConfidenceLevel.MEDIUM,
                  mentions: 1
                });
              } else if (person && typeof person === 'object' && person.name) {
                extractedEntities.push({
                  name: person.name,
                  type: EntityType.PERSON,
                  confidence: person.confidence || ConfidenceLevel.MEDIUM,
                  mentions: person.mentions || 1
                });
              }
            });
          }
          
          if (parsed.companies && Array.isArray(parsed.companies)) {
            parsed.companies.forEach((company) => {
              if (typeof company === 'string') {
                extractedEntities.push({
                  name: company,
                  type: EntityType.ORGANIZATION,
                  confidence: ConfidenceLevel.MEDIUM,
                  mentions: 1
                });
              } else if (company && typeof company === 'object' && company.name) {
                extractedEntities.push({
                  name: company.name,
                  type: EntityType.ORGANIZATION,
                  confidence: company.confidence || ConfidenceLevel.MEDIUM,
                  mentions: company.mentions || 1
                });
              }
            });
          }
          
          if (parsed.products && Array.isArray(parsed.products)) {
            parsed.products.forEach((product) => {
              if (typeof product === 'string') {
                extractedEntities.push({
                  name: product,
                  type: EntityType.PRODUCT,
                  confidence: ConfidenceLevel.MEDIUM,
                  mentions: 1
                });
              } else if (product && typeof product === 'object' && product.name) {
                extractedEntities.push({
                  name: product.name,
                  type: EntityType.PRODUCT,
                  confidence: product.confidence || ConfidenceLevel.MEDIUM,
                  mentions: product.mentions || 1
                });
              }
            });
          }
          
          return extractedEntities;
        }
      } catch (e) {
        console.error('Error parsing entities string:', e);
        return [];
      }
    }
    
    // If we get here, the format is unknown
    console.warn('Unknown entity format:', entities);
    return [];
  } catch (error) {
    console.error('Failed to parse entities:', error);
    return [];
  }
}

/**
 * Serialize entities to a consistent format for storage
 * 
 * @param entities Array of ExtractedEntity objects
 * @returns JSON string representation of entities
 */
function serializeEntities(entities) {
  if (!entities || entities.length === 0) {
    return undefined;
  }
  
  try {
    return JSON.stringify(entities);
  } catch (error) {
    console.error('Failed to serialize entities:', error);
    return undefined;
  }
}

/**
 * Get a count of entity types from an array of entities
 * 
 * @param entities Array of ExtractedEntity objects
 * @returns Record with counts by entity type
 */
function getEntityTypeCounts(entities) {
  const counts = {};
  
  if (!entities || entities.length === 0) {
    return counts;
  }
  
  entities.forEach(entity => {
    const type = entity.type || 'UNKNOWN';
    counts[type] = (counts[type] || 0) + 1;
  });
  
  return counts;
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Test cases
const testCases = [
  // Case 1: Regular array of entity objects
  {
    name: 'Regular array of entities',
    input: [
      {
        name: 'John Smith',
        type: EntityType.PERSON,
        confidence: ConfidenceLevel.HIGH,
        mentions: 3
      },
      {
        name: 'Acme Corp',
        type: EntityType.ORGANIZATION,
        confidence: ConfidenceLevel.MEDIUM,
        mentions: 2
      }
    ]
  },
  
  // Case 2: Legacy format with categories
  {
    name: 'Legacy format with categories',
    input: {
      people: ['John Smith', 'Jane Doe'],
      companies: ['Acme Corp', 'Widget Inc'],
      products: ['SuperWidget']
    }
  },
  
  // Case 3: Empty input
  {
    name: 'Empty input',
    input: []
  },
  
  // Case 4: String JSON input (serialized array)
  {
    name: 'Serialized array',
    input: JSON.stringify([
      {
        name: 'John Smith',
        type: EntityType.PERSON,
        confidence: ConfidenceLevel.HIGH,
        mentions: 3
      }
    ])
  },
  
  // Case 5: String JSON input (serialized object)
  {
    name: 'Serialized object',
    input: JSON.stringify({
      people: ['John Smith'],
      companies: ['Acme Corp']
    })
  }
];

/**
 * Run the entity handling tests
 */
function runTests() {
  console.log(`${colors.bright}ENTITY HANDLING TESTS${colors.reset}\n`);
  
  for (const testCase of testCases) {
    console.log(`${colors.blue}Testing: ${testCase.name}${colors.reset}`);
    console.log(`Input: ${colors.dim}${JSON.stringify(testCase.input).substring(0, 100)}${colors.reset}`);
    
    // Test serialization
    let serialized;
    try {
      if (Array.isArray(testCase.input) || typeof testCase.input === 'string') {
        serialized = serializeEntities(
          Array.isArray(testCase.input) ? testCase.input : parseEntities(testCase.input)
        );
      } else {
        serialized = serializeEntities(parseEntities(testCase.input));
      }
      console.log(`Serialized: ${colors.dim}${serialized?.substring(0, 100)}${colors.reset}`);
    } catch (error) {
      console.log(`${colors.red}Serialization Error: ${error.message}${colors.reset}`);
    }
    
    // Test parsing
    try {
      const parsed = parseEntities(testCase.input);
      console.log(`Parsed: ${colors.dim}${JSON.stringify(parsed).substring(0, 100)}${colors.reset}`);
      console.log(`Count: ${parsed.length} entities`);
      
      // Test type counts
      const counts = getEntityTypeCounts(parsed);
      console.log(`Type counts: ${colors.dim}${JSON.stringify(counts)}${colors.reset}`);
    } catch (error) {
      console.log(`${colors.red}Parsing Error: ${error.message}${colors.reset}`);
    }
    
    // Round-trip test (parse then serialize)
    try {
      const parsed = parseEntities(testCase.input);
      const reserialized = serializeEntities(parsed);
      console.log(`Round-trip: ${colors.dim}${reserialized?.substring(0, 100)}${colors.reset}`);
      
      // Validate that parsing the reserialized data gives the same result
      const reparsed = parseEntities(reserialized);
      const isEqual = JSON.stringify(parsed) === JSON.stringify(reparsed);
      if (isEqual) {
        console.log(`${colors.green}✓ Round-trip validation passed${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ Round-trip validation failed${colors.reset}`);
        console.log(`Original parsed: ${colors.dim}${JSON.stringify(parsed)}${colors.reset}`);
        console.log(`Reparsed: ${colors.dim}${JSON.stringify(reparsed)}${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.red}Round-trip Error: ${error.message}${colors.reset}`);
    }
    
    console.log(''); // Empty line between test cases
  }
  
  console.log(`${colors.green}All tests completed${colors.reset}`);
}

// Run the tests
runTests(); 
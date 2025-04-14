import React from 'react';
import SearchResultTracker from './enhanced-tracking/SearchResultTracker';
import { trackSearch } from '@/utils/analytics';
import { Tag } from '@/types/tags';

interface SearchResult {
  id: string;
  title: string;
  text: string;
  source?: string;
  score?: number;
  metadata?: Record<string, any>;
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  searchType: string;
  executionTimeMs?: number;
  sessionId?: string;
  userId?: string;
  highlightedTags?: string[];
  onResultClick?: (resultId: string, index: number) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  query,
  searchType,
  executionTimeMs,
  sessionId,
  userId,
  highlightedTags = [],
  onResultClick
}) => {
  
  // Track search event when results are displayed
  React.useEffect(() => {
    if (results.length > 0 || executionTimeMs) {
      trackSearch({
        user_id: userId,
        session_id: sessionId,
        query_text: query,
        search_type: searchType as any,
        result_count: results.length,
        execution_time_ms: executionTimeMs
      });
    }
  }, [results, query, searchType, executionTimeMs, sessionId, userId]);
  
  // Handle result click
  const handleResultClick = (resultId: string, index: number) => {
    if (onResultClick) {
      onResultClick(resultId, index);
    }
  };

  // Extract tags from a result's metadata
  const extractTags = (result: SearchResult): { 
    topics: string[]; 
    audience: string[]; 
    entities: string[];
    technicalLevel: string | null;
  } => {
    const metadata = result.metadata || {};
    
    // Get topics
    const topics: string[] = [];
    if (Array.isArray(metadata.tags)) {
      topics.push(...metadata.tags);
    }
    if (Array.isArray(metadata.primary_topics)) {
      topics.push(...metadata.primary_topics);
    }
    if (Array.isArray(metadata.topics)) {
      topics.push(...metadata.topics);
    }
    
    // Get audience
    const audience: string[] = [];
    if (Array.isArray(metadata.audience)) {
      audience.push(...metadata.audience);
    }
    if (Array.isArray(metadata.audience_type)) {
      audience.push(...metadata.audience_type);
    }
    
    // Get entities
    const entities: string[] = [];
    if (metadata.entities) {
      if (Array.isArray(metadata.entities)) {
        entities.push(...metadata.entities);
      } else if (typeof metadata.entities === 'object') {
        // Handle the entity_0, entity_1 format
        Object.values(metadata.entities).forEach(value => {
          if (typeof value === 'string') {
            entities.push(value);
          }
        });
      }
    }
    
    // Get technical level
    let technicalLevel: string | null = null;
    const level = metadata.technical_level;
    if (typeof level === 'number') {
      switch (level) {
        case 1:
          technicalLevel = 'Beginner';
          break;
        case 2:
          technicalLevel = 'Intermediate';
          break;
        case 3:
          technicalLevel = 'Advanced';
          break;
        default:
          technicalLevel = `Level ${level}`;
      }
    }
    
    return { 
      topics: [...new Set(topics)], 
      audience: [...new Set(audience)], 
      entities: [...new Set(entities)],
      technicalLevel
    };
  };
  
  if (results.length === 0) {
    return (
      <div className="p-4 my-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600 text-center">No results found for your search.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4 my-4">
      <p className="text-sm text-gray-600">
        {results.length} results found ({executionTimeMs ? `${executionTimeMs}ms` : 'unknown time'})
      </p>
      
      {results.map((result, index) => {
        // Extract tags for this result
        const { topics, audience, entities, technicalLevel } = extractTags(result);
        
        return (
          <SearchResultTracker
            key={result.id}
            resultId={result.id}
            query={query}
            index={index}
            sessionId={sessionId}
            userId={userId}
          >
            <div 
              className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleResultClick(result.id, index)}
            >
              <h3 className="text-lg font-medium text-gray-900 mb-1">{result.title || 'Untitled'}</h3>
              
              <div className="flex flex-wrap gap-1 mb-2">
                {/* Source and score info */}
                {result.source && (
                  <p className="text-xs text-gray-500">
                    Source: {result.source}
                    {result.score !== undefined && ` • Score: ${result.score.toFixed(2)}`}
                  </p>
                )}
                
                {/* Technical level badge */}
                {technicalLevel && (
                  <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    highlightedTags.includes(technicalLevel)
                      ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {technicalLevel}
                  </span>
                )}
              </div>
              
              {/* Main content */}
              <p className="text-gray-700 mb-3">
                {result.text.length > 300 ? result.text.substring(0, 300) + '...' : result.text}
              </p>
              
              {/* Tags display */}
              {(topics.length > 0 || audience.length > 0 || entities.length > 0) && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {/* Topic tags */}
                  {topics.map(topic => (
                    <span 
                      key={`topic-${topic}`}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        highlightedTags.includes(topic)
                          ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {topic}
                    </span>
                  ))}
                  
                  {/* Audience tags */}
                  {audience.map(type => (
                    <span 
                      key={`audience-${type}`}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        highlightedTags.includes(type)
                          ? 'bg-green-100 text-green-800 border border-green-300' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {type}
                    </span>
                  ))}
                  
                  {/* Entity tags */}
                  {entities.map(entity => (
                    <span 
                      key={`entity-${entity}`}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        highlightedTags.includes(entity)
                          ? 'bg-purple-100 text-purple-800 border border-purple-300' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {entity}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Expanded metadata (collapsible) */}
              {result.metadata && Object.keys(result.metadata).length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-100">
                  <details className="text-xs">
                    <summary className="text-gray-500 cursor-pointer">Metadata</summary>
                    <div className="mt-1 p-2 bg-gray-50 rounded text-gray-700">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(result.metadata, null, 2)}
                      </pre>
                    </div>
                  </details>
                </div>
              )}
            </div>
          </SearchResultTracker>
        );
      })}
    </div>
  );
};

export default SearchResults; 
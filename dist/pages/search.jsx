import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Search } from 'lucide-react';
import SearchResults from '@/components/SearchResults';
import TagFilterPanel from '@/components/TagFilterPanel';
import { extractTagsFromResults, filterResultsByTags, parseTagFiltersFromQuery, findTagsInQuery } from '@/utils/tagUtils';
import { trackEvent } from '@/utils/analytics';
const SearchPage = () => {
    const router = useRouter();
    const { q } = router.query;
    // State
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [filteredResults, setFilteredResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState(null);
    const [executionTime, setExecutionTime] = useState(null);
    // Tags state
    const [availableTags, setAvailableTags] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);
    const [suggestedTags, setSuggestedTags] = useState([]);
    // Set initial query from URL
    useEffect(() => {
        if (q && typeof q === 'string') {
            setQuery(q);
            // Parse tag filters from query
            const { cleanQuery, tagFilters } = parseTagFiltersFromQuery(q);
            if (tagFilters.length > 0) {
                setSelectedTags(tagFilters);
            }
            // Perform search with the query
            performSearch(cleanQuery || q);
        }
    }, [q]);
    // Update filtered results when tags or results change
    useEffect(() => {
        if (results.length > 0) {
            if (selectedTags.length > 0) {
                const filtered = filterResultsByTags(results, selectedTags);
                setFilteredResults(filtered);
            }
            else {
                setFilteredResults(results);
            }
        }
    }, [results, selectedTags]);
    // Perform the search API call
    const performSearch = async (searchQuery) => {
        if (!searchQuery.trim())
            return;
        setIsSearching(true);
        setError(null);
        try {
            // Prepare the request body
            const requestBody = {
                query: searchQuery,
                limit: 20, // Get more results than we'll show, to have room for filtering
                searchMode: 'hybrid',
                includeSourceDocuments: true,
                includeSourceCitations: true
            };
            // Call the search API
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                throw new Error(`Search failed with status: ${response.status}`);
            }
            const data = await response.json();
            // Extract results from response
            const searchResults = data.sourceDocuments || [];
            setResults(searchResults);
            setFilteredResults(searchResults);
            setExecutionTime(data.timings?.totalMs || null);
            // Track search event
            trackEvent({
                event_type: 'search_performed',
                event_data: {
                    query: searchQuery,
                    result_count: searchResults.length,
                    execution_time: data.timings?.totalMs,
                    filters_used: selectedTags.length > 0
                }
            });
            // Extract tags from results
            if (searchResults.length > 0) {
                const { topicTags, audienceTags, entityTags, technicalTags } = extractTagsFromResults(searchResults);
                const allTags = [...topicTags, ...audienceTags, ...entityTags, ...technicalTags];
                setAvailableTags(allTags);
                // Find relevant tags in the query
                const foundTags = findTagsInQuery(searchQuery, allTags);
                setSuggestedTags(foundTags);
            }
        }
        catch (err) {
            console.error('Search error:', err);
            setError('An error occurred while searching. Please try again.');
            setResults([]);
            setFilteredResults([]);
        }
        finally {
            setIsSearching(false);
        }
    };
    // Handle tag selection
    const handleTagSelect = (tag) => {
        setSelectedTags([...selectedTags, tag]);
    };
    // Handle tag removal
    const handleTagDeselect = (tag) => {
        setSelectedTags(selectedTags.filter(t => t !== tag));
    };
    // Clear all selected tags
    const handleClearFilters = () => {
        setSelectedTags([]);
    };
    // Handle search form submission
    const handleSubmit = (e) => {
        e.preventDefault();
        // Update URL with the search query
        router.push({
            pathname: '/search',
            query: { q: query },
        }, undefined, { shallow: true });
        // Perform the search
        performSearch(query);
    };
    return (<>
      <Head>
        <title>{query ? `${query} - Search` : 'Search Workstream Knowledge'}</title>
        <meta name="description" content="Search the Workstream knowledge base"/>
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 mb-4 md:mb-0">
                Workstream Knowledge Search
              </h1>
              
              <form onSubmit={handleSubmit} className="w-full md:w-2/3 lg:w-1/2">
                <div className="relative">
                  <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for topics, guides, and more..." className="w-full px-4 py-2 pr-10 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
                  <button type="submit" className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700" disabled={isSearching}>
                    {isSearching ? (<div className="animate-spin h-5 w-5 border-2 border-gray-500 border-t-transparent rounded-full"/>) : (<Search className="h-5 w-5"/>)}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          {/* Show suggested tags if there are any and no tags are selected */}
          {suggestedTags.length > 0 && selectedTags.length === 0 && (<div className="mb-6 bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm font-medium text-gray-700 mb-2">Suggested filters:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedTags.map(tag => (<button key={tag} onClick={() => handleTagSelect(tag)} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100">
                    {tag}
                  </button>))}
              </div>
            </div>)}
          
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar with filters */}
            <div className="w-full lg:w-1/4">
              {availableTags.length > 0 && (<TagFilterPanel availableTags={availableTags} selectedTags={selectedTags} onTagSelect={handleTagSelect} onTagDeselect={handleTagDeselect} onClearFilters={handleClearFilters}/>)}
            </div>
            
            {/* Main content */}
            <div className="w-full lg:w-3/4">
              {error && (<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>)}
              
              {isSearching ? (<div className="flex justify-center items-center h-64">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                  <p className="ml-2 text-gray-600">Searching...</p>
                </div>) : (filteredResults.length > 0 ? (<SearchResults results={filteredResults} query={query} searchType="hybrid" executionTimeMs={executionTime || undefined} highlightedTags={selectedTags}/>) : q ? (<div className="bg-white p-8 rounded-lg shadow-sm text-center">
                    <h2 className="text-xl font-medium text-gray-900 mb-2">No results found</h2>
                    <p className="text-gray-600 mb-4">
                      We couldn't find any results for "{q}". Try adjusting your search terms or removing filters.
                    </p>
                    {selectedTags.length > 0 && (<button onClick={handleClearFilters} className="text-blue-600 hover:text-blue-800">
                        Clear all filters
                      </button>)}
                  </div>) : (<div className="bg-white p-8 rounded-lg shadow-sm text-center">
                    <h2 className="text-xl font-medium text-gray-900 mb-2">Search the Workstream Knowledge Base</h2>
                    <p className="text-gray-600">
                      Enter a search term above to find information about Workstream's products, features, and services.
                    </p>
                  </div>))}
            </div>
          </div>
        </main>
      </div>
    </>);
};
export default SearchPage;

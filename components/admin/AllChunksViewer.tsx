import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { 
  Edit, 
  Delete, 
  RefreshCw, 
  Search, 
  List, 
  X as Close, 
  Database as Storage, 
  Filter as FilterList,
  Send,
  Clipboard,
  Check
} from 'react-feather';
import Button from '../ui/Button';
import DocumentChunkViewer from './DocumentChunkViewer';
import { useRouter } from 'next/router';
import Table, { TableColumn } from '../ui/Table';
import { getCategoryFilterOptions } from '@/utils/tagUtils';
import TextField from '../ui/TextField';

interface Chunk {
  id: string;
  document_id: string;
  chunk_index: number;
  text: string;
  metadata?: {
    [key: string]: any;
  };
  embedding?: number[];
  created_at?: string;
  score?: number;
}

/**
 * AllChunksViewer component for managing all document chunks across all documents.
 * This is a standalone interface that allows administrators to view, search, edit and manage
 * all chunks in the system without having to navigate through documents first.
 * 
 * Features:
 * - Hybrid search (vector + keyword) for finding chunks
 * - Document ID and metadata filtering
 * - Detailed chunk viewing and editing
 * - Navigation to parent documents
 */
const AllChunksViewer: React.FC = () => {
  // State management
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 25,
  });
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [documentIdFilter, setDocumentIdFilter] = useState<string>('');
  const [detailDialogOpen, setDetailDialogOpen] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Advanced search state
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [technicalLevelFilter, setTechnicalLevelFilter] = useState<number | null>(null);
  const [tagsFilterInput, setTagsFilterInput] = useState<string>('');
  const [searchMode, setSearchMode] = useState<'hybrid' | 'keyword' | 'vector'>('hybrid');
  const [vectorWeight, setVectorWeight] = useState<number>(0.5);
  const [keywordWeight, setKeywordWeight] = useState<number>(0.5);

  // --- State for Get Query Vector UI ---
  const [queryVectorText, setQueryVectorText] = useState<string>('');
  const [generatedVector, setGeneratedVector] = useState<string>('');
  const [vectorDimension, setVectorDimension] = useState<number | null>(null);
  const [isGeneratingVector, setIsGeneratingVector] = useState<boolean>(false);
  const [vectorError, setVectorError] = useState<string | null>(null);
  const [vectorCopied, setVectorCopied] = useState<boolean>(false);
  // --- End State for Get Query Vector UI ---

  const router = useRouter();
  
  // Fetch chunks on component mount (initial load)
  useEffect(() => {
    fetchChunks(true);
  }, []);

  // Fetch chunks when pagination or specific filters change (not search term)
  useEffect(() => {
    const tagsArray = tagsFilterInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    fetchChunks(false, tagsArray);
  }, [paginationModel, categoryFilter, technicalLevelFilter, tagsFilterInput, searchMode, vectorWeight, keywordWeight]);
  
  // Extract the document_id from the URL if present
  useEffect(() => {
    const { document_id } = router.query;
    
    if (document_id && typeof document_id === 'string') {
      // Set the document filter
      setDocumentIdFilter(document_id);
    }
  }, [router.query]);

  // Fetch chunks from the API
  const fetchChunks = async (isInitialLoad = false, currentTags: string[] = []) => {
    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: (paginationModel.page + 1).toString(),
        limit: paginationModel.pageSize.toString(),
        search_mode: searchMode
      });
      
      // Only include search term if it's not the initial load
      if (searchTerm && !isInitialLoad) {
        params.append('search', searchTerm);
      }
      
      // Only include doc filter if it's not the initial load OR if it was set by URL
      if (documentIdFilter && (!isInitialLoad || router.query.document_id)) {
        params.append('document_id', documentIdFilter);
      }

      if (categoryFilter) {
        params.append('category', categoryFilter);
      }

      if (technicalLevelFilter !== null) {
        params.append('technical_level', technicalLevelFilter.toString());
      }

      if (currentTags.length > 0) {
        params.append('tags', currentTags.join(','));
      }

      if (searchMode === 'hybrid') {
        params.append('vector_weight', vectorWeight.toString());
        params.append('keyword_weight', keywordWeight.toString());
      }
      
      const response = await fetch(`/api/admin/chunks/search?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch chunks: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      setChunks(data.chunks || []);
      setTotalChunks(data.pagination?.total || 0);
    } catch (err: any) {
      console.error('Error fetching chunks:', err);
      setError(`Failed to load chunks: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle opening the chunk detail dialog
  const handleOpenDetail = (chunkId: string) => {
    setSelectedChunkId(chunkId);
    setDetailDialogOpen(true);
  };
  
  // Handle closing the chunk detail dialog
  const handleCloseDetail = () => {
    setDetailDialogOpen(false);
    setSelectedChunkId(null);
    // Refresh the chunks list to show any updates
    fetchChunks();
  };
  
  // Handle search input changes
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };
  
  // Handle document ID filter changes
  const handleDocumentIdFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDocumentIdFilter(event.target.value);
  };
  
  // Function to trigger search manually
  const handleSearchSubmit = () => {
    setPaginationModel({ ...paginationModel, page: 0 });
    const tagsArray = tagsFilterInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    fetchChunks(false, tagsArray);
  };
  
  // Reset filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setDocumentIdFilter('');
    setCategoryFilter('');
    setTechnicalLevelFilter(null);
    setTagsFilterInput('');
    setSearchMode('hybrid');
    setVectorWeight(0.5);
    setKeywordWeight(0.5);
    fetchChunks(true, []);
  };
  
  // Handle snackbar close
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };
  
  // Add a new handler to navigate to document management
  const handleNavigateToDocument = (documentId: string) => {
    // Navigate to the admin page with the documentManagement tab and filter by document ID
    router.push(`/admin?tab=documentManagement&search=${documentId}`);
  };

  // Toggle advanced filter panel
  const toggleAdvancedFilters = () => {
    setAdvancedFiltersOpen(!advancedFiltersOpen);
  };

  // Handle search mode change
  const handleSearchModeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSearchMode(event.target.value as 'hybrid' | 'keyword' | 'vector');
  };
  
  // --- Define Columns for the Table ---
  const columns: TableColumn<Chunk>[] = [
    {
      field: 'chunk_index',
      headerName: 'Index',
      width: 80,
    },
    {
      field: 'document_id',
      headerName: 'Document ID',
      flex: 1,
      renderCell: (row) => (
        <span 
          className="font-mono text-xs cursor-pointer text-blue-600 hover:underline"
          onClick={() => handleNavigateToDocument(row.document_id)}
          title="Go to Document"
        >
          {row.document_id}
        </span>
      )
    },
    {
      field: 'text',
      headerName: 'Content Preview',
      flex: 3,
      renderCell: (row) => (
        <div className="truncate max-w-md" title={row.text}>
          {row.text}
        </div>
      )
    },
    {
      field: 'metadata.tags',
      headerName: 'Tags',
      flex: 1,
      renderCell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.metadata?.tags?.slice(0, 3).map((tag: string, index: number) => (
            <span key={index} className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
              {tag}
            </span>
          ))}
          {row.metadata?.tags?.length > 3 && (
            <span className="text-gray-500 text-xs">...</span>
          )}
        </div>
      ),
    },
    {
      field: 'score',
      headerName: 'Score',
      width: 100,
      renderCell: (row) => (
        <span>{row.score ? row.score.toFixed(4) : 'N/A'}</span>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (row) => (
        <div className="flex space-x-2">
          <Button 
            variant="text"
            size="small"
            onClick={() => handleOpenDetail(row.id)}
            title="View/Edit Chunk Details"
            color="primary"
          >
            <Edit size={16} />
          </Button>
        </div>
      )
    }
  ];
  // --- End Column Definitions ---

  // --- Function to handle generating the query vector ---
  const handleGenerateVector = async () => {
    if (!queryVectorText.trim()) {
      setVectorError('Please enter text to generate a vector.');
      return;
    }
    setIsGeneratingVector(true);
    setVectorError(null);
    setGeneratedVector('');
    setVectorDimension(null);
    setVectorCopied(false);

    try {
      const response = await fetch('/api/admin/get_query_vector', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ queryText: queryVectorText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate vector');
      }

      if (data.vector) {
        setGeneratedVector(`[${data.vector.join(',')}]`);
        setVectorDimension(data.dimension || data.vector.length);
      } else {
        throw new Error('API did not return a vector.');
      }
    } catch (err: any) {
      setVectorError(`Error: ${err.message}`);
    } finally {
      setIsGeneratingVector(false);
    }
  };
  // --- End Function to handle generating the query vector ---

  // --- Function to copy vector to clipboard ---
  const handleCopyVector = () => {
    if (generatedVector) {
      navigator.clipboard.writeText(generatedVector).then(() => {
        setVectorCopied(true);
        setTimeout(() => setVectorCopied(false), 2000); // Reset icon after 2s
      }).catch(err => {
        console.error('Failed to copy vector:', err);
        setSnackbar({ open: true, message: 'Failed to copy vector', severity: 'error' });
      });
    }
  };
  // --- End Function to copy vector to clipboard ---

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4 flex items-center">
        <Storage size={24} className="mr-2" /> All Document Chunks
      </h2>

      {/* --- Get Query Vector Section --- */} 
      <div className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
        <h3 className="text-lg font-medium mb-3">Generate Query Vector</h3>
        <div className="flex items-end gap-2 mb-2">
          <div className="flex-grow">
            <label htmlFor="query-vector-text" className="block text-sm font-medium text-gray-700 mb-1">Text to Embed:</label>
            <TextField
              id="query-vector-text"
              type="text"
              placeholder="Enter text to generate vector for search..."
              value={queryVectorText}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setQueryVectorText(e.target.value)}
              disabled={isGeneratingVector}
              fullWidth
            />
          </div>
          <Button
            onClick={handleGenerateVector}
            disabled={isGeneratingVector || !queryVectorText.trim()}
            loading={isGeneratingVector}
            variant="primary"
          >
            <Send size={16} className="mr-1" /> Generate
          </Button>
        </div>
        {vectorError && <p className="text-red-600 text-sm mb-2">{vectorError}</p>}
        {generatedVector && (
          <div className="mt-3 relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Generated Vector (Dimension: {vectorDimension || 'N/A'}) - Copy for SQL:</label>
            <TextField
              readOnly
              value={generatedVector}
              className="w-full font-mono text-xs bg-gray-100 resize-none"
              multiline
              rows={4}
              fullWidth
            />
            <Button
              variant="text"
              size="small"
              onClick={handleCopyVector}
              className="absolute top-8 right-2 bg-white hover:bg-gray-100 p-1 rounded"
              title="Copy Vector"
            >
              {vectorCopied ? <Check size={16} className="text-green-600" /> : <Clipboard size={16} />}
            </Button>
          </div>
        )}
      </div>
      {/* --- End Get Query Vector Section --- */}

      {/* --- Filters and Search Section --- */}
      <div className="mb-4 flex flex-col md:flex-row md:items-end gap-4">
        {/* Search Input */} 
        <div className="flex-grow">
          <label htmlFor="search-term" className="block text-sm font-medium text-gray-700 mb-1">Search Chunks:</label>
          <TextField
            id="search-term"
            type="text" 
            placeholder="Search by content (keyword or vector)..." 
            value={searchTerm} 
            onChange={handleSearchChange}
            onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSearchSubmit()}
            fullWidth
          />
        </div>
        
        {/* Document ID Filter */}
        <div>
          <label htmlFor="doc-id-filter" className="block text-sm font-medium text-gray-700 mb-1">Filter by Document ID:</label>
          <TextField
            id="doc-id-filter"
            type="text" 
            placeholder="Optional Document ID..." 
            value={documentIdFilter}
            onChange={handleDocumentIdFilterChange}
            onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSearchSubmit()}
          />
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button onClick={handleSearchSubmit} variant="secondary" title="Apply search and filters">
            <Search size={16} className="mr-1" /> Search
          </Button>
          <Button onClick={toggleAdvancedFilters} variant="outline" title="Toggle advanced filters">
            <FilterList size={16} />
          </Button>
          <Button onClick={handleResetFilters} variant="outline" title="Reset all filters">
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {advancedFiltersOpen && (
        <div className="mb-4 p-4 border border-gray-200 rounded-md bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Category Filter */}
          <div>
            <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-1">Category:</label>
            <select 
              id="category-filter"
              value={categoryFilter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setCategoryFilter(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="">All Categories</option>
              {getCategoryFilterOptions().map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Technical Level Filter */}
          <div>
            <label htmlFor="tech-level-filter" className="block text-sm font-medium text-gray-700 mb-1">Technical Level (Min):</label>
            <TextField
              id="tech-level-filter"
              type="number" 
              placeholder="1-5" 
              value={technicalLevelFilter ?? ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTechnicalLevelFilter(e.target.value ? parseInt(e.target.value, 10) : null)}
              min="1"
              max="5"
            />
          </div>

          {/* Tags Filter */}
          <div>
            <label htmlFor="tags-filter" className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated):</label>
            <TextField
              id="tags-filter"
              type="text" 
              placeholder="e.g., feature_x, roadmap" 
              value={tagsFilterInput}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTagsFilterInput(e.target.value)}
            />
          </div>

          {/* Search Mode Select */}
          <div>
            <label htmlFor="search-mode" className="block text-sm font-medium text-gray-700 mb-1">Search Mode:</label>
            <select 
              id="search-mode"
              value={searchMode}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSearchMode(e.target.value as 'hybrid' | 'keyword' | 'vector')}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="hybrid">Hybrid</option>
              <option value="keyword">Keyword Only</option>
              <option value="vector">Vector Only</option>
            </select>
          </div>

          {/* Hybrid Weights (conditional) */}
          {searchMode === 'hybrid' && (
            <>
              <div>
                <label htmlFor="vector-weight" className="block text-sm font-medium text-gray-700 mb-1">Vector Weight ({vectorWeight.toFixed(1)}):</label>
                <input 
                  id="vector-weight"
                  type="range" 
                  min="0" max="1" step="0.1" 
                  value={vectorWeight}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const vWeight = parseFloat(e.target.value);
                    setVectorWeight(vWeight);
                    setKeywordWeight(1 - vWeight);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
              </div>
              <div>
                <label htmlFor="keyword-weight" className="block text-sm font-medium text-gray-700 mb-1">Keyword Weight ({keywordWeight.toFixed(1)}):</label>
                <input 
                  id="keyword-weight"
                  type="range" 
                  min="0" max="1" step="0.1" 
                  value={keywordWeight}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const kWeight = parseFloat(e.target.value);
                    setKeywordWeight(kWeight);
                    setVectorWeight(1 - kWeight);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
              </div>
            </>
          )}
        </div>
      )}
      {/* --- End Filters and Search Section --- */}

      {/* --- Chunks Table --- */}
      {error && <p className="text-red-500 mb-4">Error: {error}</p>}
      <div style={{ height: 600, width: '100%' }}>
        <Table<Chunk>
          rows={chunks}
          columns={columns}
          loading={loading}
          rowCount={totalChunks}
          pagination={true}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
        />
      </div>
      {/* --- End Chunks Table --- */}

      {/* Chunk Detail Modal */}
      {detailDialogOpen && selectedChunkId && (
        <DocumentChunkViewer
          chunkId={selectedChunkId}
          onClose={handleCloseDetail}
          onChunkUpdated={() => {
            fetchChunks();
            setSnackbar({ open: true, message: 'Chunk updated successfully', severity: 'success' });
          }}
        />
      )}

      {/* Snackbar for notifications */}
      {/* Implement Snackbar component display logic here based on 'snackbar' state */}
      {/* Example: <Snackbar open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={handleCloseSnackbar} /> */}
      
    </div>
  );
};

export default AllChunksViewer; 
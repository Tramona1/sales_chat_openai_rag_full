import React, { useState, useEffect } from 'react';
import { X as Close, Filter as FilterList } from 'react-feather';
import Button from '../ui/Button';
import DocumentChunkViewer from './DocumentChunkViewer';
import { useRouter } from 'next/router';
import Table from '../ui/Table';
import { getCategoryFilterOptions } from '@/utils/tagUtils';
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
const AllChunksViewer = () => {
    // State management
    const [chunks, setChunks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [paginationModel, setPaginationModel] = useState({
        page: 0,
        pageSize: 25,
    });
    const [totalChunks, setTotalChunks] = useState(0);
    const [selectedChunkId, setSelectedChunkId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [documentIdFilter, setDocumentIdFilter] = useState('');
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });
    // Advanced search state
    const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [technicalLevelFilter, setTechnicalLevelFilter] = useState(null);
    const [tagsFilterInput, setTagsFilterInput] = useState('');
    const [searchMode, setSearchMode] = useState('hybrid');
    const [vectorWeight, setVectorWeight] = useState(0.5);
    const [keywordWeight, setKeywordWeight] = useState(0.5);
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
    const fetchChunks = async (isInitialLoad = false, currentTags = []) => {
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
        }
        catch (err) {
            console.error('Error fetching chunks:', err);
            setError(`Failed to load chunks: ${err.message}`);
        }
        finally {
            setLoading(false);
        }
    };
    // Handle opening the chunk detail dialog
    const handleOpenDetail = (chunkId) => {
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
    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
    };
    // Handle document ID filter changes
    const handleDocumentIdFilterChange = (event) => {
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
    const handleNavigateToDocument = (documentId) => {
        // Navigate to the admin page with the documentManagement tab and filter by document ID
        router.push(`/admin?tab=documentManagement&search=${documentId}`);
    };
    // Toggle advanced filter panel
    const toggleAdvancedFilters = () => {
        setAdvancedFiltersOpen(!advancedFiltersOpen);
    };
    // Handle search mode change
    const handleSearchModeChange = (event) => {
        setSearchMode(event.target.value);
    };
    // --- Define Columns for the Table ---
    const columns = [
        {
            field: 'chunk_index',
            headerName: 'Index',
            width: 80,
        },
        {
            field: 'document_id',
            headerName: 'Document ID',
            flex: 1,
            renderCell: (row) => (<span className="font-mono text-xs cursor-pointer text-blue-600 hover:underline" onClick={() => handleNavigateToDocument(row.document_id)} title="Go to Document">
          {row.document_id}
        </span>)
        },
        {
            field: 'text',
            headerName: 'Content Preview',
            flex: 3,
            renderCell: (row) => (<div className="truncate max-w-md" title={row.text}>
          {row.text}
        </div>)
        },
        {
            field: 'score',
            headerName: 'Score',
            width: 100,
            valueFormatter: (value) => value ? value.toFixed(4) : 'N/A',
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 100,
            renderCell: (row) => (<Button variant="outlined" size="small" color="primary" onClick={() => handleOpenDetail(row.id)}>
          View/Edit
        </Button>)
        }
    ];
    // --- End Column Definitions ---
    return (<div>
      <h1>Document Chunks</h1>
      
      <div className="p-4 mb-3">
        <div className="grid grid-cols-12 gap-4 items-center">
          <div className="col-span-12 md:col-span-5">
            <input type="text" className="w-full p-2 border rounded-md" placeholder="Search Chunk Content" value={searchTerm} onChange={handleSearchChange} onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}/>
          </div>
          <div className="col-span-12 md:col-span-4">
            <input type="text" className="w-full p-2 border rounded-md" placeholder="Filter by Document ID" value={documentIdFilter} onChange={handleDocumentIdFilterChange} onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}/>
          </div>
          <div className="col-span-6 md:col-span-1">
            <Button variant="primary" onClick={handleSearchSubmit} fullWidth>
              Search
            </Button>
          </div>
          <div className="col-span-6 md:col-span-2">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleResetFilters} fullWidth>
                Reset
              </Button>
              <Button variant="outline" color="secondary" onClick={toggleAdvancedFilters} className="p-2">
                <FilterList className="w-4 h-4"/>
              </Button>
            </div>
          </div>

          {advancedFiltersOpen && (<>
              <div className="col-span-12">
                <div className="my-2 border-b border-gray-200">
                  <h2 className="text-sm font-medium leading-6 text-gray-900">Advanced Filters</h2>
                </div>
              </div>
              
              <div className="col-span-12 md:col-span-3">
                <select className="w-full p-2 border rounded-md" value={searchMode} onChange={handleSearchModeChange}>
                  <option value="hybrid">Hybrid (Vector + Keyword)</option>
                  <option value="vector">Vector Only</option>
                  <option value="keyword">Keyword Only</option>
                </select>
              </div>
              
              <div className="col-span-12 md:col-span-3">
                <select className="w-full p-2 border rounded-md" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  {getCategoryFilterOptions().filter(opt => opt.value !== 'all').map(option => (<option key={option.value} value={option.value}>
                      {option.label}
                    </option>))}
                </select>
              </div>
              
              <div className="col-span-12 md:col-span-3">
                <select className="w-full p-2 border rounded-md" value={technicalLevelFilter === null ? '' : technicalLevelFilter} onChange={(e) => setTechnicalLevelFilter(e.target.value === '' ? null : Number(e.target.value))}>
                  <option value="">Any Technical Level</option>
                  {[...Array(10)].map((_, i) => (<option key={i + 1} value={i + 1}>
                      Level {i + 1}
                    </option>))}
                </select>
              </div>
              
              <div className="col-span-12 md:col-span-3">
                <input type="text" className="w-full p-2 border rounded-md" placeholder="Filter by Tags (comma-sep)" value={tagsFilterInput} onChange={(e) => setTagsFilterInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}/>
              </div>
              
              {searchMode === 'hybrid' && (<>
                  <div className="col-span-12 md:col-span-6">
                    <div className="px-4">
                      <p className="text-sm font-medium leading-6 text-gray-900">
                        Vector Weight: {vectorWeight}
                      </p>
                      <input type="range" min="0" max="1" step="0.1" value={vectorWeight} onChange={(e) => setVectorWeight(parseFloat(e.target.value))} className="w-full"/>
                    </div>
                  </div>
                  
                  <div className="col-span-12 md:col-span-6">
                    <div className="px-4">
                      <p className="text-sm font-medium leading-6 text-gray-900">
                        Keyword Weight: {keywordWeight}
                      </p>
                      <input type="range" min="0" max="1" step="0.1" value={keywordWeight} onChange={(e) => setKeywordWeight(parseFloat(e.target.value))} className="w-full"/>
                    </div>
                  </div>
                </>)}
            </>)}
        </div>
      </div>
      
      {error && (<div className="p-4 border-l-4 border-red-400">
          {error}
        </div>)}
      
      {/* Replace Placeholder with Actual Table */}
      <div className="w-full bg-white rounded-lg shadow">
        <Table rows={chunks} columns={columns} loading={loading} getRowId={(row) => row.id} pagination={true} paginationModel={paginationModel} onPaginationModelChange={(model) => setPaginationModel(model)} rowCount={totalChunks}/>
      </div>
      
      {/* Detail Dialog */}
      {detailDialogOpen && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {selectedChunkId && (<DocumentChunkViewer chunkId={selectedChunkId} onChunkUpdated={() => {
                    fetchChunks();
                }} onClose={handleCloseDetail}/>)}
            </div>
          </div>)}
      
      {/* Snackbar for notifications */}
      <div className={`fixed bottom-0 right-0 p-4 ${snackbar.open ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <button className="float-right text-red-500" onClick={handleCloseSnackbar}>
            <Close className="w-4 h-4"/>
          </button>
          <p className="text-sm text-gray-900">
            {snackbar.message}
          </p>
        </div>
      </div>
    </div>);
};
export default AllChunksViewer;

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Edit, Trash2 as Delete, RefreshCw as Refresh, List as ViewList, Eye as Visibility, Grid as ViewComfy, X as Close } from 'react-feather';
import Button from '../ui/Button';
import Table from '../ui/Table';
import { debounce } from 'lodash';
import { useRouter } from 'next/router';
import { parseTagInput, normalizeTags, STANDARD_CATEGORIES } from '../../utils/tagUtils';
const DocumentManagement = () => {
    // State for documents and loading status
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalDocuments, setTotalDocuments] = useState(0);
    // State for pagination and filtering
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(25);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [secondaryCategoryFilter, setSecondaryCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchByContent, setSearchByContent] = useState(false);
    const [dateRange, setDateRange] = useState({
        start: '',
        end: ''
    });
    // State for document editing
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [viewDialogOpen, setViewDialogOpen] = useState(false);
    const [viewChunksDialogOpen, setViewChunksDialogOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        title: '',
        source: '',
        primaryCategory: '',
        secondaryCategories: [],
        summary: '',
        technicalLevel: 5,
        keywords: [],
        entities: []
    });
    // Inside the DocumentManagement component, add a router instance
    const router = useRouter();
    // Fetch documents from API with filters
    const fetchDocuments = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let url = `/api/admin/documents?limit=${pageSize}&page=${page + 1}`;
            // Add search filter
            if (searchTerm) {
                url += `&search=${encodeURIComponent(searchTerm)}`;
                // If searching by content, add that parameter
                if (searchByContent) {
                    url += '&searchContent=true';
                }
            }
            // Add category filter
            if (categoryFilter && categoryFilter !== 'all') {
                url += `&category=${encodeURIComponent(categoryFilter)}`;
            }
            // Add secondary category filter
            if (secondaryCategoryFilter && secondaryCategoryFilter !== 'all') {
                url += `&secondaryCategory=${encodeURIComponent(secondaryCategoryFilter)}`;
            }
            // Add status filter
            if (statusFilter === 'approved') {
                url += '&approved=true';
            }
            else if (statusFilter === 'pending') {
                url += '&approved=false';
            }
            // Add date range filters
            if (dateRange.start) {
                url += `&startDate=${encodeURIComponent(dateRange.start)}`;
            }
            if (dateRange.end) {
                url += `&endDate=${encodeURIComponent(dateRange.end)}`;
            }
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch documents: ${response.statusText}`);
            }
            const data = await response.json();
            setDocuments(data.documents || []);
            setTotalDocuments(data.total || 0);
        }
        catch (err) {
            console.error('Error fetching documents:', err);
            setError(`Failed to load documents: ${err.message}`);
        }
        finally {
            setLoading(false);
        }
    }, [page, pageSize, searchTerm, categoryFilter, statusFilter, dateRange, searchByContent, secondaryCategoryFilter]);
    // Debounced search handler
    const debouncedSearch = useCallback(debounce((term) => {
        setSearchTerm(term);
        setPage(0); // Reset to first page on new search
    }, 500), []);
    // Handle search input change
    const handleSearchChange = (event) => {
        debouncedSearch(event.target.value);
    };
    // Fetch documents on mount and when filters change
    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);
    // Open edit dialog for a document
    const handleEditDocument = (document) => {
        setSelectedDocument(document);
        setEditForm({
            title: document.title || '',
            source: document.source || '',
            primaryCategory: document.metadata?.primaryCategory || '',
            secondaryCategories: document.metadata?.secondaryCategories || [],
            summary: document.metadata?.summary || '',
            technicalLevel: document.metadata?.technicalLevel || 5,
            keywords: document.metadata?.keywords || [],
            entities: document.metadata?.entities || []
        });
        setEditDialogOpen(true);
    };
    // Open delete dialog for a document
    const handleDeleteDocument = (document) => {
        setSelectedDocument(document);
        setDeleteDialogOpen(true);
    };
    // Open view dialog for a document
    const handleViewDocument = (document) => {
        setSelectedDocument(document);
        setViewDialogOpen(true);
    };
    // Open chunks dialog for a document
    const handleViewChunks = (document) => {
        setSelectedDocument(document);
        setViewChunksDialogOpen(true);
    };
    // Handle edit form field changes
    const handleEditFormChange = (field, value) => {
        setEditForm(prev => ({
            ...prev,
            [field]: value
        }));
    };
    // Handle keyword input (when user presses Enter)
    const handleKeywordInput = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            const input = event.currentTarget.value.trim();
            if (input) {
                // Use parseTagInput to standardize tag handling
                const newKeywords = parseTagInput(input);
                if (newKeywords.length > 0) {
                    // Add new keywords that don't already exist
                    const updatedKeywords = normalizeTags([
                        ...editForm.keywords,
                        ...newKeywords.filter(k => !editForm.keywords.includes(k))
                    ]);
                    setEditForm(prev => ({
                        ...prev,
                        keywords: updatedKeywords
                    }));
                }
                // Clear the input
                event.currentTarget.value = '';
            }
        }
    };
    // Remove a keyword from the list
    const handleRemoveKeyword = (keyword) => {
        setEditForm(prev => ({
            ...prev,
            keywords: normalizeTags(prev.keywords.filter(k => k !== keyword))
        }));
    };
    // Save document changes
    const handleSaveDocument = async () => {
        if (!selectedDocument)
            return;
        try {
            // Normalize keywords before saving
            const normalizedKeywords = normalizeTags(editForm.keywords);
            const normalizedSecondaryCategories = normalizeTags(editForm.secondaryCategories);
            const response = await fetch(`/api/admin/documents/${selectedDocument.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: editForm.title,
                    source: editForm.source,
                    metadata: {
                        primaryCategory: editForm.primaryCategory,
                        secondaryCategories: normalizedSecondaryCategories,
                        summary: editForm.summary,
                        technicalLevel: editForm.technicalLevel,
                        keywords: normalizedKeywords,
                        entities: editForm.entities
                    }
                })
            });
            if (!response.ok) {
                throw new Error(`Failed to update document: ${response.statusText}`);
            }
            // Close the dialog and refresh documents
            setEditDialogOpen(false);
            fetchDocuments();
        }
        catch (err) {
            console.error('Error saving document:', err);
            setError(`Failed to save document: ${err.message}`);
        }
    };
    // Delete a document
    const handleConfirmDelete = async () => {
        if (!selectedDocument)
            return;
        try {
            const response = await fetch(`/api/admin/documents/${selectedDocument.id}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                throw new Error(`Failed to delete document: ${response.statusText}`);
            }
            // Close the dialog and refresh documents
            setDeleteDialogOpen(false);
            fetchDocuments();
        }
        catch (err) {
            console.error('Error deleting document:', err);
            setError(`Failed to delete document: ${err.message}`);
        }
    };
    // Navigate to chunk management for a document
    const handleNavigateToChunks = (documentId) => {
        router.push(`/admin?tab=chunkManagement&document_id=${documentId}`);
    };
    // Table columns
    const columns = [
        {
            field: 'title',
            headerName: 'Title',
            flex: 2,
            renderCell: (row) => (<div className="cursor-pointer text-blue-600 hover:underline" onClick={() => handleViewDocument(row)} title={row.title}>
          {row.title}
        </div>)
        },
        {
            field: 'source',
            headerName: 'Source',
            flex: 1
        },
        {
            field: 'primaryCategory',
            headerName: 'Category',
            flex: 1,
            valueGetter: (row) => row.metadata?.primaryCategory || 'Uncategorized'
        },
        {
            field: 'approved',
            headerName: 'Status',
            width: 120,
            renderCell: (row) => (<span className={`px-2 py-1 rounded-full text-xs ${row.approved
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'}`}>
          {row.approved ? 'Approved' : 'Pending'}
        </span>)
        },
        {
            field: 'updated_at',
            headerName: 'Last Updated',
            width: 180,
            valueFormatter: (row) => new Date(row.updated_at).toLocaleString()
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 200,
            renderCell: (row) => (<div className="flex space-x-2">
          <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" onClick={() => handleViewDocument(row)} title="View">
            <Visibility size={18}/>
          </button>
          <button className="p-1 text-indigo-600 hover:bg-indigo-50 rounded" onClick={() => handleEditDocument(row)} title="Edit">
            <Edit size={18}/>
          </button>
          <button className="p-1 text-red-600 hover:bg-red-50 rounded" onClick={() => handleDeleteDocument(row)} title="Delete">
            <Delete size={18}/>
          </button>
          <button className="p-1 text-purple-600 hover:bg-purple-50 rounded" onClick={() => handleNavigateToChunks(row.id)} title="View Chunks">
            <ViewComfy size={18}/>
          </button>
        </div>)
        }
    ];
    return (<div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Document Management</h1>
      
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-3">
            <div className="relative">
              <input type="text" className="w-full p-2 pl-10 border border-gray-300 rounded" placeholder="Search Documents" onChange={handleSearchChange}/>
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"/>
            </div>
          </div>
          
          <div className="md:col-span-2">
            <select className="w-full p-2 border border-gray-300 rounded" value={categoryFilter} onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(0);
        }} title="Filter by Primary Category">
              <option value="all">All Categories</option>
              {STANDARD_CATEGORIES.map(category => (<option key={category.value} value={category.value}>{category.label}</option>))}
            </select>
          </div>
          
          <div className="md:col-span-2">
            <select className="w-full p-2 border border-gray-300 rounded" value={secondaryCategoryFilter} onChange={(e) => {
            setSecondaryCategoryFilter(e.target.value);
            setPage(0);
        }} title="Filter by Secondary Category">
              <option value="all">All Sec. Categories</option>
              {STANDARD_CATEGORIES.map(category => (<option key={category.value} value={category.value}>{category.label}</option>))}
            </select>
          </div>
          
          <div className="md:col-span-2">
            <select className="w-full p-2 border border-gray-300 rounded" value={statusFilter} onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
        }}>
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          
          <div className="md:col-span-1">
            <Button variant="outlined" color="secondary" startIcon={<Refresh />} onClick={() => fetchDocuments()} className="w-full h-10" title="Refresh List">
              Refresh
            </Button>
          </div>
          
          <div className="md:col-span-2">
            <Button variant={searchByContent ? "contained" : "outlined"} color="primary" startIcon={<Search size={16}/>} onClick={() => {
            setSearchByContent(!searchByContent);
            fetchDocuments();
        }} className="w-full h-10" title={searchByContent ? "Searching document content" : "Click to search document content instead of title/source"}>
              {searchByContent ? "Search Content" : "Search Title/Src"}
            </Button>
          </div>
        </div>
      </div>
      
      {error && (<div className="p-4 mb-4 border-l-4 border-red-500 bg-red-50 text-red-700">
          {error}
        </div>)}
      
      <div className="w-full h-[650px] bg-white rounded-lg shadow">
        <Table rows={documents} columns={columns} loading={loading} getRowId={(row) => row.id} pagination={true} paginationModel={{ page, pageSize }} onPaginationModelChange={(model) => {
            setPage(model.page);
            setPageSize(model.pageSize);
        }} rowCount={totalDocuments}/>
      </div>
      
      {/* Edit Document Dialog */}
      {editDialogOpen && selectedDocument && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Document</h2>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setEditDialogOpen(false)}>
                <Close size={20}/>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-12">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input type="text" className="w-full p-2 border border-gray-300 rounded" value={editForm.title} onChange={(e) => handleEditFormChange('title', e.target.value)}/>
              </div>
              
              <div className="md:col-span-12">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source
                </label>
                <input type="text" className="w-full p-2 border border-gray-300 rounded" value={editForm.source} onChange={(e) => handleEditFormChange('source', e.target.value)}/>
              </div>
              
              <div className="md:col-span-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Category
                </label>
                <select className="w-full p-2 border border-gray-300 rounded" value={editForm.primaryCategory} onChange={(e) => handleEditFormChange('primaryCategory', e.target.value)}>
                  <option value="">Select Category</option>
                  {STANDARD_CATEGORIES.map(category => (<option key={category.value} value={category.value}>{category.label}</option>))}
                </select>
              </div>
              
              <div className="md:col-span-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Technical Level
                </label>
                <select className="w-full p-2 border border-gray-300 rounded" value={editForm.technicalLevel} onChange={(e) => handleEditFormChange('technicalLevel', parseInt(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (<option key={level} value={level}>{level}</option>))}
                </select>
              </div>
              
              <div className="md:col-span-12">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Summary
                </label>
                <textarea className="w-full p-2 border border-gray-300 rounded h-32" value={editForm.summary} onChange={(e) => handleEditFormChange('summary', e.target.value)}/>
              </div>
              
              <div className="md:col-span-12">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keywords
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editForm.keywords.map(keyword => (<span key={keyword} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center">
                      {keyword}
                      <button className="ml-1 text-blue-600 hover:text-blue-800" onClick={() => handleRemoveKeyword(keyword)}>
                        &times;
                      </button>
                    </span>))}
                </div>
                <input type="text" className="w-full p-2 border border-gray-300 rounded" placeholder="Type keyword and press Enter" onKeyDown={handleKeywordInput}/>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outlined" color="secondary" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="contained" color="primary" onClick={handleSaveDocument}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>)}
      
      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && selectedDocument && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Confirm Deletion</h2>
            <p className="mb-6">
              Are you sure you want to delete the document "{selectedDocument.title}"? 
              This action cannot be undone and will also delete all associated chunks.
            </p>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outlined" color="secondary" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="contained" color="error" onClick={handleConfirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>)}
      
      {/* View Document Dialog */}
      {viewDialogOpen && selectedDocument && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedDocument.title}</h2>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setViewDialogOpen(false)}>
                <Close size={20}/>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
              <div className="md:col-span-6">
                <h3 className="text-sm font-medium text-gray-500">Source</h3>
                <p>{selectedDocument.source}</p>
              </div>
              
              <div className="md:col-span-3">
                <h3 className="text-sm font-medium text-gray-500">Category</h3>
                <p>{selectedDocument.metadata?.primaryCategory || 'Uncategorized'}</p>
              </div>
              
              <div className="md:col-span-3">
                <h3 className="text-sm font-medium text-gray-500">Status</h3>
                <span className={`px-2 py-1 rounded-full text-xs ${selectedDocument.approved
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'}`}>
                  {selectedDocument.approved ? 'Approved' : 'Pending'}
                </span>
              </div>
            </div>
            
            <div className="border-t border-b border-gray-200 py-4 mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Summary</h3>
              <p className="whitespace-pre-line">{selectedDocument.metadata?.summary || 'No summary available'}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6">
                <h3 className="text-sm font-medium text-gray-500">Technical Level</h3>
                <p>{selectedDocument.metadata?.technicalLevel || 'N/A'}</p>
              </div>
              
              <div className="md:col-span-6">
                <h3 className="text-sm font-medium text-gray-500">Chunks</h3>
                <p>{selectedDocument.chunkCount || 0}</p>
              </div>
              
              <div className="md:col-span-12">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedDocument.metadata?.keywords && selectedDocument.metadata.keywords.length > 0 ? (selectedDocument.metadata.keywords.map(keyword => (<span key={keyword} className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">
                        {keyword}
                      </span>))) : (<p className="text-gray-500">No keywords</p>)}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between mt-6">
              <Button variant="outlined" color="secondary" startIcon={<ViewList />} onClick={() => {
                setViewDialogOpen(false);
                handleNavigateToChunks(selectedDocument.id);
            }}>
                View Chunks
              </Button>
              
              <div className="space-x-2">
                <Button variant="outlined" color="primary" startIcon={<Edit />} onClick={() => {
                setViewDialogOpen(false);
                handleEditDocument(selectedDocument);
            }}>
                  Edit
                </Button>
                <Button variant="outlined" color="error" startIcon={<Delete />} onClick={() => {
                setViewDialogOpen(false);
                handleDeleteDocument(selectedDocument);
            }}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>)}
      
      {/* View Chunks Dialog (Placeholder) */}
      {viewChunksDialogOpen && selectedDocument && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Chunks for: {selectedDocument.title}</h2>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setViewChunksDialogOpen(false)}>
                <Close size={20}/>
              </button>
            </div>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              Use the Chunk Viewer to see individual document chunks.
              This will allow viewing, editing, and managing the individual chunks of this document.
            </div>
            
            <div className="text-center py-8">
              <h3 className="text-lg font-medium mb-2">Coming Soon</h3>
              <p className="text-gray-600">
                This feature is scheduled for implementation in Phase 3 (Weeks 7-9)
              </p>
            </div>
          </div>
        </div>)}
    </div>);
};
export default DocumentManagement;

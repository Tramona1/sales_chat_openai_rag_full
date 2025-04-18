import React, { useState, useEffect } from 'react';
import { Search, Trash2, FileText, RefreshCw, Filter, Clock, Edit2, X } from 'lucide-react';
import EditDocumentModal, { DocumentToEdit } from './EditDocumentModal';

interface DocumentManagerProps {
  limit?: number;
}

interface Document {
  id: string;
  source: string;
  text: string;
  metadata: {
    source: string;
    page?: number;
    topics?: string[];
    contentType?: string;
    technicalLevel?: number;
    lastUpdated?: string;
    approvedAt?: string;
    [key: string]: any; // Allow other metadata properties
  };
}

interface ApiResponse {
  documents: Document[];
  total: number;
  limit: number;
}

// Add interface for document editing
interface EditingDocument {
  document: Document | null;
  isOpen: boolean;
}

export default function DocumentManager({ limit = 50 }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [totalDocuments, setTotalDocuments] = useState<number>(0);
  const [responseDebug, setResponseDebug] = useState<string | null>(null);
  const [showRecentlyApproved, setShowRecentlyApproved] = useState<boolean>(false);
  
  // State for document editing
  const [editingDocument, setEditingDocument] = useState<EditingDocument>({ document: null, isOpen: false });
  const [editedText, setEditedText] = useState<string>('');
  const [editedMetadata, setEditedMetadata] = useState<{[key: string]: any}>({});
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  
  // State for batch operations
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isBatchDeleting, setIsBatchDeleting] = useState<boolean>(false);

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Define what "recently approved" means (last 24 hours)
  const isRecentlyApproved = (doc: Document): boolean => {
    if (!doc.metadata?.approvedAt && !doc.metadata?.lastUpdated) return false;
    
    const approvalDate = doc.metadata?.approvedAt 
      ? new Date(doc.metadata.approvedAt) 
      : doc.metadata?.lastUpdated 
        ? new Date(doc.metadata.lastUpdated)
        : null;
    
    if (!approvalDate) return false;
    
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    return approvalDate > oneDayAgo;
  };

  // Fetch documents from the API
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        
        // Build query parameters
        const queryParams = new URLSearchParams();
        if (limit) queryParams.set('limit', limit.toString());
        if (debouncedSearchTerm) queryParams.set('search', debouncedSearchTerm);
        if (selectedFilter !== 'all' && selectedFilter !== 'recent') {
          queryParams.set('contentType', selectedFilter);
        }
        if (selectedFilter === 'recent') {
          queryParams.set('recentlyApproved', 'true');
        }
        
        console.log(`Fetching documents with params: ${queryParams.toString()}`);
        
        const response = await fetch(`/api/admin/documents?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch documents: ${response.status} ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error(`Unexpected content type: ${contentType}`);
        }
        
        const data = await response.json() as ApiResponse;
        console.log('API response:', data);
        
        // Store debug information
        setResponseDebug(JSON.stringify(data, null, 2));
        
        // Check if data.documents exists and is an array
        if (data.documents && Array.isArray(data.documents)) {
          setDocuments(data.documents);
          setTotalDocuments(data.total || data.documents.length);
          
          // Extract unique content types with proper type assertion
          const types = [...new Set(data.documents.map((doc: Document) => 
            doc.metadata?.contentType || 'Unknown'
          ))] as string[];
          setContentTypes(types);
          console.log(`Loaded ${data.documents.length} documents with ${types.length} content types`);
        } else {
          console.error('Unexpected API response format:', data);
          setDocuments([]);
          setContentTypes([]);
          setError(`Unexpected API response format: documents array not found (${typeof data} received)`);
        }
        
      } catch (err) {
        console.error('Error fetching documents:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [limit, refreshTrigger, debouncedSearchTerm, selectedFilter]);

  // Handle document deletion
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/documents/${documentId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete document: ${response.status} ${response.statusText}`);
      }
      
      // Refresh document list
      setRefreshTrigger(prev => prev + 1);
      
    } catch (err) {
      console.error('Error deleting document:', err);
      alert(err instanceof Error ? err.message : 'Unknown error deleting document');
    }
  };

  // Handle batch document deletion
  const handleBatchDelete = async () => {
    if (selectedDocumentIds.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedDocumentIds.length} document(s)?`)) {
      return;
    }
    
    try {
      setIsBatchDeleting(true);
      
      // Make a batch delete request
      const response = await fetch('/api/admin/documents/batch-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentIds: selectedDocumentIds }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete documents: ${response.status} ${response.statusText}`);
      }
      
      // Clear selection and refresh
      setSelectedDocumentIds([]);
      setRefreshTrigger(prev => prev + 1);
      
    } catch (err) {
      console.error('Error batch deleting documents:', err);
      alert(err instanceof Error ? err.message : 'Unknown error during batch delete');
    } finally {
      setIsBatchDeleting(false);
    }
  };
  
  // Handle document editing
  const handleEditDocument = (doc: Document) => {
    // Convert the document to the format expected by EditDocumentModal
    const documentToEdit: DocumentToEdit = {
      id: doc.id,
      text: doc.text,
      metadata: { ...doc.metadata }
    };
    
    setEditingDocument({
      document: doc,
      isOpen: true
    });
  };
  
  // Save edited document
  const handleSaveEdit = async (updatedDoc: DocumentToEdit): Promise<void> => {
    if (!editingDocument.document) return;
    
    setSavingEdit(true);
    setError(null);

    try {
      // Call the API to update the document
      console.log('Saving document update:', updatedDoc.id);
      const response = await fetch(`/api/admin/documents/${updatedDoc.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: updatedDoc.text,
          metadata: updatedDoc.metadata
        })
      });

      // Get the response data
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Error response from server:', responseData);
        throw new Error(responseData.error?.message || 'Failed to update document');
      }

      console.log('Document saved successfully:', responseData);
      
      // Refresh the documents list to show the updated document after a small delay
      // to ensure server has time to process the update
      setTimeout(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 500);
      
      // Close the modal
      setEditingDocument({ document: null, isOpen: false });
      
      // Show success message
      alert(`Document ${updatedDoc.id} updated successfully. The document's embedding has been updated for search.`);
    } catch (err) {
      console.error('Error updating document:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while updating the document';
      setError(errorMessage);
      alert(`Error: ${errorMessage}\nPlease try again or check the console for more details.`);
    } finally {
      setSavingEdit(false);
    }
  };
  
  // Cancel editing
  const handleCancelEdit = () => {
    setEditingDocument({ document: null, isOpen: false });
    setEditedText('');
    setEditedMetadata({});
  };

  // Toggle document selection for batch operations
  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocumentIds(prev => 
      prev.includes(documentId)
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };
  
  // Toggle all documents selection
  const toggleAllDocuments = () => {
    if (selectedDocumentIds.length === documents.length) {
      // Deselect all
      setSelectedDocumentIds([]);
    } else {
      // Select all
      setSelectedDocumentIds(documents.map(doc => doc.id));
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setRefreshTrigger(prev => prev + 1);
  };

  // Truncate text for preview
  const truncateText = (text: string, maxLength: number = 200): string => {
    if (!text) return 'No text available';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Format date
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Unknown';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Render metadata editor fields
  const renderMetadataEditor = () => {
    if (!editingDocument.document) return null;
    
    const metadataFields = Object.entries(editedMetadata)
      .filter(([key]) => 
        // Only show editable metadata fields (exclude system fields)
        !['source', 'id', 'embedding'].includes(key)
      );
    
    return (
      <div className="mt-4">
        <h3 className="text-lg font-medium mb-2">Metadata</h3>
        <div className="space-y-3">
          {metadataFields.map(([key, value]) => (
            <div key={key} className="grid grid-cols-3 gap-2">
              <label className="text-sm font-medium text-gray-700 col-span-1">
                {key}:
              </label>
              <input
                type="text"
                value={typeof value === 'string' ? value : JSON.stringify(value)}
                onChange={(e) => setEditedMetadata({
                  ...editedMetadata,
                  [key]: e.target.value
                })}
                className="col-span-2 border border-gray-300 rounded-md text-sm px-3 py-1.5"
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading && documents.length === 0) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
        <p className="text-center text-gray-500 mt-4">Loading documents...</p>
      </div>
    );
  }

  if (error && documents.length === 0) {
    return (
      <div className="p-6 bg-white rounded-lg shadow border-l-4 border-red-500">
        <h3 className="text-lg font-medium text-red-800">Error Loading Documents</h3>
        <p className="mt-2 text-red-600">{error}</p>
        {responseDebug && (
          <div className="mt-4">
            <details>
              <summary className="cursor-pointer text-sm text-gray-600">Debug Information</summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-48">{responseDebug}</pre>
            </details>
          </div>
        )}
        <button 
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const recentlyApprovedCount = documents.filter(isRecentlyApproved).length;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="font-medium text-gray-800 flex items-center">
          <FileText className="h-5 w-5 mr-2 text-primary-600" />
          Document Management {totalDocuments > 0 && `(${totalDocuments} total)`}
          {recentlyApprovedCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              {recentlyApprovedCount} new
            </span>
          )}
        </h2>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <form onSubmit={handleSearch} className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search documents..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </form>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none"
            >
              <option value="all">All Types</option>
              <option value="recent">Recently Added</option>
              {contentTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={handleRefresh}
            className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 transition"
            title="Refresh documents"
          >
            <RefreshCw className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Batch Operations Bar - Only show when documents are selected */}
      {selectedDocumentIds.length > 0 && (
        <div className="sticky bottom-0 left-0 right-0 bg-blue-50 border-t border-blue-200 p-3 flex justify-between items-center">
          <div className="flex items-center">
            <span className="font-medium text-blue-800">
              {selectedDocumentIds.length} document(s) selected
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedDocumentIds([])}
              className="px-3 py-1 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleBatchDelete}
              disabled={isBatchDeleting}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {isBatchDeleting ? 'Deleting...' : 'Delete Selected'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-6 bg-white rounded-lg shadow">
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
          <p className="text-center text-gray-500 mt-4">Loading documents...</p>
        </div>
      ) : error && documents.length === 0 ? (
        <div className="p-6 bg-white rounded-lg shadow border-l-4 border-red-500">
          <h3 className="text-lg font-medium text-red-800">Error Loading Documents</h3>
          <p className="mt-2 text-red-600">{error}</p>
          {responseDebug && (
            <div className="mt-4">
              <details>
                <summary className="cursor-pointer text-sm text-gray-600">Debug Information</summary>
                <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-48">{responseDebug}</pre>
              </details>
            </div>
          )}
          <button 
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
          >
            Retry
          </button>
        </div>
      ) : documents.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          {debouncedSearchTerm ? `No documents found matching "${debouncedSearchTerm}"` : 'No documents found in the vector store.'}
          {responseDebug && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-gray-600">Debug Information</summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-48">{responseDebug}</pre>
            </details>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-3 w-6">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={documents.length > 0 && selectedDocumentIds.length === documents.length}
                    onChange={toggleAllDocuments}
                  />
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Content Preview
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documents.map((doc) => {
                const isNew = isRecentlyApproved(doc);
                const isSelected = selectedDocumentIds.includes(doc.id);
                
                return (
                  <tr key={doc.id} className={`hover:bg-gray-50 ${isNew ? 'bg-green-50' : ''} ${isSelected ? 'bg-blue-50' : ''}`}>
                    <td className="px-2 py-4 whitespace-nowrap">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleDocumentSelection(doc.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        {isNew && (
                          <span className="mr-2 flex-shrink-0 h-2 w-2 rounded-full bg-green-500" title="Recently added"></span>
                        )}
                        <span>
                          {doc.source}
                          {doc.metadata?.page && <span className="text-gray-500 ml-1">p.{doc.metadata.page}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">
                      {truncateText(doc.text)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {doc.metadata?.contentType || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(doc.metadata?.lastUpdated)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEditDocument(doc)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit document"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete document"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-sm text-gray-500">
        Showing {documents.length} of {totalDocuments} documents
      </div>
      
      {/* Document Edit Modal */}
      <EditDocumentModal 
        isOpen={editingDocument.isOpen}
        onClose={handleCancelEdit}
        document={
          editingDocument.document 
            ? {
                id: editingDocument.document.id,
                text: editingDocument.document.text,
                metadata: { ...editingDocument.document.metadata }
              } 
            : null
        }
        onSave={handleSaveEdit}
      />
    </div>
  );
} 
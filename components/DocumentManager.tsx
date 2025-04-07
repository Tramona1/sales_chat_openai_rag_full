import React, { useState, useEffect } from 'react';
import { Search, Trash2, FileText, RefreshCw, Filter } from 'lucide-react';

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
  };
}

interface ApiResponse {
  documents: Document[];
  total: number;
  limit: number;
}

export default function DocumentManager({ limit = 50 }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [totalDocuments, setTotalDocuments] = useState<number>(0);
  const [responseDebug, setResponseDebug] = useState<string | null>(null);

  // Fetch documents from the API
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        console.log(`Fetching documents with limit ${limit}...`);
        
        const response = await fetch(`/api/admin/documents${limit ? `?limit=${limit}` : ''}`);
        
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
  }, [limit, refreshTrigger]);

  // Filter documents based on search term and selected filter
  const filteredDocuments = documents.filter(doc => {
    try {
      const matchesSearch = searchTerm.trim() === '' || 
        doc.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.source.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = selectedFilter === 'all' || 
        doc.metadata?.contentType === selectedFilter;
      
      return matchesSearch && matchesFilter;
    } catch (err) {
      console.error('Error filtering document:', doc, err);
      return false;
    }
  });

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

  // Handle refresh
  const handleRefresh = () => {
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

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="font-medium text-gray-800 flex items-center">
          <FileText className="h-5 w-5 mr-2 text-primary-600" />
          Document Management {totalDocuments > 0 && `(${totalDocuments} total)`}
        </h2>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search documents..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none"
            >
              <option value="all">All Types ({documents.length})</option>
              {contentTypes.map((type) => {
                const count = documents.filter(doc => doc.metadata?.contentType === type).length;
                return (
                  <option key={type} value={type}>{type} ({count})</option>
                );
              })}
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

      {documents.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No documents found in the vector store.
          {responseDebug && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-gray-600">Debug Information</summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-48">{responseDebug}</pre>
            </details>
          )}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No documents match your search criteria.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
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
              {filteredDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {doc.source}
                    {doc.metadata?.page && <span className="text-gray-500 ml-1">p.{doc.metadata.page}</span>}
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
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete document"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-sm text-gray-500">
        Showing {filteredDocuments.length} of {documents.length} documents
        {documents.length < totalDocuments && ` (${totalDocuments} total available)`}
      </div>
    </div>
  );
} 
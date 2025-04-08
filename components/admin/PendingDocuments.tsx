import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import Chip from '../ui/Chip';
import CircularProgress from '../ui/CircularProgress';
import Dialog from '../ui/Dialog';
import Divider from '../ui/Divider';
import Select from '../ui/Select';
import Paper from '../ui/Paper';
import Box from '../ui/Box';
import Typography from '../ui/Typography';
import Alert from '../ui/Alert';
import DataGrid from '../ui/DataGrid';
import TextField from '../ui/TextField';
import { DocumentCategory, QualityFlag } from '../../types/metadata';

// Interface for value formatter params
interface GridValueFormatterParams {
  value: any;
  field: string;
  api: any;
  id: string | number;
}

interface PendingDocument {
  id: string;
  url: string;
  title: string;
  contentPreview: string;
  content?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  metadata?: {
    primaryCategory?: string;
    technicalLevel?: number;
    categories?: string[];
    keywords?: string[];
    summary?: string;
    secondaryCategories?: string[];
    industryCategories?: string[];
    functionCategories?: string[];
    useCases?: string[];
    entities?: string;
  };
}

interface DialogState {
  open: boolean;
  documentIds: string[];
  action: 'approve' | 'reject' | null;
}

interface ConflictInfo {
  hasConflicts: boolean;
  conflictingDocs: string[];
}

const PendingDocuments = () => {
  // Component state
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dialogState, setDialogState] = useState<DialogState>({
    open: false,
    documentIds: [],
    action: null
  });
  const [processResult, setProcessResult] = useState<{ success: boolean; message: string; documentsProcessed?: number } | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo>({
    hasConflicts: false,
    conflictingDocs: []
  });
  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalDocs, setTotalDocs] = useState(0);
  
  // Load pending documents
  useEffect(() => {
    fetchPendingDocuments();
  }, [page, pageSize]);
  
  const fetchPendingDocuments = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page + 1),
        limit: String(pageSize),
      });
      
      const response = await fetch(`/api/admin/pending?${queryParams.toString()}`);
      const data = await response.json();
      
      if (data && data.documents) {
        setDocuments(data.documents);
        setTotalDocs(data.total);
      }
    } catch (error) {
      console.error('Error fetching pending documents:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle document selection
  const handleSelectDocuments = (newSelection: string[]) => {
    // Reset previous result when selection changes
    setProcessResult(null);
    setConflicts({
      hasConflicts: false,
      conflictingDocs: []
    });
    setSelectedDocuments(newSelection);
  };
  
  // Open approval/rejection dialog
  const handleOpenDialog = (action: 'approve' | 'reject') => {
    if (selectedDocuments.length === 0) return;
    
    setDialogState({
      open: true,
      documentIds: selectedDocuments,
      action
    });
  };
  
  // Close dialog
  const handleCloseDialog = () => {
    setDialogState({
      ...dialogState,
      open: false
    });
  };
  
  // Process approval/rejection
  const handleConfirmAction = async () => {
    if (!dialogState.action || dialogState.documentIds.length === 0) return;
    
    try {
      setLoading(true);
      handleCloseDialog();
      
      const endpoint = dialogState.action === 'approve' 
        ? '/api/admin/documents/approve' 
        : '/api/admin/documents/reject';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentIds: dialogState.documentIds
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        if (result.conflicts) {
          setConflicts({
            hasConflicts: true,
            conflictingDocs: result.conflicts
          });
        }
        throw new Error(result.message || 'Failed to process documents');
      }
      
      setProcessResult({
        success: true,
        message: result.message || `Documents ${dialogState.action}d successfully`,
        documentsProcessed: result.documentsProcessed
      });
      
      // Refresh the list after successful action
      fetchPendingDocuments();
      // Clear selection
      setSelectedDocuments([]);
      
    } catch (error) {
      console.error(`Error ${dialogState.action}ing documents:`, error);
      setProcessResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // DataGrid columns
  const columns = [
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'title', headerName: 'Title', width: 200 },
    { field: 'url', headerName: 'URL', width: 300 },
    { 
      field: 'contentPreview', 
      headerName: 'Content Preview', 
      width: 400,
      renderCell: (params: { row: any; value: any }) => {
        const content = params.value?.toString() || '';
        return content.length > 100 ? `${content.substring(0, 100)}...` : content;
      }
    },
    { 
      field: 'createdAt', 
      headerName: 'Created', 
      width: 180,
      renderCell: (params: { row: any; value: any }) => {
        return new Date(params.value as string).toLocaleString();
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (params: { row: any; value: any }) => (
        <div className="flex gap-1">
          <Button 
            size="small" 
            variant="primary"
            onClick={(event?: React.MouseEvent<HTMLButtonElement>) => {
              event?.stopPropagation();
              setSelectedDocuments([params.row.id]);
              handleOpenDialog('approve');
            }}
          >
            Approve AI Tags
          </Button>
          <Button 
            size="small" 
            variant="error"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              setSelectedDocuments([params.row.id]);
              handleOpenDialog('reject');
            }}
          >
            Reject
          </Button>
        </div>
      ),
    },
  ];

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'PRODUCT', label: 'Product' },
    { value: 'TECHNICAL', label: 'Technical' },
    { value: 'FEATURES', label: 'Features' },
    { value: 'PRICING', label: 'Pricing' },
    { value: 'COMPARISON', label: 'Comparison' },
    { value: 'CUSTOMER_CASE', label: 'Customer Case' },
    { value: 'GENERAL', label: 'General' }
  ];

  // Dialog actions for confirm dialog
  const dialogActions = (
    <>
      <Button onClick={handleCloseDialog} variant="secondary">
        Cancel
      </Button>
      <Button 
        onClick={handleConfirmAction} 
        variant={dialogState.action === 'approve' ? 'primary' : 'error'}
        autoFocus
      >
        Confirm {dialogState.action}
      </Button>
    </>
  );

  return (
    <div className="space-y-4">
      <Box display="flex" justifyContent="space-between" alignItems="center" className="mb-2">
        <Typography variant="h5" className="font-semibold">
          Pending Documents Review
        </Typography>
        
        <Box display="flex" gap={2}>
          {selectedDocuments.length > 0 && (
            <>
              <Button 
                variant="primary"
                onClick={() => handleOpenDialog('approve')}
                size="small"
              >
                Approve Selected with AI Tags
              </Button>
              <Button 
                variant="error"
                onClick={() => handleOpenDialog('reject')}
                size="small"
              >
                Reject Selected
              </Button>
            </>
          )}
        </Box>
      </Box>
      
      {/* Results notification */}
      {processResult && (
        <Alert 
          severity={processResult.success ? "success" : "error"}
          className="mb-4"
          onClose={() => setProcessResult(null)}
        >
          {processResult.message}
          {processResult.documentsProcessed && ` (${processResult.documentsProcessed} documents processed)`}
        </Alert>
      )}
      
      {/* Conflicts notification */}
      {conflicts.hasConflicts && (
        <Alert 
          severity="warning"
          className="mb-4"
          onClose={() => setConflicts({ hasConflicts: false, conflictingDocs: [] })}
        >
          Conflicts detected with {conflicts.conflictingDocs.length} documents. 
          Please review and try again.
        </Alert>
      )}

      {/* Admin role explanation */}
      <Alert severity="info" className="mb-4">
        <strong>Automatic Document Tagging:</strong> All uploaded documents are automatically tagged by Gemini AI. 
        Your role is to review the document content and AI-generated tags, then either approve or reject.
      </Alert>

      {/* Category filter */}
      <div className="mb-4">
        <Box display="flex" alignItems="center" gap={2}>
          <Box width="300px">
            <Select
              label="Category"
              value={selectedDocuments.length > 0 ? documents.find(d => d.id === selectedDocuments[0])?.metadata?.primaryCategory || 'all' : 'all'}
              onChange={(value) => handleSelectDocuments(value === 'all' ? [] : [value])}
              options={categoryOptions}
              fullWidth
            />
          </Box>
        </Box>
      </div>
      
      {/* DataGrid with pending documents */}
      <Paper className="shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input 
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleSelectDocuments(documents.map(d => d.id));
                      } else {
                        handleSelectDocuments([]);
                      }
                    }}
                    checked={selectedDocuments.length > 0 && selectedDocuments.length === documents.length}
                  />
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <CircularProgress />
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No pending documents found
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr 
                    key={doc.id} 
                    className={`hover:bg-gray-50 ${selectedDocuments.includes(doc.id) ? 'bg-blue-50' : ''}`}
                    onClick={() => {
                      if (selectedDocuments.includes(doc.id)) {
                        handleSelectDocuments(selectedDocuments.filter(id => id !== doc.id));
                      } else {
                        handleSelectDocuments([...selectedDocuments, doc.id]);
                      }
                    }}
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        checked={selectedDocuments.includes(doc.id)}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            handleSelectDocuments([...selectedDocuments, doc.id]);
                          } else {
                            handleSelectDocuments(selectedDocuments.filter(id => id !== doc.id));
                          }
                        }}
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{doc.id}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{doc.title}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-blue-600 truncate max-w-[200px]">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        {doc.url}
                      </a>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 truncate max-w-[200px]">
                      {doc.contentPreview && doc.contentPreview.length > 100 
                        ? `${doc.contentPreview.substring(0, 100)}...` 
                        : doc.contentPreview}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {new Date(doc.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      <div className="flex space-x-2">
                        <Button 
                          size="small" 
                          variant="primary"
                          onClick={(event?: React.MouseEvent<HTMLButtonElement>) => {
                            event?.stopPropagation();
                            setSelectedDocuments([doc.id]);
                            handleOpenDialog('approve');
                          }}
                        >
                          Approve AI Tags
                        </Button>
                        <Button 
                          size="small" 
                          variant="error"
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation();
                            setSelectedDocuments([doc.id]);
                            handleOpenDialog('reject');
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <Button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              variant="secondary"
              size="small"
            >
              Previous
            </Button>
            <Button
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(totalDocs / pageSize) - 1}
              variant="secondary"
              size="small"
            >
              Next
            </Button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{page * pageSize + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min((page + 1) * pageSize, totalDocs)}
                </span>{' '}
                of <span className="font-medium">{totalDocs}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <Button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  variant="outline"
                  size="small"
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(5, Math.ceil(totalDocs / pageSize)) }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      page === i
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                    type="button"
                  >
                    {i + 1}
                  </button>
                ))}
                <Button
                  onClick={() => setPage(Math.min(Math.ceil(totalDocs / pageSize) - 1, page + 1))}
                  disabled={page >= Math.ceil(totalDocs / pageSize) - 1}
                  variant="outline"
                  size="small"
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Next
                </Button>
              </nav>
            </div>
          </div>
        </div>
      </Paper>
      
      {/* Document Preview */}
      {selectedDocuments.length === 1 && (
        <Card className="mt-4 shadow-sm">
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" className="mb-4">
              <div>
                <Typography variant="h6" className="font-medium">Document Preview</Typography>
                <Typography variant="body2" color="textSecondary">
                  ID: {selectedDocuments[0]}
                </Typography>
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="primary"
                  onClick={() => handleOpenDialog('approve')}
                  size="small"
                >
                  Approve with AI Tags
                </Button>
                <Button 
                  variant="error"
                  onClick={() => handleOpenDialog('reject')}
                  size="small"
                >
                  Reject
                </Button>
              </div>
            </Box>
            
            <Divider className="mb-4" />
            
            <Alert severity="info" className="mb-4">
              <strong>All document tagging is done automatically by Gemini AI.</strong> Your role is to review the content and generated tags for accuracy, then approve or reject the document.
            </Alert>
            
            <MetadataViewer document={documents.find(d => d.id === selectedDocuments[0])!} />
          </CardContent>
        </Card>
      )}
      
      {/* Approval/Rejection Dialog */}
      <Dialog
        open={dialogState.open}
        onClose={handleCloseDialog}
        title={dialogState.action === 'approve' ? 'Approve Documents with AI Tagging' : 'Reject Documents'}
        actions={dialogActions}
      >
        <p className="text-gray-700">
          Are you sure you want to {dialogState.action} {dialogState.documentIds.length} selected document(s)?
          {dialogState.action === 'approve' && " This will process and index them for search using the AI-generated tags."}
          {dialogState.action === 'reject' && " This will remove them from the pending queue."}
        </p>
        {dialogState.action === 'approve' && (
          <Alert severity="info" className="mt-3">
            Documents are automatically tagged by Gemini AI. Approving will accept these AI-generated tags without modification.
          </Alert>
        )}
      </Dialog>
    </div>
  );
};

const MetadataViewer = ({ document }: { document: PendingDocument }) => {
  if (!document.metadata) return <p>No metadata available</p>;
  
  const {
    primaryCategory,
    technicalLevel,
    summary,
    keywords = [],
    secondaryCategories = [],
    industryCategories = [],
    functionCategories = [],
    useCases = [],
    entities,
  } = document.metadata;
  
  // Parse entities from JSON string if needed
  let parsedEntities: any = {};
  try {
    if (typeof entities === 'string') {
      parsedEntities = JSON.parse(entities);
    } else if (entities) {
      parsedEntities = entities;
    }
  } catch (e) {
    console.error('Error parsing entities', e);
  }
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="bg-blue-50 p-4 border-b">
        <h3 className="text-lg font-medium text-blue-800">AI-Generated Metadata</h3>
        <p className="text-sm text-gray-600">
          These tags were automatically generated by Gemini AI and determine how this document will be found in searches
        </p>
      </div>
      
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Primary metadata */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-500">Primary Category</label>
            <span className="mt-1 text-sm text-gray-900 bg-blue-50 px-2 py-1 rounded inline-block">
              {primaryCategory || 'Uncategorized'}
            </span>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-500">Technical Level</label>
            <div className="mt-1 flex items-center">
              <div className="relative w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-blue-600"
                  style={{ width: `${(technicalLevel || 1) * 10}%` }}
                ></div>
              </div>
              <span className="ml-2 text-sm text-gray-700">
                {technicalLevel || 1}/10
              </span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-500">Summary</label>
            <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded">
              {summary || document.contentPreview}
            </p>
          </div>
        </div>
        
        {/* Category hierarchy */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-500">Secondary Categories</label>
            <div className="mt-1 flex flex-wrap gap-1">
              {secondaryCategories.length > 0 ? (
                secondaryCategories.map((cat) => (
                  <span key={cat} className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                    {cat}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-500">None</span>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-500">Industry Categories</label>
            <div className="mt-1 flex flex-wrap gap-1">
              {industryCategories.length > 0 ? (
                industryCategories.map((cat) => (
                  <span key={cat} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                    {cat}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-500">None</span>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-500">Function Categories</label>
            <div className="mt-1 flex flex-wrap gap-1">
              {functionCategories.length > 0 ? (
                functionCategories.map((cat) => (
                  <span key={cat} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    {cat}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-500">None</span>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-500">Use Cases</label>
            <div className="mt-1 flex flex-wrap gap-1">
              {useCases.length > 0 ? (
                useCases.map((uc) => (
                  <span key={uc} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                    {uc}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-500">None</span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Entities and keywords */}
      <div className="px-4 pb-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-500">Entities</label>
          <div className="mt-1 grid grid-cols-1 md:grid-cols-3 gap-2">
            {/* People */}
            <div>
              <label className="block text-xs font-medium text-gray-400">People</label>
              <ul className="mt-1 text-xs text-gray-900">
                {parsedEntities.people && parsedEntities.people.length > 0 ? (
                  parsedEntities.people.map((person: any, idx: number) => (
                    <li key={idx} className="bg-red-50 px-2 py-1 mb-1 rounded">
                      {typeof person === 'string' ? person : person.name}
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500">None</li>
                )}
              </ul>
            </div>
            
            {/* Companies */}
            <div>
              <label className="block text-xs font-medium text-gray-400">Companies</label>
              <ul className="mt-1 text-xs text-gray-900">
                {parsedEntities.companies && parsedEntities.companies.length > 0 ? (
                  parsedEntities.companies.map((company: any, idx: number) => (
                    <li key={idx} className="bg-blue-50 px-2 py-1 mb-1 rounded">
                      {typeof company === 'string' ? company : company.name}
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500">None</li>
                )}
              </ul>
            </div>
            
            {/* Products */}
            <div>
              <label className="block text-xs font-medium text-gray-400">Products</label>
              <ul className="mt-1 text-xs text-gray-900">
                {parsedEntities.products && parsedEntities.products.length > 0 ? (
                  parsedEntities.products.map((product: any, idx: number) => (
                    <li key={idx} className="bg-green-50 px-2 py-1 mb-1 rounded">
                      {typeof product === 'string' ? product : product.name}
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500">None</li>
                )}
              </ul>
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-500">Keywords</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {Array.isArray(keywords) && keywords.length > 0 ? (
              keywords.map((keyword, idx) => (
                <span key={idx} className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                  {keyword}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-500">None</span>
            )}
          </div>
        </div>
      </div>
      
      <div className="bg-yellow-50 p-3 border-t border-yellow-100">
        <p className="text-xs text-yellow-800">
          <strong>Note:</strong> All tags are automatically generated by Gemini AI.
          Your role is to review the document content and ensure the AI-generated tags are appropriate before approval.
        </p>
      </div>
    </div>
  );
};

export default PendingDocuments; 
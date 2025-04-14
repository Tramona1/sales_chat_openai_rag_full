import React, { useState, useEffect, useCallback } from 'react';
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
import { XCircle as CloseIcon } from 'react-feather';
import { parseEntities } from '../../utils/metadataUtils';
import { debounce, get } from 'lodash';
import { parseTagInput, normalizeTags, STANDARD_CATEGORIES, getCategoryFilterOptions, getCategoryLabel } from '../../utils/tagUtils';

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
  const [processResult, setProcessResult] = useState<{ success: boolean; message: string; documentsProcessed?: number } | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo>({
    hasConflicts: false,
    conflictingDocs: []
  });
  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalDocs, setTotalDocs] = useState(0);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [selectedDocument, setSelectedDocument] = useState<PendingDocument | null>(null);
  const [editedMetadata, setEditedMetadata] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [secondaryCategoryFilter, setSecondaryCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Debounced fetch function
  const debouncedFetch = useCallback(debounce(fetchPendingDocuments, 300), []);

  // Load pending documents
  useEffect(() => {
    // Call debounced fetch on relevant state changes
    debouncedFetch(page, pageSize, selectedCategory, secondaryCategoryFilter, searchTerm);
    // Cleanup debounce timer on unmount
    return debouncedFetch.cancel;
  }, [page, pageSize, selectedCategory, secondaryCategoryFilter, searchTerm, debouncedFetch]);
  
  // Modified fetch function to accept filters
  async function fetchPendingDocuments(currentPage = page, currentPageSize = pageSize, category = selectedCategory, secondaryCategory = secondaryCategoryFilter, search = searchTerm) {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(currentPage + 1),
        limit: String(currentPageSize),
        category: category,
        secondaryCategory: secondaryCategory,
        search: search,
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
  }
  
  // Handle document selection
  const handleSelectDocuments = (newSelection: string[]) => {
    setProcessResult(null);
    setConflicts({ hasConflicts: false, conflictingDocs: [] });
    setSelectedDocuments(newSelection);
  };
  
  // NEW function to handle direct approval/rejection from top buttons
  const handleConfirmActionDirectly = async (action: 'approve' | 'reject') => {
    const documentIds = selectedDocuments;
    if (!action || documentIds.length === 0) return;

    try {
      setLoading(true);
      const endpoint = action === 'approve'
        ? '/api/admin/documents/approve'
        : '/api/admin/documents/reject';

      const body: { documentIds: string[], reviewerComments?: string } = { documentIds };
      if (action === 'reject') {
          body.reviewerComments = "Rejected in batch by admin.";
          // TODO: Consider adding a prompt for rejection comments in batch mode
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.conflicts) {
          setConflicts({ hasConflicts: true, conflictingDocs: result.conflicts });
        }
        throw new Error(result.message || `Failed to ${action} documents`);
      }

      setProcessResult({
        success: true,
        message: result.message || `Documents ${action}d successfully`,
        documentsProcessed: result.documentsProcessed || documentIds.length
      });

      fetchPendingDocuments(); // Refresh list
      setSelectedDocuments([]); // Clear selection

    } catch (error) {
      console.error(`Error ${action}ing documents directly:`, error);
      setProcessResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // NEW function to handle REJECTING a SINGLE document from its row button
  const handleRejectSingleDocument = async (docId: string) => {
    // Optionally add a confirmation dialog here if desired for single reject
    // const confirmed = window.confirm('Are you sure you want to reject this document?');
    // if (!confirmed) return;

    try {
      setLoading(true);
      const endpoint = '/api/admin/documents/reject';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: [docId],
          reviewerComments: "Rejected via row action" // Or prompt/use default
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Failed to reject document ${docId}`);
      }

      setProcessResult({
        success: true,
        message: result.message || `Document ${docId} rejected successfully`,
        documentsProcessed: 1
      });

      fetchPendingDocuments(); // Refresh list
      // DO NOT modify selectedDocuments here

    } catch (error) {
      console.error(`Error rejecting document ${docId}:`, error);
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
    { 
      field: 'metadata.primaryCategory',
      headerName: 'Primary Category', 
      width: 160,
      renderCell: (params: { row: any; value: any }) => (
        <Chip label={get(params.row, 'metadata.primaryCategory', 'N/A')} size="small" />
      )
    },
    { field: 'title', headerName: 'Title', width: 230 },
    { field: 'url', headerName: 'URL', width: 230 },
    { 
      field: 'contentPreview', 
      headerName: 'Content Preview', 
      width: 280,
      renderCell: (params: { row: any; value: any }) => {
        const content = get(params.row, 'contentPreview', '').toString();
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
      width: 220,
      renderCell: (params: { row: any; value: any }) => (
        <div className="flex gap-1">
          <Button
            size="small"
            variant="primary"
            onClick={(event?: React.MouseEvent<HTMLButtonElement>) => {
              event?.stopPropagation();
              handleOpenPreview(params.row.id);
            }}
            disabled={loading}
          >
            Review & Approve
          </Button>
          <Button
            size="small"
            variant="error"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              handleRejectSingleDocument(params.row.id);
            }}
            disabled={loading}
          >
            Reject
          </Button>
        </div>
      ),
    },
  ];

  const categoryOptions = getCategoryFilterOptions();

  // Handle opening the preview modal
  const handleOpenPreview = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (doc) {
      setSelectedDocument(doc);
      setEditedMetadata(doc.metadata && typeof doc.metadata === 'object' ? {...doc.metadata} : {});
      setPreviewOpen(true);
    }
  };

  // Handle metadata changes in the preview modal
  const handleMetadataChange = (field: string, value: any) => {
    if (editedMetadata) {
      setEditedMetadata({
        ...editedMetadata,
        [field]: value
      });
    }
  };

  // NEW function to handle approval from the preview modal
  const handleConfirmApprovalFromModal = async () => {
    if (!selectedDocument) return;
    const documentId = selectedDocument.id;

    try {
      setLoading(true);
      setPreviewOpen(false); // Close modal immediately

      const endpoint = '/api/admin/documents/approve';
      // Prepare body, potentially include edited metadata if API supports it later
      const body: { documentIds: string[], metadata?: any } = { documentIds: [documentId] };
      // if (editedMetadata) { body.metadata = editedMetadata; } // Example for future API enhancement

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (!response.ok) {
         if (result.conflicts) {
           setConflicts({ hasConflicts: true, conflictingDocs: result.conflicts });
         }
         // Check specifically for the constraint violation error if possible
         if (result.error && result.error.includes('violates not-null constraint')) {
            throw new Error('Database error: Failed to insert document chunk. Please check server logs.');
         } else {
            throw new Error(result.message || 'Failed to approve document');
         }
      }

       setProcessResult({
         success: true,
         message: result.message || `Document ${documentId} approved successfully`,
         documentsProcessed: 1
       });

      fetchPendingDocuments(); // Refresh list
      setSelectedDocuments([]); // Clear selection

    } catch (error) {
      console.error(`Error approving document ${documentId} from modal:`, error);
      setProcessResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setLoading(false);
      setSelectedDocument(null); // Clear selected document
      setEditedMetadata(null);
    }
  };

  // Handle category filter change
  const handleCategoryChange = (value: string) => {
      setSelectedCategory(value);
      setPage(0); // Reset to first page when filter changes
      // fetchPendingDocuments will be triggered by useEffect
  };

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
                onClick={() => handleConfirmActionDirectly('approve')}
                size="small"
                disabled={loading}
              >
                Approve Selected ({selectedDocuments.length})
              </Button>
              <Button
                variant="error"
                onClick={() => handleConfirmActionDirectly('reject')}
                size="small"
                disabled={loading}
              >
                Reject Selected ({selectedDocuments.length})
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

      {/* --- FILTERS --- */} 
      <div className="mb-4 flex space-x-4 items-start">
          {/* Category filter */}
          <Box width="300px" className="relative z-20">
            <Select
              label="Filter by Primary Category"
              value={selectedCategory}
              onChange={(value) => {
                setSelectedCategory(value);
                setPage(0); // Reset page
              }}
              options={categoryOptions}
              fullWidth
            />
          </Box>
          {/* Secondary Category Filter - Added */}
          <Box width="300px" className="relative z-10">
            <Select
              label="Filter by Secondary Category"
              value={secondaryCategoryFilter}
              onChange={(value) => {
                setSecondaryCategoryFilter(value);
                setPage(0); // Reset page
              }}
              options={getCategoryFilterOptions()}
              fullWidth
            />
          </Box>
      </div>
      
      {/* DataGrid with pending documents */}
      <Paper className="shadow-sm overflow-hidden">
        <div className="overflow-x-auto border-b border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input 
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    onChange={(e) => {
                      const currentPageIds = documents.map(d => d.id);
                      if (e.target.checked) {
                        handleSelectDocuments([...new Set([...selectedDocuments, ...currentPageIds])]);
                      } else {
                        handleSelectDocuments(selectedDocuments.filter(id => !currentPageIds.includes(id)));
                      }
                    }}
                    checked={documents.length > 0 && documents.every(d => selectedDocuments.includes(d.id))}
                    ref={el => {
                      if (el) {
                        const someSelected = documents.some(d => selectedDocuments.includes(d.id));
                        const allSelected = documents.length > 0 && documents.every(d => selectedDocuments.includes(d.id));
                        el.indeterminate = someSelected && !allSelected;
                      }
                    }}
                  />
                </th>
                {columns.map((col) => (
                   <th key={col.field} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ width: col.width }}>
                      {col.headerName}
                   </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center">
                    <CircularProgress />
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                    No pending documents found
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr 
                    key={doc.id} 
                    className={`hover:bg-gray-50 ${selectedDocuments.includes(doc.id) ? 'bg-blue-50' : ''}`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button, a')) { 
                        return;
                      }
                      const isChecked = e.target instanceof HTMLInputElement && e.target.checked;
                      handleSelectDocuments(
                        isChecked 
                          ? [...selectedDocuments, doc.id] 
                          : selectedDocuments.filter(id => id !== doc.id)
                      );
                    }}
                  >
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 whitespace-nowrap">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        checked={selectedDocuments.includes(doc.id)}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          e.stopPropagation();
                          const isChecked = e.target.checked;
                          handleSelectDocuments(
                            isChecked 
                              ? [...selectedDocuments, doc.id] 
                              : selectedDocuments.filter(id => id !== doc.id)
                          );
                        }}
                      />
                    </td>
                    {columns.map((col: any) => (
                         <td key={`${doc.id}-${col.field}`} className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 overflow-hidden text-ellipsis" style={{ maxWidth: col.width }}>
                             {col.renderCell 
                                ? col.renderCell({ row: doc, value: get(doc, col.field) }) 
                                : (get(doc, col.field, '') as React.ReactNode)
                            }
                         </td>
                     ))}
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
      
      {/* Document Preview Modal - Adjust maxWidth */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Document Preview & AI-Generated Metadata"
        maxWidth="2xl"
        actions={
          <>
            <Button variant="secondary" onClick={() => setPreviewOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmApprovalFromModal}
              disabled={loading}
            >
              Approve Document
            </Button>
          </>
        }
      >
        {selectedDocument && (
          <div className="space-y-4">
            <Alert severity="info">
              <strong>All document tagging is done automatically by Gemini AI.</strong> You can review and edit the metadata below before approving the document.
            </Alert>
            
            <EditableMetadataViewer 
              document={selectedDocument} 
              editedMetadata={editedMetadata} 
              onChange={handleMetadataChange} 
            />
          </div>
        )}
        {loading && <CircularProgress />}
      </Dialog>
    </div>
  );
};

const EditableMetadataViewer = ({ 
  document, 
  editedMetadata, 
  onChange 
}: { 
  document: PendingDocument; 
  editedMetadata: any;
  onChange: (field: string, value: any) => void;
}) => {
  if (!editedMetadata) return <p>No metadata available</p>;
  
  // Safely extract properties from editedMetadata
  const primaryCategory = editedMetadata.primaryCategory || '';
  const technicalLevel = editedMetadata.technicalLevel || 5;
  const summary = editedMetadata.summary || '';
  const keywords = editedMetadata.keywords || [];
  const secondaryCategories = editedMetadata.secondaryCategories || [];
  const industryCategories = editedMetadata.industryCategories || [];
  const functionCategories = editedMetadata.functionCategories || [];
  const useCases = editedMetadata.useCases || [];
  const entities = editedMetadata.entities || '';
  
  // Use our utility function to parse entities
  const parsedEntities = parseEntities(entities);
  
  // Group entities by type for display
  const groupedEntities = {
    people: parsedEntities.filter(e => e.type?.toLowerCase() === 'person'),
    companies: parsedEntities.filter(e => e.type?.toLowerCase() === 'organization'),
    products: parsedEntities.filter(e => e.type?.toLowerCase() === 'product'),
    features: parsedEntities.filter(e => e.type?.toLowerCase() === 'feature')
  };

  const [selectedSecondaryCategory, setSelectedSecondaryCategory] = useState<string>('');

  // Modify the component to handle secondary categories and keywords consistently
  const handleArrayChange = (field: string, inputValue: string) => {
    // If adding a single value (e.g., from Select)
    if (inputValue && !inputValue.includes(',')) {
      const newValue = inputValue.trim().toUpperCase().replace(/\s+/g, '_');
      if (!newValue) return;
      let currentArray = editedMetadata[field] || [];
      // Add only if it's a valid category and not already present
      if (STANDARD_CATEGORIES.some(cat => cat.value === newValue) && !currentArray.includes(newValue)) {
         const combinedArray = normalizeTags([...currentArray, newValue]);
         onChange(field, combinedArray);
      }
      return; // Added single value, exit
    }

    // If using comma-separated input (for keywords)
    if (!inputValue.trim()) return;
    const newValues = parseTagInput(inputValue);
    if (newValues.length === 0) return;
    let currentArray = editedMetadata[field] || [];
    const combinedArray = normalizeTags([...currentArray, ...newValues]);
    onChange(field, combinedArray);
  };

  // Handler specifically for adding from the Secondary Category dropdown
  const handleAddSecondaryCategory = () => {
    if (selectedSecondaryCategory) {
       handleArrayChange('secondaryCategories', selectedSecondaryCategory);
       setSelectedSecondaryCategory(''); // Reset dropdown after adding
    }
  };

  // Filter out already selected categories from dropdown options
  const availableSecondaryCategories = STANDARD_CATEGORIES.filter(
    cat => !secondaryCategories.includes(cat.value)
  );
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-500">Document Summary</label>
          <TextField
            multiline
            rows={3}
            fullWidth
            value={summary || ''}
            onChange={(e) => onChange('summary', e.target.value)}
            placeholder="Enter document summary"
            variant="outlined"
            className="mt-1"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">Primary Category</label>
            <Select
              value={primaryCategory || ''}
              onChange={(value) => onChange('primaryCategory', value)}
              options={STANDARD_CATEGORIES}
              className="mt-1"
              fullWidth
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-500">Technical Level (1-10)</label>
            <TextField
              type="number"
              min={1}
              max={10}
              value={technicalLevel || 5}
              onChange={(e) => onChange('technicalLevel', parseInt(e.target.value, 10))}
              className="mt-1"
              fullWidth
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-500">Secondary Categories</label>
            <div className="mt-1 flex flex-wrap gap-1 items-start">
              {secondaryCategories.length > 0 && secondaryCategories.map((cat: string, idx: number) => (
                <Chip 
                  key={idx} 
                  label={getCategoryLabel(cat)}
                  onDelete={() => {
                    onChange('secondaryCategories', secondaryCategories.filter((_: any, i: number) => i !== idx));
                  }} 
                  className="m-0.5"
                />
              ))}
            </div>
            <div className="flex items-center gap-1 mt-2">
              <Select
                value={selectedSecondaryCategory}
                onChange={(value) => setSelectedSecondaryCategory(value as string)}
                options={[{ value: '', label: 'Select category...' }, ...availableSecondaryCategories]}
                className="flex-grow"
              />
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                onClick={handleAddSecondaryCategory}
                disabled={!selectedSecondaryCategory}
              >
                Add
              </Button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-500">Keywords</label>
            <div className="mt-1 flex flex-wrap gap-1 items-start">
              {Array.isArray(keywords) && keywords.length > 0 && keywords.map((keyword: string, idx: number) => (
                <Chip 
                  key={idx} 
                  label={keyword} 
                  onDelete={() => {
                    onChange('keywords', keywords.filter((_: any, i: number) => i !== idx));
                  }} 
                  className="m-0.5"
                />
              ))}
            </div>
            <TextField
              placeholder="Add keywords (comma-separated)"
              size="small"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  e.preventDefault();
                  handleArrayChange('keywords', e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
              className="mt-2"
              fullWidth
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingDocuments; 
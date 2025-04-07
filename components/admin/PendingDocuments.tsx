import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Alert
} from '@mui/material';
import { DataGrid, GridColDef, GridRowParams, GridValueGetterParams, GridCellParams, GridRenderCellParams } from '@mui/x-data-grid';
import { DocumentCategory, QualityFlag } from '../../types/metadata';

interface PendingDocument {
  id: string;
  url: string;
  title: string;
  contentPreview: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
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
  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'title', headerName: 'Title', width: 200 },
    { field: 'url', headerName: 'URL', width: 300 },
    { 
      field: 'contentPreview', 
      headerName: 'Content Preview', 
      width: 400,
      valueFormatter: (params) => {
        const content = params.value || '';
        return content.length > 100 ? `${content.substring(0, 100)}...` : content;
      }
    },
    { 
      field: 'createdAt', 
      headerName: 'Created', 
      width: 180,
      valueFormatter: (params) => {
        return new Date(params.value).toLocaleString();
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            size="small" 
            variant="outlined" 
            color="primary"
            onClick={() => {
              setSelectedDocuments([params.row.id]);
              handleOpenDialog('approve');
            }}
          >
            Approve
          </Button>
          <Button 
            size="small" 
            variant="outlined" 
            color="error"
            onClick={() => {
              setSelectedDocuments([params.row.id]);
              handleOpenDialog('reject');
            }}
          >
            Reject
          </Button>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Pending Documents Review
      </Typography>
      
      {/* Filter controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel id="category-filter-label">Category</InputLabel>
              <Select
                labelId="category-filter-label"
                value={selectedDocuments.length > 0 ? documents.find(d => d.id === selectedDocuments[0])?.metadata.primaryCategory || 'all' : 'all'}
                label="Category"
                onChange={(e) => handleSelectDocuments(e.target.value === 'all' ? [] : [e.target.value])}
              >
                <MenuItem value="all">All Categories</MenuItem>
                <MenuItem value="PRODUCT">Product</MenuItem>
                <MenuItem value="TECHNICAL">Technical</MenuItem>
                <MenuItem value="FEATURES">Features</MenuItem>
                <MenuItem value="PRICING">Pricing</MenuItem>
                <MenuItem value="COMPARISON">Comparison</MenuItem>
                <MenuItem value="CUSTOMER_CASE">Customer Case</MenuItem>
                <MenuItem value="GENERAL">General</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Results notification */}
      {processResult && (
        <Alert 
          severity={processResult.success ? "success" : "error"} 
          sx={{ mb: 2 }}
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
          sx={{ mb: 2 }}
          onClose={() => setConflicts({ hasConflicts: false, conflictingDocs: [] })}
        >
          Conflicts detected with {conflicts.conflictingDocs.length} documents. 
          Please review and try again.
        </Alert>
      )}
      
      {/* Document list and preview */}
      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
        {/* Document list */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ height: '100%' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <DataGrid
                rows={documents}
                columns={columns}
                pagination
                page={page}
                pageSize={pageSize}
                rowCount={totalDocs}
                paginationMode="server"
                onPageChange={(newPage) => setPage(newPage)}
                onPageSizeChange={(newPageSize) => setPageSize(newPageSize)}
                onRowSelectionModelChange={(newSelection) => {
                  handleSelectDocuments(newSelection as string[]);
                }}
                rowSelectionModel={selectedDocuments}
                loading={loading}
                disableSelectionOnClick
                sx={{ border: 'none' }}
              />
            )}
          </Paper>
        </Grid>
        
        {/* Document preview */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {selectedDocuments.length > 0 ? (
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6">Document Preview</Typography>
                  <Typography variant="subtitle2" color="text.secondary">
                    ID: {selectedDocuments[0]}
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Metadata
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="body2">
                        <strong>Primary Category:</strong> {documents.find(d => d.id === selectedDocuments[0])?.metadata.primaryCategory}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2">
                        <strong>Technical Level:</strong> {documents.find(d => d.id === selectedDocuments[0])?.metadata.technicalLevel}/10
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2">
                        <strong>Categories:</strong> {documents.find(d => d.id === selectedDocuments[0])?.metadata.categories.join(', ')}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2">
                        <strong>Keywords:</strong> {documents.find(d => d.id === selectedDocuments[0])?.metadata.keywords.join(', ')}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
                
                <Typography variant="subtitle1" fontWeight="bold">
                  Summary
                </Typography>
                <Typography variant="body2" paragraph>
                  {documents.find(d => d.id === selectedDocuments[0])?.metadata.summary}
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle1" fontWeight="bold">
                  Content
                </Typography>
                <Box 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'grey.100', 
                    borderRadius: 1, 
                    mb: 2,
                    overflow: 'auto',
                    flexGrow: 1,
                  }}
                >
                  <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                    {documents.find(d => d.id === selectedDocuments[0])?.content}
                  </Typography>
                </Box>
                
                <Stack direction="row" spacing={2} sx={{ mt: 'auto' }}>
                  <Button 
                    variant="contained" 
                    color="primary"
                    onClick={() => handleOpenDialog('approve')}
                  >
                    Approve
                  </Button>
                  <Button 
                    variant="outlined" 
                    color="error"
                    onClick={() => handleOpenDialog('reject')}
                  >
                    Reject
                  </Button>
                </Stack>
              </>
            ) : (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                height: '100%' 
              }}>
                <Typography variant="body1" color="text.secondary">
                  Select a document to preview
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
      
      {/* Approval/Rejection Dialog */}
      <Dialog
        open={dialogState.open}
        onClose={handleCloseDialog}
      >
        <DialogTitle>
          {dialogState.action === 'approve' ? 'Approve Documents' : 'Reject Documents'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to {dialogState.action} {dialogState.documentIds.length} selected document(s)?
            {dialogState.action === 'approve' && " This will process and index them for search."}
            {dialogState.action === 'reject' && " This will remove them from the pending queue."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmAction} color={dialogState.action === 'approve' ? 'primary' : 'error'} autoFocus>
            Confirm {dialogState.action}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PendingDocuments; 
import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import AdminLayout from '@/components/layouts/AdminLayout';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import PendingDocuments from '@/components/admin/PendingDocuments';
import { Card, CardContent } from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Box from '@/components/ui/Box';
import Alert from '@/components/ui/Alert';

// Define our own interfaces instead of importing from PendingDocuments
interface PendingDocument {
  id: string;
  source: string;
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

// Interface for document ingestion form
interface IngestionFormState {
  text: string;
  source: string;
  notes: string;
}

// Interface for Gemini analysis results
interface AnalysisResult {
  summary: string;
  contentType: string;
  primaryCategory: string;
  technicalLevel: number;
  keyEntities: {
    people: string[];
    companies: string[];
  };
  keywords: string[];
  confidenceScore: number;
}

const PendingDocumentsPage: NextPage = () => {
  // State for document ingestion
  const [formState, setFormState] = useState<IngestionFormState>({
    text: '',
    source: '',
    notes: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // State for pending documents list
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [dialogState, setDialogState] = useState<DialogState>({
    open: false,
    documentIds: [],
    action: null
  });
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'pending' | 'add'>('pending');

  const [helpOpen, setHelpOpen] = useState(false);

  // Fetch pending documents on component mount
  useEffect(() => {
    fetchPendingDocuments();
  }, []);

  // Function to fetch pending documents
  const fetchPendingDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/pending-documents');
      if (!response.ok) {
        throw new Error('Failed to fetch pending documents');
      }
      const data = await response.json();
      setPendingDocuments(data.documents || []);
    } catch (error) {
      console.error('Error fetching pending documents:', error);
      setError('Failed to load pending documents. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle document ingestion form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // Validate ingestion form
  const validateForm = (): boolean => {
    if (!formState.text.trim()) {
      setError('Document text is required');
      return false;
    }

    if (!formState.source.trim()) {
      setError('Source identifier is required');
      return false;
    }

    return true;
  };

  // Handle document ingestion form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setAnalysisResult(null);
    setSuccessMessage(null);
    
    try {
      const response = await fetch('/api/admin/ingest-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: formState.text,
          source: formState.source,
          existingMetadata: {
            userNotes: formState.notes
          }
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to process document');
      }
      
      setSuccessMessage(`Document processed successfully and added to the approval queue. ID: ${data.documentId}`);
      setAnalysisResult(data.analysis);
      
      // Reset form
      setFormState({
        text: '',
        source: '',
        notes: ''
      });
      
      // Refresh the pending documents list
      fetchPendingDocuments();
      
      // Switch to pending tab to show the new document
      setActiveTab('pending');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to handle document selection for batch actions
  const handleSelectDocuments = (newSelection: string[]) => {
    setSelectedDocuments(newSelection);
  };

  // Function to open approval/rejection dialog
  const handleOpenDialog = (action: 'approve' | 'reject') => {
    if (selectedDocuments.length === 0) {
      setError('Please select at least one document');
      return;
    }
    
    setDialogState({
      open: true,
      documentIds: selectedDocuments,
      action
    });
  };

  // Function to close approval/rejection dialog
  const handleCloseDialog = () => {
    setDialogState({
      ...dialogState,
      open: false
    });
  };

  // Function to confirm approve/reject action
  const handleConfirmAction = async () => {
    if (!dialogState.action || dialogState.documentIds.length === 0) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/pending-documents/${dialogState.action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentIds: dialogState.documentIds
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${dialogState.action} documents`);
      }
      
      // Show success message
      setSuccessMessage(`Successfully ${dialogState.action}d ${dialogState.documentIds.length} document(s)`);
      
      // Reset selection and close dialog
      setSelectedDocuments([]);
      handleCloseDialog();
      
      // Refresh the list
      fetchPendingDocuments();
      
    } catch (error) {
      console.error(`Error ${dialogState.action}ing documents:`, error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    }
  };

  // Render the Gemini analysis result
  const renderAnalysisResult = () => {
    if (!analysisResult) return null;
    
    return (
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Document Analysis Results</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Summary</h4>
            <p className="text-sm text-gray-600 mb-4">{analysisResult.summary}</p>
            
            <h4 className="font-medium text-gray-700 mb-2">Content Type</h4>
            <p className="text-sm text-gray-600 mb-4">{analysisResult.contentType}</p>
            
            <h4 className="font-medium text-gray-700 mb-2">Primary Category</h4>
            <p className="text-sm text-gray-600 mb-4">{analysisResult.primaryCategory}</p>
            
            <h4 className="font-medium text-gray-700 mb-2">Technical Level</h4>
            <p className="text-sm text-gray-600 mb-4">{analysisResult.technicalLevel}/3</p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Key Entities</h4>
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-600">People:</h5>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {analysisResult.keyEntities.people.length > 0 ? (
                  analysisResult.keyEntities.people.map((person, idx) => (
                    <li key={idx}>{person}</li>
                  ))
                ) : (
                  <li>None detected</li>
                )}
              </ul>
              
              <h5 className="text-sm font-medium text-gray-600 mt-2">Companies:</h5>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {analysisResult.keyEntities.companies.length > 0 ? (
                  analysisResult.keyEntities.companies.map((company, idx) => (
                    <li key={idx}>{company}</li>
                  ))
                ) : (
                  <li>None detected</li>
                )}
              </ul>
            </div>
            
            <h4 className="font-medium text-gray-700 mb-2">Keywords</h4>
            <div className="flex flex-wrap gap-1 mb-4">
              {analysisResult.keywords.map((keyword, idx) => (
                <span key={idx} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                  {keyword}
                </span>
              ))}
            </div>
            
            <h4 className="font-medium text-gray-700 mb-2">Confidence Score</h4>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${analysisResult.confidenceScore * 100}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {(analysisResult.confidenceScore * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render document ingestion form
  const renderIngestionForm = () => (
    <div className="bg-white shadow-sm rounded-lg p-6">
      <h2 className="text-xl font-medium text-gray-900 mb-4">Add New Document</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <TextField
            label="Source Identifier"
            name="source"
            placeholder="e.g., KB-2023-05-001 or company-whitepaper-2023"
            value={formState.source}
            onChange={handleInputChange}
            required
            fullWidth
            helperText="A unique identifier for this document. Will be used in citations."
          />
        </div>
        
        <div>
          <TextField
            label="Document Text"
            name="text"
            placeholder="Paste the document text here..."
            value={formState.text}
            onChange={handleInputChange}
            required
            multiline
            rows={10}
            fullWidth
            helperText="Raw text content of the document. All formatting will be preserved."
          />
        </div>
        
        <div>
          <TextField
            label="Notes (Optional)"
            name="notes"
            placeholder="Any additional notes about this document..."
            value={formState.notes}
            onChange={handleInputChange}
            multiline
            rows={3}
            fullWidth
            helperText="Optional notes about the document source, intended use, etc."
          />
        </div>
        
        <div className="pt-4">
          <Button
            type="submit"
            variant="primary"
            disabled={isProcessing}
            fullWidth
          >
            {isProcessing ? 'Processing...' : 'Process Document'}
          </Button>
        </div>
      </form>
    </div>
  );

  return (
    <AdminLayout>
      <Box className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Box display="flex" justifyContent="space-between" alignItems="center" className="mb-6">
          <Typography variant="h4" className="font-bold text-gray-900">
            Document Review Queue
          </Typography>
          <button 
            onClick={() => setHelpOpen(!helpOpen)}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
          >
            <span className="mr-1">{helpOpen ? 'Hide' : 'Show'} Help</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </Box>
        
        {helpOpen && (
          <Card className="mb-6 bg-blue-50 border border-blue-200">
            <CardContent>
              <Typography variant="h6" className="font-semibold mb-2">
                Automatic Document Tagging Process
              </Typography>
              
              <Alert severity="info" className="mb-3">
                <strong>All document tagging is fully automated by Gemini AI.</strong> There is no need for manual tagging.
              </Alert>
              
              <div className="mb-4">
                <h3 className="font-medium text-blue-800 mb-2">How Document Processing Works</h3>
                <ol className="list-decimal pl-5 space-y-2 text-sm">
                  <li>
                    <strong>Document Upload:</strong> When a document is uploaded (PDF, text, etc.), it is automatically processed by Gemini AI.
                  </li>
                  <li>
                    <strong>AI Tagging:</strong> Gemini analyzes the document content and automatically assigns tags:
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>Primary and secondary categories</li>
                      <li>Technical level (1-10 scale)</li>
                      <li>Industry and function categories</li>
                      <li>Entities (people, companies, products)</li>
                      <li>Keywords and topics</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Admin Review:</strong> Your role is to review the document and AI-generated tags for accuracy and appropriateness.
                  </li>
                  <li>
                    <strong>Approval:</strong> When you approve a document, all AI-generated tags are preserved and used for search indexing.
                  </li>
                </ol>
              </div>
              
              <div>
                <h3 className="font-medium text-blue-800 mb-2">Your Role as an Admin</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Review, don't tag:</strong> You don't need to manually tag or categorize documents. 
                    Your primary role is to review the document and the AI-generated tags to ensure:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>The document content is appropriate and relevant for the knowledge base</li>
                    <li>The AI-generated tags seem reasonable for the document</li>
                    <li>There are no concerning inaccuracies in how the document is classified</li>
                  </ul>
                  <p className="mt-2">
                    <strong>When to reject:</strong> Reject documents only if:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>The content is inappropriate, outdated, or shouldn't be in the knowledge base</li>
                    <li>The AI has completely misunderstood the document (rare)</li>
                    <li>The document conflicts with existing information in a problematic way</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <PendingDocuments />
      </Box>
    </AdminLayout>
  );
};

export default PendingDocumentsPage; 
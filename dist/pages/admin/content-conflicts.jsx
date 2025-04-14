import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { ConflictType, formatDocumentSnippet } from '../../utils/conflictDetection';
import Box from '@/components/ui/Box';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Paper from '@/components/ui/Paper';
import Dialog from '@/components/ui/Dialog';
import Alert from '@/components/ui/Alert';
import CircularProgress from '@/components/ui/CircularProgress';
import { Tabs } from '@/components/ui/Tabs';
import { Tab } from '@/components/ui/Tabs';
/**
 * Admin page for managing content conflicts
 */
export default function ContentConflictsPage() {
    // State for conflict data
    const [conflicts, setConflicts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentTab, setCurrentTab] = useState('all');
    const [resolvingConflict, setResolvingConflict] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    // Dialog state
    const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
    const [selectedConflict, setSelectedConflict] = useState(null);
    const [selectedDocId, setSelectedDocId] = useState(null);
    // Fetch conflicts on component mount
    useEffect(() => {
        fetchConflicts();
    }, []);
    // Function to fetch conflicts
    const fetchConflicts = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/content-conflicts');
            if (!response.ok) {
                throw new Error(`Failed to fetch conflicts: ${response.statusText}`);
            }
            const data = await response.json();
            setConflicts(data.conflicts || []);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
            console.error('Error fetching conflicts:', err);
        }
        finally {
            setLoading(false);
        }
    };
    // Filter conflicts based on current tab
    const filteredConflicts = conflicts.filter(conflict => {
        if (currentTab === 'all')
            return true;
        if (currentTab === 'high-priority')
            return conflict.isHighPriority;
        if (currentTab === 'leadership')
            return conflict.topic.toLowerCase() === 'leadership';
        if (currentTab === 'pricing')
            return conflict.topic.toLowerCase() === 'pricing';
        if (currentTab === 'features')
            return conflict.topic.toLowerCase() === 'features';
        return true;
    });
    // Handle opening the resolve dialog
    const handleOpenResolveDialog = (conflict) => {
        setSelectedConflict(conflict);
        // Default to the suggested resolution if available
        setSelectedDocId(conflict.suggestedResolution?.preferredDocId || null);
        setResolveDialogOpen(true);
    };
    // Handle closing the resolve dialog
    const handleCloseResolveDialog = () => {
        setResolveDialogOpen(false);
        setSelectedConflict(null);
        setSelectedDocId(null);
    };
    // Handle resolving a conflict
    const handleResolveConflict = async () => {
        if (!selectedConflict || !selectedDocId)
            return;
        setResolvingConflict(selectedConflict.topic);
        try {
            const response = await fetch('/api/admin/resolve-conflict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    conflictTopic: selectedConflict.topic,
                    entityName: selectedConflict.entityName,
                    preferredDocId: selectedDocId,
                    deprecatedDocIds: selectedConflict.conflicts
                        .flatMap(c => c.affectedDocIds)
                        .filter(id => id !== selectedDocId)
                })
            });
            if (!response.ok) {
                throw new Error(`Failed to resolve conflict: ${response.statusText}`);
            }
            const data = await response.json();
            // Show success message
            setSuccessMessage(`Successfully resolved ${selectedConflict.topic} conflict`);
            // Close dialog
            handleCloseResolveDialog();
            // Refresh conflicts
            fetchConflicts();
            // Clear success message after a delay
            setTimeout(() => {
                setSuccessMessage(null);
            }, 5000);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to resolve conflict');
            console.error('Error resolving conflict:', err);
        }
        finally {
            setResolvingConflict(null);
        }
    };
    // Handle tab change
    const handleTabChange = (_event, newValue) => {
        setCurrentTab(newValue);
    };
    // Render conflict type badge
    const renderConflictBadge = (type) => {
        const styles = {
            [ConflictType.CONTRADICTORY]: { bg: 'bg-red-100', text: 'text-red-800' },
            [ConflictType.OUTDATED]: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
            [ConflictType.INCOMPLETE]: { bg: 'bg-blue-100', text: 'text-blue-800' },
            [ConflictType.DUPLICATE]: { bg: 'bg-gray-100', text: 'text-gray-800' }
        };
        const style = styles[type];
        return (<span className={`px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}
      </span>);
    };
    return (<div className="container mx-auto px-4 py-8">
      <Head>
        <title>Content Conflicts | Admin Dashboard</title>
      </Head>
      
      <Box display="flex" justifyContent="space-between" alignItems="center" className="mb-6">
        <div>
          <Typography variant="h4" className="font-bold">Content Conflicts</Typography>
          <Typography variant="body2" color="textSecondary">
            Manage conflicting information in the knowledge base
          </Typography>
        </div>
        
        <Button variant="outline" onClick={fetchConflicts} disabled={loading}>
          Refresh Conflicts
        </Button>
      </Box>
      
      {/* Success message */}
      {successMessage && (<Alert severity="success" className="mb-4" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>)}
      
      {/* Error message */}
      {error && (<Alert severity="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>)}
      
      {/* Tabs for filtering */}
      <Tabs value={currentTab} onChange={handleTabChange} className="mb-4">
        <Tab value="all" label="All Conflicts"/>
        <Tab value="high-priority" label="High Priority"/>
        <Tab value="leadership" label="Leadership"/>
        <Tab value="pricing" label="Pricing"/>
        <Tab value="features" label="Features"/>
      </Tabs>
      
      {/* Loading state */}
      {loading && (<div className="flex justify-center items-center h-64">
          <CircularProgress />
        </div>)}
      
      {/* No conflicts state */}
      {!loading && filteredConflicts.length === 0 && (<Paper className="p-8 text-center">
          <Typography variant="h6" className="text-gray-500">
            No conflicts found
          </Typography>
          <Typography variant="body2" color="textSecondary" className="mt-2">
            {currentTab !== 'all'
                ? `No ${currentTab} conflicts detected in the knowledge base`
                : 'No conflicts detected in the knowledge base'}
          </Typography>
        </Paper>)}
      
      {/* Conflicts list */}
      {!loading && filteredConflicts.length > 0 && (<div className="space-y-6">
          {filteredConflicts.map((conflict, index) => (<Paper key={`${conflict.topic}-${index}`} className="overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
                <div>
                  <Typography variant="h6" className="font-semibold">
                    {conflict.topic}{conflict.entityName ? `: ${conflict.entityName}` : ''}
                  </Typography>
                  <div className="flex items-center mt-1 space-x-2">
                    {conflict.isHighPriority && (<span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        High Priority
                      </span>)}
                    {conflict.conflicts.map((c, i) => (<span key={i} className="mr-2">
                        {renderConflictBadge(c.type)}
                      </span>))}
                  </div>
                </div>
                <Button variant="primary" onClick={() => handleOpenResolveDialog(conflict)} disabled={resolvingConflict === conflict.topic}>
                  {resolvingConflict === conflict.topic ? (<CircularProgress size={24} color="primary" className="mr-2"/>) : null}
                  Resolve Conflict
                </Button>
              </div>
              
              <div className="p-4">
                {conflict.conflicts.map((c, i) => (<div key={i} className="mb-4">
                    <Typography variant="subtitle2" className="font-medium mb-2">
                      {c.description}
                    </Typography>
                    <div className="pl-4 border-l-4 border-gray-200">
                      {c.affectedDocIds.map((docId) => {
                        const doc = conflict.documents.find(d => d.metadata?.source === docId);
                        return doc ? (<div key={docId} className="mb-2 p-3 bg-gray-50 rounded">
                            <div className="flex justify-between items-center mb-2">
                              <Typography variant="caption" className="text-gray-500">
                                ID: {docId}
                              </Typography>
                              <Typography variant="caption" className="text-gray-500">
                                {doc.metadata?.lastUpdated
                                ? `Last updated: ${new Date(doc.metadata.lastUpdated).toLocaleDateString()}`
                                : ''}
                              </Typography>
                            </div>
                            <Typography variant="body2">
                              {formatDocumentSnippet(doc, 200)}
                            </Typography>
                          </div>) : null;
                    })}
                    </div>
                  </div>))}
                
                {conflict.suggestedResolution && (<div className="mt-4 p-4 bg-green-50 rounded">
                    <Typography variant="subtitle2" className="font-medium">
                      Suggested Resolution
                    </Typography>
                    <Typography variant="body2">
                      {conflict.suggestedResolution.reason}
                    </Typography>
                  </div>)}
              </div>
            </Paper>))}
        </div>)}
      
      {/* Resolution Dialog */}
      <Dialog open={resolveDialogOpen} onClose={handleCloseResolveDialog} title={`Resolve ${selectedConflict?.topic} Conflict`} actions={<>
            <Button variant="secondary" onClick={handleCloseResolveDialog}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleResolveConflict} disabled={!selectedDocId || resolvingConflict !== null}>
              {resolvingConflict ? 'Resolving...' : 'Confirm Resolution'}
            </Button>
          </>}>
        {selectedConflict && (<div className="max-w-2xl">
            <Typography variant="body1" className="mb-4">
              Select the document with the correct information. Other documents will be marked as deprecated.
            </Typography>
            
            <div className="space-y-4 mt-4">
              {selectedConflict.documents.map((doc) => {
                const docId = doc.metadata?.source || '';
                return (<div key={docId} className={`p-4 border rounded cursor-pointer transition-colors ${selectedDocId === docId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:bg-gray-50'}`} onClick={() => setSelectedDocId(docId)}>
                    <div className="flex items-center mb-2">
                      <input type="radio" checked={selectedDocId === docId} onChange={() => setSelectedDocId(docId)} className="mr-2 h-4 w-4 text-blue-600"/>
                      <Typography variant="subtitle2" className="font-medium">
                        Document ID: {docId}
                      </Typography>
                    </div>
                    <div className="ml-6">
                      <Typography variant="body2">
                        {formatDocumentSnippet(doc, 150)}
                      </Typography>
                      <div className="mt-2 text-xs text-gray-500">
                        {doc.metadata?.lastUpdated && (<span>Last updated: {new Date(doc.metadata.lastUpdated).toLocaleString()}</span>)}
                      </div>
                    </div>
                  </div>);
            })}
            </div>
            
            {selectedConflict.suggestedResolution && (<div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded">
                <Typography variant="body2">
                  <strong>Suggestion:</strong> {selectedConflict.suggestedResolution.reason}
                </Typography>
              </div>)}
          </div>)}
      </Dialog>
    </div>);
}
/**
 * Server-side props
 */
export const getServerSideProps = async (context) => {
    // In a real implementation, you might want to check authentication/authorization here
    return {
        props: {}
    };
};

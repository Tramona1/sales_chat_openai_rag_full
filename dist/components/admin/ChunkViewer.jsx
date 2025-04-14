import React, { useState, useEffect } from 'react';
import { Edit, Save, X as Close, RefreshCw as Refresh, ArrowLeft as ArrowBack } from 'react-feather';
import Button from '../ui/Button';
import Table from '../ui/Table';
const ChunkViewer = ({ documentId, documentTitle, onBack }) => {
    const [chunks, setChunks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedChunk, setSelectedChunk] = useState(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editedText, setEditedText] = useState('');
    const [savingChunk, setSavingChunk] = useState(false);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });
    const [regeneratingEmbedding, setRegeneratingEmbedding] = useState(false);
    // Fetch document chunks
    useEffect(() => {
        fetchChunks();
    }, [documentId]);
    const fetchChunks = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin/documents/${documentId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch document: ${response.statusText}`);
            }
            const data = await response.json();
            setChunks(data.chunks || []);
        }
        catch (err) {
            console.error('Error fetching chunks:', err);
            setError(`Failed to load chunks: ${err.message}`);
        }
        finally {
            setLoading(false);
        }
    };
    // Handle opening the edit dialog
    const handleEditChunk = (chunk) => {
        setSelectedChunk(chunk);
        setEditedText(chunk.text);
        setEditDialogOpen(true);
    };
    // Handle saving the edited chunk
    const handleSaveChunk = async () => {
        if (!selectedChunk)
            return;
        setSavingChunk(true);
        try {
            const response = await fetch(`/api/admin/chunks/${selectedChunk.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: editedText,
                    regenerateEmbedding: false // Don't regenerate embedding yet
                })
            });
            if (!response.ok) {
                throw new Error(`Failed to update chunk: ${response.statusText}`);
            }
            // Update the local state
            setChunks(chunks.map(chunk => chunk.id === selectedChunk.id
                ? { ...chunk, text: editedText }
                : chunk));
            // Close the dialog and show success message
            setEditDialogOpen(false);
            setSnackbar({
                open: true,
                message: 'Chunk updated successfully',
                severity: 'success'
            });
        }
        catch (err) {
            console.error('Error updating chunk:', err);
            setSnackbar({
                open: true,
                message: `Failed to update chunk: ${err.message}`,
                severity: 'error'
            });
        }
        finally {
            setSavingChunk(false);
        }
    };
    // Handle regenerating embeddings for a chunk
    const handleRegenerateEmbedding = async (chunk) => {
        setRegeneratingEmbedding(true);
        try {
            const response = await fetch(`/api/admin/chunks/${chunk.id}/regenerate-embedding`, {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error(`Failed to regenerate embedding: ${response.statusText}`);
            }
            const result = await response.json();
            setSnackbar({
                open: true,
                message: 'Embedding regenerated successfully',
                severity: 'success'
            });
            // Refresh the chunks
            fetchChunks();
        }
        catch (err) {
            console.error('Error regenerating embedding:', err);
            setSnackbar({
                open: true,
                message: `Failed to regenerate embedding: ${err.message}`,
                severity: 'error'
            });
        }
        finally {
            setRegeneratingEmbedding(false);
        }
    };
    // Close snackbar
    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };
    // Table columns definition
    const columns = [
        {
            field: 'chunk_index',
            headerName: 'Index',
            width: 80
        },
        {
            field: 'text',
            headerName: 'Content',
            flex: 2,
            renderCell: (row) => (<div className="truncate max-w-xs">
          {row.text}
        </div>)
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 150,
            renderCell: (row) => (<div className="flex gap-2">
          <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" onClick={() => handleEditChunk(row)}>
            <Edit size={16}/>
          </button>
          <button className="p-1 text-green-600 hover:bg-green-50 rounded" onClick={() => handleRegenerateEmbedding(row)} disabled={regeneratingEmbedding}>
            <Refresh size={16} className={regeneratingEmbedding ? "animate-spin" : ""}/>
          </button>
        </div>)
        }
    ];
    return (<div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <button className="flex items-center text-gray-600 hover:text-gray-800" onClick={onBack}>
            <ArrowBack size={16} className="mr-1"/>
            Back to Documents
          </button>
          
          <h1 className="text-2xl font-bold mt-2">
            Chunks for: {documentTitle}
          </h1>
        </div>
        
        <Button variant="outlined" color="primary" startIcon={<Refresh />} onClick={fetchChunks}>
          Refresh
        </Button>
      </div>
      
      {error && (<div className="p-4 mb-4 border-l-4 border-red-500 bg-red-50 text-red-700">
          {error}
        </div>)}
      
      <div className="bg-white rounded-lg shadow">
        <Table rows={chunks} columns={columns} loading={loading} getRowId={(row) => row.id} pagination={true} paginationModel={{ page: 0, pageSize: 10 }} rowCount={chunks.length}/>
      </div>
      
      {/* Edit Dialog */}
      {editDialogOpen && selectedChunk && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Chunk</h2>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setEditDialogOpen(false)}>
                <Close size={20}/>
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">Chunk ID: {selectedChunk.id}</p>
              <p className="text-sm text-gray-600 mb-4">Index: {selectedChunk.chunk_index}</p>
              
              <textarea className="w-full border border-gray-300 rounded-md p-3 h-64" value={editedText} onChange={(e) => setEditedText(e.target.value)}/>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outlined" color="secondary" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="contained" color="primary" startIcon={<Save />} onClick={handleSaveChunk} loading={savingChunk}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>)}
      
      {/* Snackbar for notifications */}
      {snackbar.open && (<div className={`fixed bottom-4 right-4 p-4 rounded-md shadow-md 
          ${snackbar.severity === 'success' ? 'bg-green-100 text-green-800 border-green-400' :
                snackbar.severity === 'error' ? 'bg-red-100 text-red-800 border-red-400' :
                    snackbar.severity === 'warning' ? 'bg-yellow-100 text-yellow-800 border-yellow-400' :
                        'bg-blue-100 text-blue-800 border-blue-400'} 
          border-l-4`}>
          <div className="flex justify-between items-center">
            <span>{snackbar.message}</span>
            <button className="ml-6 text-gray-600 hover:text-gray-800" onClick={handleCloseSnackbar}>
              <Close size={16}/>
            </button>
          </div>
        </div>)}
    </div>);
};
export default ChunkViewer;

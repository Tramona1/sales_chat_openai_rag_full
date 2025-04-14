import React, { useState, useEffect } from 'react';
import { Edit, X as Close } from 'react-feather';
/**
 * Component for viewing and editing individual document chunks
 *
 * Features:
 * - View chunk text and metadata
 * - Edit chunk text
 * - Regenerate embeddings for a chunk
 * - Delete a chunk
 */
export default function DocumentChunkViewer({ chunkId, onChunkUpdated, onClose }) {
    const [chunk, setChunk] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });
    // Fetch chunk data
    useEffect(() => {
        const fetchChunk = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/admin/chunks/${chunkId}`);
                if (response.ok) {
                    const data = await response.json();
                    setChunk(data);
                    setEditedText(data.text);
                }
                else {
                    const errorData = await response.json();
                    setError(errorData.error || 'Failed to fetch chunk data');
                }
            }
            catch (err) {
                setError('Network error while fetching chunk data');
                console.error(err);
            }
            finally {
                setLoading(false);
            }
        };
        if (chunkId) {
            fetchChunk();
        }
    }, [chunkId]);
    // Save updated chunk
    const handleSaveChanges = async (regenerateEmbedding = false) => {
        try {
            setIsSaving(true);
            const response = await fetch(`/api/admin/chunks/${chunkId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: editedText,
                    regenerateEmbedding
                })
            });
            if (response.ok) {
                const updatedChunk = await response.json();
                setChunk(updatedChunk.chunk);
                setIsEditing(false);
                setSnackbar({
                    open: true,
                    message: regenerateEmbedding ? 'Text and embedding updated successfully' : 'Text updated successfully',
                    severity: 'success'
                });
                if (onChunkUpdated) {
                    onChunkUpdated();
                }
            }
            else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update chunk');
            }
        }
        catch (err) {
            console.error(err);
            setSnackbar({
                open: true,
                message: err.message || 'Unknown error occurred',
                severity: 'error'
            });
        }
        finally {
            setIsSaving(false);
        }
    };
    // Delete chunk
    const handleDeleteChunk = async () => {
        if (!window.confirm('Are you sure you want to delete this chunk? This action cannot be undone.')) {
            return;
        }
        try {
            setIsDeleting(true);
            const response = await fetch(`/api/admin/chunks/${chunkId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                setSnackbar({
                    open: true,
                    message: 'The chunk has been successfully deleted',
                    severity: 'success'
                });
                if (onChunkUpdated) {
                    onChunkUpdated();
                }
                if (onClose) {
                    onClose();
                }
            }
            else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete chunk');
            }
        }
        catch (err) {
            console.error(err);
            setSnackbar({
                open: true,
                message: err.message || 'Unknown error occurred',
                severity: 'error'
            });
        }
        finally {
            setIsDeleting(false);
        }
    };
    // Cancel editing
    const handleCancelEdit = () => {
        setEditedText(chunk.text);
        setIsEditing(false);
    };
    // Handle snackbar close
    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };
    if (loading) {
        return (<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid', borderColor: '#007bff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <div>Loading chunk data...</div>
      </div>);
    }
    if (error) {
        return (<div style={{ padding: '20px', border: '1px solid', borderColor: '#dc3545', borderRadius: '0.25rem', backgroundColor: '#f8d7da' }}>
        <div style={{ marginBottom: '10px', color: '#dc3545', fontWeight: 'bold' }}>Error</div>
        <div>{error}</div>
        {onClose && (<button style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }} onClick={onClose}>
            Close
          </button>)}
      </div>);
    }
    if (!chunk) {
        return (<div style={{ padding: '20px', border: '1px solid', borderColor: '#d3d3d3', borderRadius: '0.25rem' }}>
        <div>No chunk data available</div>
        {onClose && (<button style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }} onClick={onClose}>
            Close
          </button>)}
      </div>);
    }
    return (<div style={{ padding: '20px', borderRadius: '0.25rem', boxShadow: '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>Document Chunk</div>
        {onClose && (<button style={{
                background: 'none',
                border: 'none',
                padding: '0',
                cursor: 'pointer',
                color: '#6c757d'
            }} onClick={onClose}>
            <Close size={20}/>
          </button>)}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>ID:</div>
        <div style={{ fontFamily: 'monospace' }}>{chunk.id}</div>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>Document ID:</div>
        <div style={{ fontFamily: 'monospace' }}>{chunk.document_id}</div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontWeight: 'bold' }}>Chunk Number:</div>
        <div style={{ padding: '5px 10px', backgroundColor: '#f0f0f0', borderRadius: '15px' }}>{chunk.chunk_index}</div>
        
        <div style={{ fontWeight: 'bold' }}>Token Count:</div>
        <div style={{ padding: '5px 10px', backgroundColor: '#f0f0f0', borderRadius: '15px' }}>{chunk.token_count || 'N/A'}</div>
        
        <div style={{ fontWeight: 'bold' }}>Metadata:</div>
        <div style={{ padding: '5px 10px', backgroundColor: '#f0f0f0', borderRadius: '15px' }}>{chunk.metadata ? 'Available' : 'None'}</div>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontWeight: 'bold' }}>Content:</div>
          {!isEditing && (<button style={{
                background: 'none',
                border: 'none',
                padding: '0',
                cursor: 'pointer',
                color: '#6c757d'
            }} onClick={() => setIsEditing(true)}>
              <Edit size={16}/>
            </button>)}
        </div>
        
        {isEditing ? (<>
            <textarea style={{
                width: '100%',
                padding: '10px',
                border: '1px solid',
                borderColor: '#d3d3d3',
                borderRadius: '4px',
                marginBottom: '10px',
                minHeight: '200px',
                maxHeight: '400px'
            }} rows={8} value={editedText} onChange={(e) => setEditedText(e.target.value)}/>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button style={{
                padding: '10px 20px',
                backgroundColor: '#dc3545',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
            }} onClick={handleCancelEdit} disabled={isSaving}>
                Cancel
              </button>
              <button style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
            }} onClick={() => handleSaveChanges(false)} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
            }} onClick={() => handleSaveChanges(true)} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save & Regenerate Embedding'}
              </button>
            </div>
          </>) : (<div style={{
                padding: '10px',
                border: '1px solid',
                borderColor: '#d3d3d3',
                borderRadius: '4px',
                backgroundColor: '#f0f0f0',
                minHeight: '100px',
                maxHeight: '400px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontSize: '0.875rem'
            }}>
            {chunk.text}
          </div>)}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
        <button style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
        }} onClick={handleDeleteChunk} disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete Chunk'}
        </button>
        
        {onClose && !isEditing && (<button style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={onClose}>
            Close
          </button>)}
      </div>

      <div style={{ marginTop: '20px' }}>
        {snackbar.open && (<div style={{ padding: '10px', backgroundColor: '#d1e7dd', border: '1px solid', borderColor: '#a3cfbb', borderRadius: '4px' }}>
            {snackbar.message}
          </div>)}
      </div>
    </div>);
}

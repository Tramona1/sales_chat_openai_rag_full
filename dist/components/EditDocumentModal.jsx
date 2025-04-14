import React, { useState, useEffect } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import Select from '@/components/ui/Select';
import { getCategoryFilterOptions } from '@/utils/tagUtils';
const EditDocumentModal = ({ isOpen, onClose, document, onSave, }) => {
    const [editedDocument, setEditedDocument] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [isChanged, setIsChanged] = useState(false);
    // Reset form when document changes
    useEffect(() => {
        if (document) {
            setEditedDocument({ ...document });
            setIsChanged(false);
        }
        else {
            setEditedDocument(null);
        }
        setError(null);
    }, [document]);
    if (!editedDocument)
        return null;
    const handleTextChange = (e) => {
        setEditedDocument({ ...editedDocument, text: e.target.value });
        setIsChanged(true);
    };
    const handleMetadataChange = (key, value) => {
        setEditedDocument({
            ...editedDocument,
            metadata: {
                ...editedDocument.metadata,
                [key]: value,
            },
        });
        setIsChanged(true);
    };
    const handleSave = async () => {
        if (!editedDocument)
            return;
        setIsSaving(true);
        setError(null);
        try {
            console.log("Saving document changes...");
            await onSave(editedDocument);
            console.log("Document saved successfully");
            setIsChanged(false);
            onClose();
        }
        catch (err) {
            console.error("Error saving document:", err);
            setError(err instanceof Error ? err.message : "Failed to save document");
        }
        finally {
            setIsSaving(false);
        }
    };
    // Use the standardized categories from tagUtils
    const categoryOptions = getCategoryFilterOptions().filter(option => option.value !== 'all');
    const techLevelOptions = [
        { value: '0', label: 'Non-technical (0)' },
        { value: '1', label: 'Basic (1)' },
        { value: '2', label: 'Intermediate (2)' },
        { value: '3', label: 'Advanced (3)' },
    ];
    // Dialog actions for dialog footer
    const dialogActions = (<>
      <Button variant="secondary" onClick={onClose} disabled={isSaving}>
        Cancel
      </Button>
      <Button onClick={handleSave} disabled={isSaving || !isChanged} variant="primary">
        {isSaving ? "Saving..." : "Save Changes"}
      </Button>
    </>);
    return (<Dialog open={isOpen} onClose={onClose} title="Edit Document" actions={dialogActions} maxWidth="2xl">
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Make changes to the document content and metadata. Note that editing will regenerate embeddings for search.
        </p>
        {isChanged && (<div className="mt-2 bg-blue-50 text-blue-800 p-2 text-sm rounded">
            You have unsaved changes. Click "Save Changes" when you're done editing.
          </div>)}
      </div>
      
      {error && (<div className="bg-red-50 text-red-800 p-3 rounded-md text-sm mb-4">
          <strong>Error saving document:</strong> {error}
        </div>)}
      
      <div className="grid gap-4 py-4">
        <TextField label="Document ID (read-only)" value={editedDocument.id} disabled fullWidth className="font-mono text-sm" size="small"/>
        
        <div className="mb-1">
          <label htmlFor="document-content" className="block text-sm font-medium text-gray-700 mb-1">
            Document Content
          </label>
          <textarea id="document-content" value={editedDocument.text} onChange={handleTextChange} rows={12} className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Enter document content here..."/>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Category" value={editedDocument.metadata.category || "uncategorized"} onChange={(value) => handleMetadataChange("category", value)} options={categoryOptions} fullWidth/>
          
          <Select label="Technical Level" value={String(editedDocument.metadata.technicalLevel || "0")} onChange={(value) => handleMetadataChange("technicalLevel", parseInt(value))} options={techLevelOptions} fullWidth/>
        </div>
        
        <TextField label="Keywords (comma separated)" value={editedDocument.metadata.keywords || ""} onChange={(e) => handleMetadataChange("keywords", e.target.value)} fullWidth/>
        
        <TextField label="Entities (comma separated)" value={editedDocument.metadata.entities || ""} onChange={(e) => handleMetadataChange("entities", e.target.value)} fullWidth/>
        
        <TextField label="Summary" value={editedDocument.metadata.summary || ""} onChange={(e) => handleMetadataChange("summary", e.target.value)} multiline rows={3} fullWidth/>
      </div>
    </Dialog>);
};
export default EditDocumentModal;

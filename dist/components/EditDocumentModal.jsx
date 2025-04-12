"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const Dialog_1 = __importDefault(require("@/components/ui/Dialog"));
const Button_1 = __importDefault(require("@/components/ui/Button"));
const TextField_1 = __importDefault(require("@/components/ui/TextField"));
const Select_1 = __importDefault(require("@/components/ui/Select"));
const EditDocumentModal = ({ isOpen, onClose, document, onSave, }) => {
    const [editedDocument, setEditedDocument] = (0, react_1.useState)(null);
    const [isSaving, setIsSaving] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [isChanged, setIsChanged] = (0, react_1.useState)(false);
    // Reset form when document changes
    (0, react_1.useEffect)(() => {
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
    const categoryOptions = [
        { value: 'product', label: 'Product' },
        { value: 'company', label: 'Company' },
        { value: 'technical', label: 'Technical' },
        { value: 'pricing', label: 'Pricing' },
        { value: 'competitors', label: 'Competitors' },
        { value: 'support', label: 'Support' },
        { value: 'uncategorized', label: 'Uncategorized' },
    ];
    const techLevelOptions = [
        { value: '0', label: 'Non-technical (0)' },
        { value: '1', label: 'Basic (1)' },
        { value: '2', label: 'Intermediate (2)' },
        { value: '3', label: 'Advanced (3)' },
    ];
    // Dialog actions for dialog footer
    const dialogActions = (<>
      <Button_1.default variant="secondary" onClick={onClose} disabled={isSaving}>
        Cancel
      </Button_1.default>
      <Button_1.default onClick={handleSave} disabled={isSaving || !isChanged} variant="primary">
        {isSaving ? "Saving..." : "Save Changes"}
      </Button_1.default>
    </>);
    return (<Dialog_1.default open={isOpen} onClose={onClose} title="Edit Document" actions={dialogActions} maxWidth="2xl">
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
        <TextField_1.default label="Document ID (read-only)" value={editedDocument.id} disabled fullWidth className="font-mono text-sm" size="small"/>
        
        <div className="mb-1">
          <label htmlFor="document-content" className="block text-sm font-medium text-gray-700 mb-1">
            Document Content
          </label>
          <textarea id="document-content" value={editedDocument.text} onChange={handleTextChange} rows={12} className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Enter document content here..."/>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select_1.default label="Category" value={editedDocument.metadata.category || "uncategorized"} onChange={(value) => handleMetadataChange("category", value)} options={categoryOptions} fullWidth/>
          
          <Select_1.default label="Technical Level" value={String(editedDocument.metadata.technicalLevel || "0")} onChange={(value) => handleMetadataChange("technicalLevel", parseInt(value))} options={techLevelOptions} fullWidth/>
        </div>
        
        <TextField_1.default label="Keywords (comma separated)" value={editedDocument.metadata.keywords || ""} onChange={(e) => handleMetadataChange("keywords", e.target.value)} fullWidth/>
        
        <TextField_1.default label="Entities (comma separated)" value={editedDocument.metadata.entities || ""} onChange={(e) => handleMetadataChange("entities", e.target.value)} fullWidth/>
        
        <TextField_1.default label="Summary" value={editedDocument.metadata.summary || ""} onChange={(e) => handleMetadataChange("summary", e.target.value)} multiline rows={3} fullWidth/>
      </div>
    </Dialog_1.default>);
};
exports.default = EditDocumentModal;

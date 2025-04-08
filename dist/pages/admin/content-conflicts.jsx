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
exports.getServerSideProps = void 0;
exports.default = ContentConflictsPage;
const react_1 = __importStar(require("react"));
const head_1 = __importDefault(require("next/head"));
const conflictDetection_1 = require("../../utils/conflictDetection");
const Box_1 = __importDefault(require("@/components/ui/Box"));
const Typography_1 = __importDefault(require("@/components/ui/Typography"));
const Button_1 = __importDefault(require("@/components/ui/Button"));
const Paper_1 = __importDefault(require("@/components/ui/Paper"));
const Dialog_1 = __importDefault(require("@/components/ui/Dialog"));
const Alert_1 = __importDefault(require("@/components/ui/Alert"));
const CircularProgress_1 = __importDefault(require("@/components/ui/CircularProgress"));
const Tabs_1 = require("@/components/ui/Tabs");
const Tabs_2 = require("@/components/ui/Tabs");
/**
 * Admin page for managing content conflicts
 */
function ContentConflictsPage() {
    // State for conflict data
    const [conflicts, setConflicts] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [currentTab, setCurrentTab] = (0, react_1.useState)('all');
    const [resolvingConflict, setResolvingConflict] = (0, react_1.useState)(null);
    const [successMessage, setSuccessMessage] = (0, react_1.useState)(null);
    // Dialog state
    const [resolveDialogOpen, setResolveDialogOpen] = (0, react_1.useState)(false);
    const [selectedConflict, setSelectedConflict] = (0, react_1.useState)(null);
    const [selectedDocId, setSelectedDocId] = (0, react_1.useState)(null);
    // Fetch conflicts on component mount
    (0, react_1.useEffect)(() => {
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
        var _a;
        setSelectedConflict(conflict);
        // Default to the suggested resolution if available
        setSelectedDocId(((_a = conflict.suggestedResolution) === null || _a === void 0 ? void 0 : _a.preferredDocId) || null);
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
            [conflictDetection_1.ConflictType.CONTRADICTORY]: { bg: 'bg-red-100', text: 'text-red-800' },
            [conflictDetection_1.ConflictType.OUTDATED]: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
            [conflictDetection_1.ConflictType.INCOMPLETE]: { bg: 'bg-blue-100', text: 'text-blue-800' },
            [conflictDetection_1.ConflictType.DUPLICATE]: { bg: 'bg-gray-100', text: 'text-gray-800' }
        };
        const style = styles[type];
        return (<span className={`px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}
      </span>);
    };
    return (<div className="container mx-auto px-4 py-8">
      <head_1.default>
        <title>Content Conflicts | Admin Dashboard</title>
      </head_1.default>
      
      <Box_1.default display="flex" justifyContent="space-between" alignItems="center" className="mb-6">
        <div>
          <Typography_1.default variant="h4" className="font-bold">Content Conflicts</Typography_1.default>
          <Typography_1.default variant="body2" color="textSecondary">
            Manage conflicting information in the knowledge base
          </Typography_1.default>
        </div>
        
        <Button_1.default variant="outline" onClick={fetchConflicts} disabled={loading}>
          Refresh Conflicts
        </Button_1.default>
      </Box_1.default>
      
      {/* Success message */}
      {successMessage && (<Alert_1.default severity="success" className="mb-4" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert_1.default>)}
      
      {/* Error message */}
      {error && (<Alert_1.default severity="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert_1.default>)}
      
      {/* Tabs for filtering */}
      <Tabs_1.Tabs value={currentTab} onChange={handleTabChange} className="mb-4">
        <Tabs_2.Tab value="all" label="All Conflicts"/>
        <Tabs_2.Tab value="high-priority" label="High Priority"/>
        <Tabs_2.Tab value="leadership" label="Leadership"/>
        <Tabs_2.Tab value="pricing" label="Pricing"/>
        <Tabs_2.Tab value="features" label="Features"/>
      </Tabs_1.Tabs>
      
      {/* Loading state */}
      {loading && (<div className="flex justify-center items-center h-64">
          <CircularProgress_1.default />
        </div>)}
      
      {/* No conflicts state */}
      {!loading && filteredConflicts.length === 0 && (<Paper_1.default className="p-8 text-center">
          <Typography_1.default variant="h6" className="text-gray-500">
            No conflicts found
          </Typography_1.default>
          <Typography_1.default variant="body2" color="textSecondary" className="mt-2">
            {currentTab !== 'all'
                ? `No ${currentTab} conflicts detected in the knowledge base`
                : 'No conflicts detected in the knowledge base'}
          </Typography_1.default>
        </Paper_1.default>)}
      
      {/* Conflicts list */}
      {!loading && filteredConflicts.length > 0 && (<div className="space-y-6">
          {filteredConflicts.map((conflict, index) => (<Paper_1.default key={`${conflict.topic}-${index}`} className="overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
                <div>
                  <Typography_1.default variant="h6" className="font-semibold">
                    {conflict.topic}{conflict.entityName ? `: ${conflict.entityName}` : ''}
                  </Typography_1.default>
                  <div className="flex items-center mt-1 space-x-2">
                    {conflict.isHighPriority && (<span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        High Priority
                      </span>)}
                    {conflict.conflicts.map((c, i) => (<span key={i} className="mr-2">
                        {renderConflictBadge(c.type)}
                      </span>))}
                  </div>
                </div>
                <Button_1.default variant="primary" onClick={() => handleOpenResolveDialog(conflict)} disabled={resolvingConflict === conflict.topic}>
                  {resolvingConflict === conflict.topic ? (<CircularProgress_1.default size={24} color="primary" className="mr-2"/>) : null}
                  Resolve Conflict
                </Button_1.default>
              </div>
              
              <div className="p-4">
                {conflict.conflicts.map((c, i) => (<div key={i} className="mb-4">
                    <Typography_1.default variant="subtitle2" className="font-medium mb-2">
                      {c.description}
                    </Typography_1.default>
                    <div className="pl-4 border-l-4 border-gray-200">
                      {c.affectedDocIds.map((docId) => {
                        var _a;
                        const doc = conflict.documents.find(d => { var _a; return ((_a = d.metadata) === null || _a === void 0 ? void 0 : _a.source) === docId; });
                        return doc ? (<div key={docId} className="mb-2 p-3 bg-gray-50 rounded">
                            <div className="flex justify-between items-center mb-2">
                              <Typography_1.default variant="caption" className="text-gray-500">
                                ID: {docId}
                              </Typography_1.default>
                              <Typography_1.default variant="caption" className="text-gray-500">
                                {((_a = doc.metadata) === null || _a === void 0 ? void 0 : _a.lastUpdated)
                                ? `Last updated: ${new Date(doc.metadata.lastUpdated).toLocaleDateString()}`
                                : ''}
                              </Typography_1.default>
                            </div>
                            <Typography_1.default variant="body2">
                              {(0, conflictDetection_1.formatDocumentSnippet)(doc, 200)}
                            </Typography_1.default>
                          </div>) : null;
                    })}
                    </div>
                  </div>))}
                
                {conflict.suggestedResolution && (<div className="mt-4 p-4 bg-green-50 rounded">
                    <Typography_1.default variant="subtitle2" className="font-medium">
                      Suggested Resolution
                    </Typography_1.default>
                    <Typography_1.default variant="body2">
                      {conflict.suggestedResolution.reason}
                    </Typography_1.default>
                  </div>)}
              </div>
            </Paper_1.default>))}
        </div>)}
      
      {/* Resolution Dialog */}
      <Dialog_1.default open={resolveDialogOpen} onClose={handleCloseResolveDialog} title={`Resolve ${selectedConflict === null || selectedConflict === void 0 ? void 0 : selectedConflict.topic} Conflict`} actions={<>
            <Button_1.default variant="secondary" onClick={handleCloseResolveDialog}>
              Cancel
            </Button_1.default>
            <Button_1.default variant="primary" onClick={handleResolveConflict} disabled={!selectedDocId || resolvingConflict !== null}>
              {resolvingConflict ? 'Resolving...' : 'Confirm Resolution'}
            </Button_1.default>
          </>}>
        {selectedConflict && (<div className="max-w-2xl">
            <Typography_1.default variant="body1" className="mb-4">
              Select the document with the correct information. Other documents will be marked as deprecated.
            </Typography_1.default>
            
            <div className="space-y-4 mt-4">
              {selectedConflict.documents.map((doc) => {
                var _a, _b;
                const docId = ((_a = doc.metadata) === null || _a === void 0 ? void 0 : _a.source) || '';
                return (<div key={docId} className={`p-4 border rounded cursor-pointer transition-colors ${selectedDocId === docId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:bg-gray-50'}`} onClick={() => setSelectedDocId(docId)}>
                    <div className="flex items-center mb-2">
                      <input type="radio" checked={selectedDocId === docId} onChange={() => setSelectedDocId(docId)} className="mr-2 h-4 w-4 text-blue-600"/>
                      <Typography_1.default variant="subtitle2" className="font-medium">
                        Document ID: {docId}
                      </Typography_1.default>
                    </div>
                    <div className="ml-6">
                      <Typography_1.default variant="body2">
                        {(0, conflictDetection_1.formatDocumentSnippet)(doc, 150)}
                      </Typography_1.default>
                      <div className="mt-2 text-xs text-gray-500">
                        {((_b = doc.metadata) === null || _b === void 0 ? void 0 : _b.lastUpdated) && (<span>Last updated: {new Date(doc.metadata.lastUpdated).toLocaleString()}</span>)}
                      </div>
                    </div>
                  </div>);
            })}
            </div>
            
            {selectedConflict.suggestedResolution && (<div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded">
                <Typography_1.default variant="body2">
                  <strong>Suggestion:</strong> {selectedConflict.suggestedResolution.reason}
                </Typography_1.default>
              </div>)}
          </div>)}
      </Dialog_1.default>
    </div>);
}
/**
 * Server-side props
 */
const getServerSideProps = async (context) => {
    // In a real implementation, you might want to check authentication/authorization here
    return {
        props: {}
    };
};
exports.getServerSideProps = getServerSideProps;

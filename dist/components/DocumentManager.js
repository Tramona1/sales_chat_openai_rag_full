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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DocumentManager;
const react_1 = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
function DocumentManager({ limit = 50 }) {
    const [documents, setDocuments] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [searchTerm, setSearchTerm] = (0, react_1.useState)('');
    const [selectedFilter, setSelectedFilter] = (0, react_1.useState)('all');
    const [contentTypes, setContentTypes] = (0, react_1.useState)([]);
    const [refreshTrigger, setRefreshTrigger] = (0, react_1.useState)(0);
    // Fetch documents from the API
    (0, react_1.useEffect)(() => {
        const fetchDocuments = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/admin/documents${limit ? `?limit=${limit}` : ''}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch documents: ${response.statusText}`);
                }
                const data = await response.json();
                setDocuments(data);
                // Extract unique content types with proper type assertion
                const types = [...new Set(data.map((doc) => { var _a; return ((_a = doc.metadata) === null || _a === void 0 ? void 0 : _a.contentType) || 'Unknown'; }))];
                setContentTypes(types);
                setError(null);
            }
            catch (err) {
                console.error('Error fetching documents:', err);
                setError(err instanceof Error ? err.message : 'Unknown error occurred');
            }
            finally {
                setLoading(false);
            }
        };
        fetchDocuments();
    }, [limit, refreshTrigger]);
    // Filter documents based on search term and selected filter
    const filteredDocuments = documents.filter(doc => {
        var _a;
        const matchesSearch = searchTerm.trim() === '' ||
            doc.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.source.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = selectedFilter === 'all' ||
            ((_a = doc.metadata) === null || _a === void 0 ? void 0 : _a.contentType) === selectedFilter;
        return matchesSearch && matchesFilter;
    });
    // Handle document deletion
    const handleDeleteDocument = async (documentId) => {
        if (!confirm('Are you sure you want to delete this document?')) {
            return;
        }
        try {
            const response = await fetch(`/api/admin/documents/${documentId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error(`Failed to delete document: ${response.status} ${response.statusText}`);
            }
            // Refresh document list
            setRefreshTrigger(prev => prev + 1);
        }
        catch (err) {
            console.error('Error deleting document:', err);
            alert(err instanceof Error ? err.message : 'Unknown error deleting document');
        }
    };
    // Handle refresh
    const handleRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
    };
    // Truncate text for preview
    const truncateText = (text, maxLength = 200) => {
        if (text.length <= maxLength)
            return text;
        return text.substring(0, maxLength) + '...';
    };
    // Format date
    const formatDate = (dateString) => {
        if (!dateString)
            return 'Unknown';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        }
        catch (e) {
            return 'Invalid date';
        }
    };
    if (loading && documents.length === 0) {
        return (react_1.default.createElement("div", { className: "p-6 bg-white rounded-lg shadow" },
            react_1.default.createElement("div", { className: "animate-pulse flex space-x-4" },
                react_1.default.createElement("div", { className: "flex-1 space-y-4 py-1" },
                    react_1.default.createElement("div", { className: "h-4 bg-gray-200 rounded w-3/4" }),
                    react_1.default.createElement("div", { className: "space-y-2" },
                        react_1.default.createElement("div", { className: "h-4 bg-gray-200 rounded" }),
                        react_1.default.createElement("div", { className: "h-4 bg-gray-200 rounded w-5/6" })))),
            react_1.default.createElement("p", { className: "text-center text-gray-500 mt-4" }, "Loading documents...")));
    }
    if (error && documents.length === 0) {
        return (react_1.default.createElement("div", { className: "p-6 bg-white rounded-lg shadow border-l-4 border-red-500" },
            react_1.default.createElement("h3", { className: "text-lg font-medium text-red-800" }, "Error Loading Documents"),
            react_1.default.createElement("p", { className: "mt-2 text-red-600" }, error),
            react_1.default.createElement("button", { onClick: handleRefresh, className: "mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition" }, "Retry")));
    }
    return (react_1.default.createElement("div", { className: "bg-white rounded-lg shadow overflow-hidden" },
        react_1.default.createElement("div", { className: "p-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" },
            react_1.default.createElement("h2", { className: "font-medium text-gray-800 flex items-center" },
                react_1.default.createElement(lucide_react_1.FileText, { className: "h-5 w-5 mr-2 text-primary-600" }),
                "Document Management"),
            react_1.default.createElement("div", { className: "flex gap-3 w-full sm:w-auto" },
                react_1.default.createElement("div", { className: "relative flex-grow sm:flex-grow-0" },
                    react_1.default.createElement(lucide_react_1.Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" }),
                    react_1.default.createElement("input", { type: "text", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), placeholder: "Search documents...", className: "pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500" })),
                react_1.default.createElement("div", { className: "relative" },
                    react_1.default.createElement(lucide_react_1.Filter, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" }),
                    react_1.default.createElement("select", { value: selectedFilter, onChange: (e) => setSelectedFilter(e.target.value), className: "pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none" },
                        react_1.default.createElement("option", { value: "all" }, "All Types"),
                        contentTypes.map((type) => (react_1.default.createElement("option", { key: type, value: type }, type))))),
                react_1.default.createElement("button", { onClick: handleRefresh, className: "p-2 rounded-md bg-gray-100 hover:bg-gray-200 transition", title: "Refresh documents" },
                    react_1.default.createElement(lucide_react_1.RefreshCw, { className: "h-5 w-5 text-gray-600" })))),
        documents.length === 0 ? (react_1.default.createElement("div", { className: "p-8 text-center text-gray-500" }, "No documents found in the vector store.")) : filteredDocuments.length === 0 ? (react_1.default.createElement("div", { className: "p-8 text-center text-gray-500" }, "No documents match your search criteria.")) : (react_1.default.createElement("div", { className: "overflow-x-auto" },
            react_1.default.createElement("table", { className: "min-w-full divide-y divide-gray-200" },
                react_1.default.createElement("thead", { className: "bg-gray-50" },
                    react_1.default.createElement("tr", null,
                        react_1.default.createElement("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, "Source"),
                        react_1.default.createElement("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, "Content Preview"),
                        react_1.default.createElement("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, "Type"),
                        react_1.default.createElement("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, "Last Updated"),
                        react_1.default.createElement("th", { scope: "col", className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" }, "Actions"))),
                react_1.default.createElement("tbody", { className: "bg-white divide-y divide-gray-200" }, filteredDocuments.map((doc) => {
                    var _a, _b, _c;
                    return (react_1.default.createElement("tr", { key: doc.id, className: "hover:bg-gray-50" },
                        react_1.default.createElement("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" },
                            doc.source,
                            ((_a = doc.metadata) === null || _a === void 0 ? void 0 : _a.page) && react_1.default.createElement("span", { className: "text-gray-500 ml-1" },
                                "p.",
                                doc.metadata.page)),
                        react_1.default.createElement("td", { className: "px-6 py-4 text-sm text-gray-500 max-w-md truncate" }, truncateText(doc.text)),
                        react_1.default.createElement("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" },
                            react_1.default.createElement("span", { className: "px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800" }, ((_b = doc.metadata) === null || _b === void 0 ? void 0 : _b.contentType) || 'Unknown')),
                        react_1.default.createElement("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, formatDate((_c = doc.metadata) === null || _c === void 0 ? void 0 : _c.lastUpdated)),
                        react_1.default.createElement("td", { className: "px-6 py-4 whitespace-nowrap text-right text-sm font-medium" },
                            react_1.default.createElement("button", { onClick: () => handleDeleteDocument(doc.id), className: "text-red-600 hover:text-red-900", title: "Delete document" },
                                react_1.default.createElement(lucide_react_1.Trash2, { className: "h-5 w-5" })))));
                }))))),
        react_1.default.createElement("div", { className: "bg-gray-50 px-6 py-3 border-t border-gray-200 text-sm text-gray-500" },
            "Showing ",
            filteredDocuments.length,
            " of ",
            documents.length,
            " documents")));
}

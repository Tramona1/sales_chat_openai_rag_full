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
const axios_1 = __importDefault(require("axios"));
const lucide_react_1 = require("lucide-react");
const FileUpload = ({ onUploadComplete }) => {
    const [file, setFile] = (0, react_1.useState)(null);
    const [uploading, setUploading] = (0, react_1.useState)(false);
    const [uploadStatus, setUploadStatus] = (0, react_1.useState)('');
    const [previewUrl, setPreviewUrl] = (0, react_1.useState)(null);
    const handleFileChange = (e) => {
        var _a;
        const selectedFile = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (selectedFile) {
            setFile(selectedFile);
            setUploadStatus('');
            // Create preview for images
            if (selectedFile.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreviewUrl(reader.result);
                };
                reader.readAsDataURL(selectedFile);
            }
            else {
                setPreviewUrl(null);
            }
        }
    };
    const clearFile = () => {
        setFile(null);
        setPreviewUrl(null);
        const fileInput = document.querySelector('input[type=file]');
        if (fileInput)
            fileInput.value = '';
    };
    const handleUpload = async () => {
        if (!file) {
            setUploadStatus('Please select a file first');
            return;
        }
        setUploading(true);
        setUploadStatus('Uploading...');
        const formData = new FormData();
        formData.append('file', file);
        try {
            // For images, we'll use a different endpoint that includes OCR
            const endpoint = file.type.startsWith('image/') ? '/api/uploadImage' : '/api/upload';
            const res = await axios_1.default.post(endpoint, formData);
            setUploadStatus(res.data.message);
            onUploadComplete(res.data.message);
            setFile(null);
            setPreviewUrl(null);
            // Reset file input
            const fileInput = document.querySelector('input[type=file]');
            if (fileInput)
                fileInput.value = '';
        }
        catch (error) {
            console.error('Upload error:', error);
            setUploadStatus('Upload failed. Please try again.');
        }
        finally {
            setUploading(false);
        }
    };
    const getFileIcon = () => {
        if (!file)
            return <lucide_react_1.File className="h-5 w-5 text-gray-400"/>;
        if (file.type.startsWith('image/')) {
            return <lucide_react_1.Image className="h-5 w-5 text-blue-500"/>;
        }
        else if (file.type.includes('pdf')) {
            return <lucide_react_1.File className="h-5 w-5 text-red-500"/>;
        }
        else if (file.type.includes('word') || file.type.includes('doc')) {
            return <lucide_react_1.File className="h-5 w-5 text-blue-500"/>;
        }
        else {
            return <lucide_react_1.File className="h-5 w-5 text-gray-500"/>;
        }
    };
    return (<div className="space-y-4">
      {previewUrl && (<div className="relative border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-48 object-contain bg-white"/>
          <button onClick={clearFile} className="absolute top-2 right-2 bg-white text-gray-700 rounded-full p-1 shadow-sm hover:bg-gray-100">
            <lucide_react_1.X className="h-4 w-4"/>
          </button>
        </div>)}
      
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"/>
          <div className="flex items-center border border-gray-200 bg-white rounded-lg px-4 py-3 shadow-sm">
            {getFileIcon()}
            <span className="flex-1 truncate ml-3 text-gray-700">
              {file ? file.name : 'Select PDF, DOCX, TXT, or image...'}
            </span>
          </div>
        </div>
        
        <button onClick={handleUpload} disabled={uploading || !file} className={`flex items-center px-4 py-3 rounded-lg font-medium ${uploading || !file
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'}`}>
          {uploading ? (<>
              <lucide_react_1.Loader2 className="h-4 w-4 mr-2 animate-spin"/>
              Uploading
            </>) : (<>
              <lucide_react_1.Upload className="h-4 w-4 mr-2"/>
              Upload
            </>)}
        </button>
      </div>
      
      {uploadStatus && (<p className={`text-sm ${uploadStatus.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>
          {uploadStatus}
        </p>)}
    </div>);
};
exports.default = FileUpload;

import React, { useState } from 'react';
import axios from 'axios';
import { Upload, File, Loader2, X, Image as ImageIcon } from 'lucide-react';

interface FileUploadProps {
  onUploadComplete: (message: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadStatus('');
      
      // Create preview for images
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreviewUrl(null);
    const fileInput = document.querySelector('input[type=file]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
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
      const res = await axios.post(endpoint, formData);
      
      setUploadStatus(res.data.message);
      onUploadComplete(res.data.message);
      setFile(null);
      setPreviewUrl(null);
      
      // Reset file input
      const fileInput = document.querySelector('input[type=file]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = () => {
    if (!file) return <File className="h-5 w-5 text-gray-400" />;
    
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    } else if (file.type.includes('pdf')) {
      return <File className="h-5 w-5 text-red-500" />;
    } else if (file.type.includes('word') || file.type.includes('doc')) {
      return <File className="h-5 w-5 text-blue-500" />;
    } else {
      return <File className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {previewUrl && (
        <div className="relative border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-48 object-contain bg-white" />
          <button 
            onClick={clearFile}
            className="absolute top-2 right-2 bg-white text-gray-700 rounded-full p-1 shadow-sm hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="file"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
          />
          <div className="flex items-center border border-gray-200 bg-white rounded-lg px-4 py-3 shadow-sm">
            {getFileIcon()}
            <span className="flex-1 truncate ml-3 text-gray-700">
              {file ? file.name : 'Select PDF, DOCX, TXT, or image...'}
            </span>
          </div>
        </div>
        
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className={`flex items-center px-4 py-3 rounded-lg font-medium ${
            uploading || !file
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </>
          )}
        </button>
      </div>
      
      {uploadStatus && (
        <p className={`text-sm ${uploadStatus.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>
          {uploadStatus}
        </p>
      )}
    </div>
  );
};

export default FileUpload; 
import React, { useState, useRef } from 'react';
import VisualDocumentIcon from './ui/icons/VisualDocumentIcon';

interface UploadFormProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface FormState {
  files: File[];
  isUploading: boolean;
  contextualProcessing: boolean;
  visualProcessing: boolean;
  error: string | null;
  success: string | null;
}

export default function UploadForm({ onSuccess, onError }: UploadFormProps) {
  const [formState, setFormState] = useState<FormState>({
    files: [],
    isUploading: false,
    contextualProcessing: true,
    visualProcessing: true,
    error: null,
    success: null
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // List of accepted file types
  const acceptedFileTypes = [
    'application/pdf', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  // File type display names
  const fileTypeNames: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
    'text/plain': 'Text File',
    'image/jpeg': 'JPEG Image',
    'image/png': 'PNG Image',
    'image/gif': 'GIF Image',
    'image/webp': 'WebP Image'
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    // Filter out unsupported file types
    const validFiles = selectedFiles.filter(file => 
      acceptedFileTypes.includes(file.type)
    );
    
    // Check if any files were filtered out
    if (validFiles.length < selectedFiles.length) {
      setFormState(prev => ({
        ...prev,
        error: 'Some files were not added because they are not supported.'
      }));
    }
    
    setFormState(prev => ({
      ...prev,
      files: [...prev.files, ...validFiles],
      error: validFiles.length === 0 && prev.files.length === 0 
        ? 'Please select at least one supported file.' 
        : prev.error
    }));
  };
  
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };
  
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(event.dataTransfer.files);
      
      // Filter out unsupported file types
      const validFiles = droppedFiles.filter(file => 
        acceptedFileTypes.includes(file.type)
      );
      
      // Check if any files were filtered out
      if (validFiles.length < droppedFiles.length) {
        setFormState(prev => ({
          ...prev,
          error: 'Some files were not added because they are not supported.'
        }));
      }
      
      setFormState(prev => ({
        ...prev,
        files: [...prev.files, ...validFiles],
        error: validFiles.length === 0 && prev.files.length === 0 
          ? 'Please select at least one supported file.' 
          : prev.error
      }));
    }
  };
  
  const removeFile = (index: number) => {
    setFormState(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
      error: prev.files.length <= 1 ? 'Please select at least one file.' : null
    }));
  };
  
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (formState.files.length === 0) {
      setFormState(prev => ({
        ...prev,
        error: 'Please select at least one file to upload.'
      }));
      return;
    }
    
    setFormState(prev => ({
      ...prev,
      isUploading: true,
      error: null,
      success: null
    }));
    
    try {
      const formData = new FormData();
      
      // Append each file to the FormData
      formState.files.forEach((file, index) => {
        formData.append(`file${index}`, file);
      });
      
      // Add processing options
      formData.append('fileCount', formState.files.length.toString());
      formData.append('contextual', formState.contextualProcessing.toString());
      formData.append('visualProcessing', formState.visualProcessing.toString());
      
      // Send the request
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload files');
      }
      
      const result = await response.json();
      
      setFormState(prev => ({
        ...prev,
        isUploading: false,
        success: `Successfully uploaded ${formState.files.length} file(s).`,
        files: [] // Clear the files after successful upload
      }));
      
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      setFormState(prev => ({
        ...prev,
        isUploading: false,
        error: errorMessage
      }));
      
      if (onError) {
        onError(errorMessage);
      }
    }
  };
  
  const getFileIcon = (file: File) => {
    if (file.type.includes('image')) {
      return <VisualDocumentIcon size={20} className="mr-2 text-blue-500" />;
    } else if (file.type.includes('pdf')) {
      return (
        <svg className="w-5 h-5 mr-2 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
          <path d="M3 8a2 2 0 012-2h2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
        </svg>
      );
    } else if (file.type.includes('word')) {
      return (
        <svg className="w-5 h-5 mr-2 text-blue-700" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    } else {
      return (
        <svg className="w-5 h-5 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    }
  };
  
  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Upload Documents</h2>
        
        {formState.error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{formState.error}</p>
          </div>
        )}
        
        {formState.success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            <p>{formState.success}</p>
          </div>
        )}
        
        <div 
          className="border-2 border-dashed border-gray-300 rounded-md p-6 mb-4 text-center cursor-pointer hover:border-blue-500 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            ref={fileInputRef}
            accept={acceptedFileTypes.join(',')}
          />
          
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          
          <p className="mt-2 text-sm text-gray-600">
            Drag and drop files here, or click to select files
          </p>
          
          <p className="mt-1 text-xs text-gray-500">
            Supported formats: PDF, Word, Text, and Images (JPEG, PNG, GIF, WebP)
          </p>
        </div>
        
        {formState.files.length > 0 && (
          <div className="mb-4">
            <h3 className="text-md font-medium mb-2">Selected Files</h3>
            <ul className="bg-gray-50 rounded-md divide-y divide-gray-200">
              {formState.files.map((file, index) => (
                <li key={index} className="flex items-center justify-between py-3 px-4">
                  <div className="flex items-center">
                    {getFileIcon(file)}
                    <span className="text-sm">{file.name}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      ({(file.size / 1024).toFixed(1)} KB, {fileTypeNames[file.type] || file.type})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="space-y-3 mb-4">
          <div className="flex items-center">
            <input
              id="contextualProcessing"
              type="checkbox"
              checked={formState.contextualProcessing}
              onChange={e => setFormState(prev => ({ ...prev, contextualProcessing: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="contextualProcessing" className="ml-2 block text-sm text-gray-700">
              Enable contextual processing (improved document understanding)
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              id="visualProcessing"
              type="checkbox"
              checked={formState.visualProcessing}
              onChange={e => setFormState(prev => ({ ...prev, visualProcessing: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="visualProcessing" className="ml-2 block text-sm text-gray-700">
              Enable visual content processing (for images, charts, diagrams)
            </label>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={formState.isUploading || formState.files.length === 0}
            className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              (formState.isUploading || formState.files.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {formState.isUploading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </>
            ) : (
              'Upload'
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 
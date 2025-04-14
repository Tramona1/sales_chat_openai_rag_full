import React, { useState } from 'react';
import axios from 'axios';
import { FileText, Loader2 } from 'lucide-react';
const DirectTextInput = ({ onUploadComplete }) => {
    const [text, setText] = useState('');
    const [title, setTitle] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const handleSubmit = async () => {
        if (!text.trim()) {
            setUploadStatus('Please enter some text');
            return;
        }
        setUploading(true);
        setUploadStatus('Processing...');
        try {
            const res = await axios.post('/api/uploadText', {
                text,
                title: title.trim() || 'Direct Text Input'
            });
            setUploadStatus(res.data.message);
            onUploadComplete(res.data.message);
            setText('');
            setTitle('');
        }
        catch (error) {
            console.error('Error processing text:', error);
            setUploadStatus('Failed to process text. Please try again.');
        }
        finally {
            setUploading(false);
        }
    };
    return (<div className="space-y-4">
      <input type="text" placeholder="Title for this knowledge (optional)" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-3 border border-gray-200 rounded-lg bg-white text-gray-800 shadow-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-300 focus:outline-none"/>
      
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste or enter your knowledge here..." className="w-full h-40 p-3 border border-gray-200 rounded-lg bg-white text-gray-800 shadow-sm resize-y focus:ring-2 focus:ring-primary-300 focus:border-primary-300 focus:outline-none"/>
      
      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={uploading || !text.trim()} className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${uploading || !text.trim()
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'}`}>
          {uploading ? (<>
              <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
              Processing
            </>) : (<>
              <FileText className="h-4 w-4 mr-2"/>
              Save & Process
            </>)}
        </button>
      </div>
      
      {uploadStatus && (<p className={`text-sm ${uploadStatus.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>
          {uploadStatus}
        </p>)}
    </div>);
};
export default DirectTextInput;

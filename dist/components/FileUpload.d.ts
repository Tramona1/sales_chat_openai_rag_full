import React from 'react';
interface FileUploadProps {
    onUploadComplete: (message: string) => void;
}
declare const FileUpload: React.FC<FileUploadProps>;
export default FileUpload;

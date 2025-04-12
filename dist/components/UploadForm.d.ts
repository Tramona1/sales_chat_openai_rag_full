import React from 'react';
interface UploadFormProps {
    onSuccess?: () => void;
    onError?: (error: string) => void;
}
export default function UploadForm({ onSuccess, onError }: UploadFormProps): React.JSX.Element;
export {};

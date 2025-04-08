import React from 'react';
export interface DocumentToEdit {
    id: string;
    text: string;
    metadata: {
        source?: string;
        category?: string;
        technicalLevel?: number;
        keywords?: string;
        entities?: string;
        summary?: string;
        [key: string]: any;
    };
}
interface EditDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    document: DocumentToEdit | null;
    onSave: (updatedDocument: DocumentToEdit) => Promise<void>;
}
declare const EditDocumentModal: React.FC<EditDocumentModalProps>;
export default EditDocumentModal;

import React from 'react';
interface DialogProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
}
declare const Dialog: React.FC<DialogProps>;
export default Dialog;

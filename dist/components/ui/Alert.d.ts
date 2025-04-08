import React from 'react';
interface AlertProps {
    children: React.ReactNode;
    severity?: 'error' | 'warning' | 'info' | 'success';
    onClose?: () => void;
    variant?: 'standard' | 'filled' | 'outlined';
    className?: string;
}
declare const Alert: React.FC<AlertProps>;
export default Alert;

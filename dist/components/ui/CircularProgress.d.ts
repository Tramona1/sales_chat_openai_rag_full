import React from 'react';
interface CircularProgressProps {
    size?: number;
    color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
    className?: string;
}
declare const CircularProgress: React.FC<CircularProgressProps>;
export default CircularProgress;

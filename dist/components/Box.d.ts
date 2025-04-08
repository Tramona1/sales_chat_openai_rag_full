import React from 'react';
interface BoxProps {
    children: React.ReactNode;
    sx?: Record<string, any>;
    className?: string;
    style?: React.CSSProperties;
}
/**
 * Simple Box component to replace MUI Box in case of compatibility issues
 */
declare const Box: React.FC<BoxProps>;
export default Box;

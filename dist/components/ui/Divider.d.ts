import React from 'react';
interface DividerProps {
    orientation?: 'horizontal' | 'vertical';
    variant?: 'fullWidth' | 'inset' | 'middle';
    light?: boolean;
    className?: string;
    textAlign?: 'center' | 'left' | 'right';
    children?: React.ReactNode;
}
declare const Divider: React.FC<DividerProps>;
export default Divider;

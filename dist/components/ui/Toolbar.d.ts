import React, { ReactNode } from 'react';
interface ToolbarProps {
    children?: ReactNode;
    className?: string;
    variant?: 'regular' | 'dense';
}
declare const Toolbar: React.FC<ToolbarProps>;
export default Toolbar;

import React, { ReactNode } from 'react';
interface AppBarProps {
    children: ReactNode;
    position?: 'fixed' | 'static' | 'relative' | 'absolute' | 'sticky';
    className?: string;
    sx?: Record<string, any>;
}
declare const AppBar: React.FC<AppBarProps>;
export default AppBar;

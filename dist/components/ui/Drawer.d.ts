import React, { ReactNode } from 'react';
interface DrawerProps {
    children: ReactNode;
    open?: boolean;
    onClose?: () => void;
    variant?: 'permanent' | 'temporary' | 'persistent';
    anchor?: 'left' | 'right' | 'top' | 'bottom';
    className?: string;
    sx?: Record<string, any>;
    ModalProps?: {
        keepMounted?: boolean;
    };
}
declare const Drawer: React.FC<DrawerProps>;
export default Drawer;

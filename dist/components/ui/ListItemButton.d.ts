import React, { ReactNode } from 'react';
interface ListItemButtonProps {
    children: ReactNode;
    className?: string;
    selected?: boolean;
    onClick?: () => void;
    disabled?: boolean;
}
declare const ListItemButton: React.FC<ListItemButtonProps>;
export default ListItemButton;

import React, { ReactNode } from 'react';
interface ListItemProps {
    children: ReactNode;
    className?: string;
    disablePadding?: boolean;
    button?: boolean;
    selected?: boolean;
    onClick?: () => void;
}
declare const ListItem: React.FC<ListItemProps>;
export default ListItem;

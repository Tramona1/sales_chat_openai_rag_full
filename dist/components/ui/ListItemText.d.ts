import React, { ReactNode } from 'react';
interface ListItemTextProps {
    primary: ReactNode;
    secondary?: ReactNode;
    className?: string;
}
declare const ListItemText: React.FC<ListItemTextProps>;
export default ListItemText;

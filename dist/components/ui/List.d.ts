import React, { ReactNode } from 'react';
interface ListProps {
    children: ReactNode;
    className?: string;
    disablePadding?: boolean;
    dense?: boolean;
    subheader?: ReactNode;
}
declare const List: React.FC<ListProps>;
export default List;

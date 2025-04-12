import React, { ReactNode } from 'react';
interface IconButtonProps {
    children: ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    color?: 'default' | 'primary' | 'secondary' | 'error' | 'success' | 'warning' | 'inherit';
    size?: 'small' | 'medium' | 'large';
    edge?: 'start' | 'end' | false;
    disabled?: boolean;
    className?: string;
    'aria-label': string;
    sx?: Record<string, any>;
}
declare const IconButton: React.FC<IconButtonProps>;
export default IconButton;

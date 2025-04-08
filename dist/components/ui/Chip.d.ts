import React from 'react';
interface ChipProps {
    label: string;
    onDelete?: () => void;
    color?: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
    variant?: 'filled' | 'outlined';
    size?: 'small' | 'medium';
    className?: string;
    icon?: React.ReactNode;
    clickable?: boolean;
    onClick?: () => void;
}
declare const Chip: React.FC<ChipProps>;
export default Chip;

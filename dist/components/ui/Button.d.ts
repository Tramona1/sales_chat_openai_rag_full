import React from 'react';
interface ButtonProps {
    children: React.ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    variant?: 'primary' | 'secondary' | 'error' | 'outline';
    size?: 'small' | 'medium' | 'large';
    fullWidth?: boolean;
    disabled?: boolean;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
    autoFocus?: boolean;
}
declare const Button: React.FC<ButtonProps>;
export default Button;

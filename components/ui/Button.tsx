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

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
  className = '',
  type = 'button',
  autoFocus = false
}) => {
  // Base styles
  const baseStyles = 'font-medium rounded transition-colors focus:outline-none';
  
  // Size styles
  const sizeStyles = {
    small: 'px-3 py-1 text-sm',
    medium: 'px-4 py-2',
    large: 'px-6 py-3 text-lg'
  };
  
  // Variant styles
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400',
    error: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    outline: 'bg-transparent border border-blue-600 text-blue-600 hover:bg-blue-50 active:bg-blue-100'
  };
  
  // Width styles
  const widthStyles = fullWidth ? 'w-full' : '';
  
  // Disabled styles
  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';
  
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyles} ${disabledStyles} ${className}`}
      disabled={disabled}
      autoFocus={autoFocus}
    >
      {children}
    </button>
  );
};

export default Button; 
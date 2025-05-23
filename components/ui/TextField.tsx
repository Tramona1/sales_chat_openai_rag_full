import React, { InputHTMLAttributes } from 'react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: boolean;
  fullWidth?: boolean;
  variant?: 'outlined' | 'filled' | 'standard';
  size?: 'small' | 'medium';
  multiline?: boolean;
  rows?: number;
  className?: string;
}

const TextField: React.FC<TextFieldProps> = ({
  label,
  helperText,
  error = false,
  fullWidth = false,
  variant = 'outlined',
  size = 'medium',
  multiline = false,
  rows = 1,
  className = '',
  ...inputProps
}) => {
  // Base styles
  const baseStyles = 'transition-colors focus:outline-none border rounded';
  
  // Size styles
  const sizeStyles = size === 'small' ? 'px-3 py-1 text-sm' : 'px-4 py-2';
  
  // Variant styles
  const variantStyles = {
    outlined: 'border border-gray-300 focus:border-blue-500 bg-white',
    filled: 'border-none bg-gray-100 focus:bg-gray-200',
    standard: 'border-x-0 border-t-0 border-b border-gray-300 rounded-none focus:border-blue-500'
  };
  
  // Error styles
  const errorStyles = error ? 'border-red-500 focus:border-red-600' : '';
  
  // Width styles
  const widthStyles = fullWidth ? 'w-full' : '';
  
  // Render input element or textarea based on multiline prop
  const renderInputElement = () => {
    if (multiline) {
      return (
        <textarea
          className={`${baseStyles} ${sizeStyles} ${variantStyles[variant]} ${errorStyles} ${widthStyles} ${className}`}
          rows={rows}
          {...(inputProps as any)}
        />
      );
    }
    
    return (
      <input
        className={`${baseStyles} ${sizeStyles} ${variantStyles[variant]} ${errorStyles} ${widthStyles} ${className}`}
        {...inputProps}
      />
    );
  };
  
  return (
    <div className={`flex flex-col ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label className="mb-1 text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      {renderInputElement()}
      {helperText && (
        <p className={`mt-1 text-xs ${error ? 'text-red-500' : 'text-gray-500'}`}>
          {helperText}
        </p>
      )}
    </div>
  );
};

export default TextField; 
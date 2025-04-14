/**
 * Button Component
 * 
 * A customizable button component that can be used throughout the application
 * with consistent styling. This replaces the MUI Button component.
 */

import React, { ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'contained' | 'outlined' | 'text' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'outline';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'default';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  fullWidth = false,
  startIcon,
  endIcon,
  loading = false,
  disabled = false,
  children,
  className = '',
  ...rest
}, ref) => {
  // Map legacy MUI-style variants to new variants
  let mappedVariant: 'contained' | 'outlined' | 'text' = 'contained';
  
  // Handle legacy variant names for backward compatibility
  if (variant === 'primary' || variant === 'secondary' || variant === 'error' || 
      variant === 'warning' || variant === 'info' || variant === 'success') {
    // Map these color variants to 'contained' variant, and use the value as color
    mappedVariant = 'contained';
    color = variant as any;
  } else if (variant === 'outline' || variant === 'outlined') {
    mappedVariant = 'outlined';
  } else if (variant === 'text') {
    mappedVariant = 'text';
  } else {
    mappedVariant = variant as 'contained' | 'outlined' | 'text';
  }
  
  // Base classes that apply to all variants
  const baseClasses = 'font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  // Size-specific classes
  const sizeClasses = size === 'small' ? 'px-2.5 py-1.5 text-xs' :
                    size === 'large' ? 'px-6 py-3 text-base' :
                    'px-4 py-2 text-sm';
  
  // Full width class
  const widthClass = fullWidth ? 'w-full' : '';
  
  // Disabled state
  const isDisabled = disabled || loading;
  const disabledClass = isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';
  
  // Classes based on variant and color
  let variantClasses = '';
  
  if (mappedVariant === 'contained') {
    // Contained buttons (filled background)
    switch (color) {
      case 'primary':
        variantClasses = 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500';
        break;
      case 'secondary':
        variantClasses = 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500';
        break;
      case 'success':
        variantClasses = 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500';
        break;
      case 'error':
        variantClasses = 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500';
        break;
      case 'warning':
        variantClasses = 'bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-500';
        break;
      case 'info':
        variantClasses = 'bg-blue-400 hover:bg-blue-500 text-white focus:ring-blue-400';
        break;
      default:
        variantClasses = 'bg-gray-100 hover:bg-gray-200 text-gray-800 focus:ring-gray-200';
    }
  } else if (mappedVariant === 'outlined') {
    // Outlined buttons (border only)
    switch (color) {
      case 'primary':
        variantClasses = 'border border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500';
        break;
      case 'secondary':
        variantClasses = 'border border-gray-600 text-gray-600 hover:bg-gray-50 focus:ring-gray-500';
        break;
      case 'success':
        variantClasses = 'border border-green-600 text-green-600 hover:bg-green-50 focus:ring-green-500';
        break;
      case 'error':
        variantClasses = 'border border-red-600 text-red-600 hover:bg-red-50 focus:ring-red-500';
        break;
      case 'warning':
        variantClasses = 'border border-yellow-500 text-yellow-600 hover:bg-yellow-50 focus:ring-yellow-500';
        break;
      case 'info':
        variantClasses = 'border border-blue-400 text-blue-400 hover:bg-blue-50 focus:ring-blue-400';
        break;
      default:
        variantClasses = 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-200';
    }
  } else {
    // Text buttons (no background, no border)
    switch (color) {
      case 'primary':
        variantClasses = 'text-blue-600 hover:bg-blue-50 focus:ring-blue-500';
        break;
      case 'secondary':
        variantClasses = 'text-gray-600 hover:bg-gray-50 focus:ring-gray-500';
        break;
      case 'success':
        variantClasses = 'text-green-600 hover:bg-green-50 focus:ring-green-500';
        break;
      case 'error':
        variantClasses = 'text-red-600 hover:bg-red-50 focus:ring-red-500';
        break;
      case 'warning':
        variantClasses = 'text-yellow-600 hover:bg-yellow-50 focus:ring-yellow-500';
        break;
      case 'info':
        variantClasses = 'text-blue-400 hover:bg-blue-50 focus:ring-blue-400';
        break;
      default:
        variantClasses = 'text-gray-700 hover:bg-gray-50 focus:ring-gray-200';
    }
  }
  
  // Combine all classes
  const classes = `${baseClasses} ${sizeClasses} ${variantClasses} ${widthClass} ${disabledClass} ${className}`;
  
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={classes}
      {...rest}
    >
      {/* Display a loading spinner if loading is true */}
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      
      {/* Start Icon */}
      {startIcon && !loading && <span className="mr-2">{startIcon}</span>}
      
      {/* Button text */}
      {children}
      
      {/* End Icon */}
      {endIcon && <span className="ml-2">{endIcon}</span>}
    </button>
  );
});

Button.displayName = 'Button';

export default Button; 
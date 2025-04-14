import React from 'react';
const IconButton = ({ children, onClick, color = 'default', size = 'medium', edge = false, disabled = false, className = '', 'aria-label': ariaLabel, sx = {}, }) => {
    // Size classes
    const sizeClasses = {
        small: 'p-1',
        medium: 'p-2',
        large: 'p-3',
    };
    // Color classes
    const colorClasses = {
        default: 'text-gray-700 hover:bg-gray-200',
        primary: 'text-blue-600 hover:bg-blue-100',
        secondary: 'text-purple-600 hover:bg-purple-100',
        error: 'text-red-600 hover:bg-red-100',
        success: 'text-green-600 hover:bg-green-100',
        warning: 'text-yellow-600 hover:bg-yellow-100',
        inherit: 'text-inherit',
    };
    // Edge positioning classes
    let edgeClass = '';
    if (edge === 'start') {
        edgeClass = 'ml-0';
    }
    else if (edge === 'end') {
        edgeClass = 'mr-0';
    }
    // Convert sx prop to inline styles
    const styles = {
        ...sx,
    };
    return (<button onClick={onClick} disabled={disabled} aria-label={ariaLabel} className={`
        rounded-full 
        transition-colors
        focus:outline-none
        focus:ring-2
        focus:ring-offset-2
        focus:ring-blue-500
        ${sizeClasses[size]}
        ${colorClasses[color]}
        ${edgeClass}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `} style={styles}>
      {children}
    </button>);
};
export default IconButton;

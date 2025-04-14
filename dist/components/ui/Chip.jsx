import React from 'react';
const Chip = ({ label, onDelete, color = 'default', variant = 'filled', size = 'medium', className = '', icon, clickable = false, onClick }) => {
    // Size styles
    const sizeStyles = {
        small: 'text-xs px-2 py-0.5',
        medium: 'text-sm px-3 py-1'
    };
    // Color styles for filled variant
    const filledColorStyles = {
        default: 'bg-gray-200 text-gray-700',
        primary: 'bg-blue-100 text-blue-800',
        secondary: 'bg-purple-100 text-purple-800',
        error: 'bg-red-100 text-red-800',
        warning: 'bg-yellow-100 text-yellow-800',
        info: 'bg-cyan-100 text-cyan-800',
        success: 'bg-green-100 text-green-800'
    };
    // Color styles for outlined variant
    const outlinedColorStyles = {
        default: 'border-gray-300 text-gray-700',
        primary: 'border-blue-500 text-blue-700',
        secondary: 'border-purple-500 text-purple-700',
        error: 'border-red-500 text-red-700',
        warning: 'border-yellow-500 text-yellow-700',
        info: 'border-cyan-500 text-cyan-700',
        success: 'border-green-500 text-green-700'
    };
    // Apply variant-based styles
    const variantStyles = variant === 'outlined'
        ? `border ${outlinedColorStyles[color]}`
        : filledColorStyles[color];
    // Apply cursor styles
    const cursorStyles = (clickable || onClick) ? 'cursor-pointer' : '';
    const handleChipClick = () => {
        if (onClick) {
            onClick();
        }
    };
    const handleDeleteClick = (e) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete();
        }
    };
    return (<div className={`
        inline-flex items-center rounded-full ${sizeStyles[size]} ${variantStyles} 
        ${cursorStyles} ${variant === 'outlined' ? 'border' : ''} ${className}
      `} onClick={handleChipClick}>
      {icon && (<span className="mr-1">{icon}</span>)}
      <span>{label}</span>
      {onDelete && (<button onClick={handleDeleteClick} className="ml-1 hover:text-opacity-70 focus:outline-none" type="button" aria-label={`delete ${label}`}>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>)}
    </div>);
};
export default Chip;

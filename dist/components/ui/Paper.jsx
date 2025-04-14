import React from 'react';
const Paper = ({ children, elevation = 1, square = false, variant = 'elevation', className = '' }) => {
    // Shadow styles based on elevation
    const shadowStyles = {
        0: '',
        1: 'shadow-sm',
        2: 'shadow',
        3: 'shadow-md',
        4: 'shadow-lg',
        5: 'shadow-xl'
    };
    // Border radius styles
    const borderRadiusStyles = square ? '' : 'rounded-md';
    // Variant styles
    const variantStyles = variant === 'outlined'
        ? 'border border-gray-300'
        : shadowStyles[elevation];
    return (<div className={`bg-white ${borderRadiusStyles} ${variantStyles} ${className}`}>
      {children}
    </div>);
};
export default Paper;

import React from 'react';
const AppBar = ({ children, position = 'static', className = '', sx = {}, }) => {
    // Convert sx prop to inline styles
    const styles = {
        width: sx.width || '100%',
        marginLeft: sx.ml,
        ...sx,
    };
    return (<header className={`bg-gradient-to-r from-blue-600 to-indigo-700 shadow-md text-white ${position === 'fixed' ? 'fixed top-0 left-0 right-0 z-40' : position} ${className}`} style={styles}>
      {children}
    </header>);
};
export default AppBar;

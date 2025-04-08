import React, { ReactNode } from 'react';

interface AppBarProps {
  children: ReactNode;
  position?: 'fixed' | 'static' | 'relative' | 'absolute' | 'sticky';
  className?: string;
  sx?: Record<string, any>;
}

const AppBar: React.FC<AppBarProps> = ({
  children,
  position = 'static',
  className = '',
  sx = {},
}) => {
  // Convert sx prop to inline styles
  const styles: React.CSSProperties = {
    width: sx.width || '100%',
    marginLeft: sx.ml,
    ...(sx as React.CSSProperties),
  };

  return (
    <header
      className={`bg-gradient-to-r from-blue-600 to-indigo-700 shadow-md text-white ${
        position === 'fixed' ? 'fixed top-0 left-0 right-0 z-40' : position
      } ${className}`}
      style={styles}
    >
      {children}
    </header>
  );
};

export default AppBar; 
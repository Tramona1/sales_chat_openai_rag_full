import React, { ReactNode, useEffect } from 'react';

interface CssBaselineProps {
  children?: ReactNode;
}

// Custom CSS reset/normalize component
const CssBaseline: React.FC<CssBaselineProps> = ({ children }) => {
  // This component doesn't render anything visible but applies global styling
  return <>{children}</>;
};

export default CssBaseline; 
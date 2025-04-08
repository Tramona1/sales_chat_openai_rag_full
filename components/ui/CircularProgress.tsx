import React from 'react';

interface CircularProgressProps {
  size?: number;
  color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  className?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  size = 40,
  color = 'primary',
  className = ''
}) => {
  // Color styles
  const colorStyles = {
    primary: 'border-blue-600',
    secondary: 'border-purple-600',
    error: 'border-red-600',
    info: 'border-blue-400',
    success: 'border-green-600',
    warning: 'border-yellow-500'
  };
  
  return (
    <div className={`inline-block ${className}`}>
      <div
        className={`animate-spin rounded-full border-4 border-solid border-t-transparent ${colorStyles[color]}`}
        style={{ 
          width: `${size}px`, 
          height: `${size}px` 
        }}
        role="progressbar"
      />
    </div>
  );
};

export default CircularProgress; 
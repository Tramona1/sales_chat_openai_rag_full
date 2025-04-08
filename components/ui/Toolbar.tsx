import React, { ReactNode } from 'react';

interface ToolbarProps {
  children?: ReactNode;
  className?: string;
  variant?: 'regular' | 'dense';
}

const Toolbar: React.FC<ToolbarProps> = ({
  children,
  className = '',
  variant = 'regular',
}) => {
  const height = variant === 'dense' ? 'h-12' : 'h-16';

  return (
    <div className={`flex items-center justify-between px-4 ${height} ${className}`}>
      {children}
    </div>
  );
};

export default Toolbar; 
import React, { ReactNode } from 'react';

interface ListItemIconProps {
  children: ReactNode;
  className?: string;
}

const ListItemIcon: React.FC<ListItemIconProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`mr-3 flex-shrink-0 text-gray-500 ${className}`}>
      {children}
    </div>
  );
};

export default ListItemIcon; 
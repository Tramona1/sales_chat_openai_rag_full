import React, { ReactNode } from 'react';

interface ListProps {
  children: ReactNode;
  className?: string;
  disablePadding?: boolean;
  dense?: boolean;
  subheader?: ReactNode;
}

const List: React.FC<ListProps> = ({ 
  children, 
  className = '', 
  disablePadding = false,
  dense = false,
  subheader
}) => {
  return (
    <ul 
      className={`
        ${!disablePadding ? 'py-2' : ''}
        ${dense ? 'space-y-1' : 'space-y-2'}
        ${className}
      `}
    >
      {subheader && <div className="px-4 py-2 text-sm font-medium text-gray-500">{subheader}</div>}
      {children}
    </ul>
  );
};

export default List; 
import React, { ReactNode } from 'react';

interface ListItemTextProps {
  primary: ReactNode;
  secondary?: ReactNode;
  className?: string;
}

const ListItemText: React.FC<ListItemTextProps> = ({
  primary,
  secondary,
  className = '',
}) => {
  return (
    <div className={`flex-grow min-w-0 ${className}`}>
      <div className="text-sm font-medium leading-tight">{primary}</div>
      {secondary && <div className="text-xs text-gray-500 leading-snug mt-0.5">{secondary}</div>}
    </div>
  );
};

export default ListItemText; 
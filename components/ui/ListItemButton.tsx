import React, { ReactNode } from 'react';

interface ListItemButtonProps {
  children: ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const ListItemButton: React.FC<ListItemButtonProps> = ({
  children,
  className = '',
  selected = false,
  onClick,
  disabled = false,
}) => {
  return (
    <div
      className={`
        px-3 py-2
        flex items-center
        w-full
        rounded-md
        transition-colors
        duration-150
        ${selected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
        ${!disabled ? 'cursor-pointer hover:bg-gray-100' : 'opacity-60 cursor-not-allowed'}
        ${className}
      `}
      onClick={!disabled ? onClick : undefined}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      {children}
    </div>
  );
};

export default ListItemButton; 
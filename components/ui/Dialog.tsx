import React, { useEffect, useRef } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
}

const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'md'
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close dialog when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  // Prevent scrolling when dialog is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  // Determine max width class based on prop
  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    'full': 'max-w-full'
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div 
        ref={dialogRef}
        className={`bg-white rounded-lg shadow-xl w-full ${maxWidthClass} flex flex-col max-h-[95vh]`}
      >
        {title && (
          <div className="px-6 py-4 border-b flex-shrink-0">
            <h3 className="text-lg font-medium">{title}</h3>
          </div>
        )}
        
        <div className="px-6 py-4 overflow-y-auto flex-grow">
          {children}
        </div>
        
        {actions && (
          <div className="px-6 py-3 border-t flex justify-end space-x-2 bg-gray-50 flex-shrink-0 sticky bottom-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dialog; 
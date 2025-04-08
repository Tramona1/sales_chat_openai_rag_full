import React, { ReactNode, useEffect } from 'react';

interface DrawerProps {
  children: ReactNode;
  open?: boolean;
  onClose?: () => void;
  variant?: 'permanent' | 'temporary' | 'persistent';
  anchor?: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
  sx?: Record<string, any>;
  ModalProps?: {
    keepMounted?: boolean;
  };
}

const Drawer: React.FC<DrawerProps> = ({
  children,
  open = false,
  onClose,
  variant = 'temporary',
  anchor = 'left',
  className = '',
  sx = {},
  ModalProps,
}) => {
  // Convert sx prop to style object
  const drawerStyles: React.CSSProperties = {
    ...sx,
  };

  // Handle backdrop click for temporary drawers
  const handleBackdropClick = () => {
    if (variant === 'temporary' && onClose) {
      onClose();
    }
  };

  // Handle escape key press
  useEffect(() => {
    if (variant !== 'temporary' || !open || !onClose) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [variant, open, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (variant !== 'temporary' || !open) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [variant, open]);

  // Position classes based on anchor
  const positionClasses = {
    left: 'left-0 top-0 bottom-0',
    right: 'right-0 top-0 bottom-0',
    top: 'top-0 left-0 right-0',
    bottom: 'bottom-0 left-0 right-0',
  };

  // Size classes based on anchor
  const sizeClasses = {
    left: 'h-full',
    right: 'h-full',
    top: 'w-full',
    bottom: 'w-full',
  };

  // Animation classes based on anchor
  const animationClasses = {
    left: open ? 'translate-x-0' : '-translate-x-full',
    right: open ? 'translate-x-0' : 'translate-x-full',
    top: open ? 'translate-y-0' : '-translate-y-full',
    bottom: open ? 'translate-y-0' : 'translate-y-full',
  };

  // Display logic for different variants
  if (variant === 'permanent' || (variant !== 'temporary' && open)) {
    return (
      <div
        className={`bg-white shadow-xl fixed ${positionClasses[anchor]} ${sizeClasses[anchor]} overflow-auto z-30 ${className}`}
        style={drawerStyles}
      >
        {children}
      </div>
    );
  }

  // For temporary drawers or non-temporary closed drawers
  if (variant === 'temporary' && open) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={handleBackdropClick}
        />
        
        {/* Drawer */}
        <div
          className={`
            bg-white shadow-xl fixed ${positionClasses[anchor]} ${sizeClasses[anchor]} 
            overflow-auto z-50 transition-transform transform duration-300 ease-in-out
            ${animationClasses[anchor]} ${className}
          `}
          style={drawerStyles}
        >
          {children}
        </div>
      </>
    );
  }

  // For closed temporary drawers that should remain mounted
  if (variant === 'temporary' && !open && ModalProps?.keepMounted) {
    return (
      <div
        className={`
          bg-white shadow-xl fixed ${positionClasses[anchor]} ${sizeClasses[anchor]} 
          overflow-auto z-50 transition-transform transform duration-300 ease-in-out
          ${animationClasses[anchor]} ${className} hidden
        `}
        style={drawerStyles}
      >
        {children}
      </div>
    );
  }

  // Don't render if drawer is closed
  return null;
};

export default Drawer; 
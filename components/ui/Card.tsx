import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {children}
    </div>
  );
};

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

const CardContent: React.FC<CardContentProps> = ({ children, className = '' }) => {
  return <div className={`p-4 ${className}`}>{children}</div>;
};

interface CardHeaderProps {
  title: React.ReactNode;
  subheader?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const CardHeader: React.FC<CardHeaderProps> = ({ 
  title, 
  subheader, 
  action,
  className = '' 
}) => {
  return (
    <div className={`flex justify-between items-center p-4 border-b ${className}`}>
      <div>
        {typeof title === 'string' ? (
          <h2 className="text-lg font-medium">{title}</h2>
        ) : (
          title
        )}
        {subheader && (
          <p className="text-sm text-gray-500 mt-1">
            {subheader}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

interface CardActionsProps {
  children: React.ReactNode;
  className?: string;
}

const CardActions: React.FC<CardActionsProps> = ({ children, className = '' }) => {
  return (
    <div className={`p-4 border-t flex items-center space-x-2 ${className}`}>
      {children}
    </div>
  );
};

export { Card, CardContent, CardHeader, CardActions }; 
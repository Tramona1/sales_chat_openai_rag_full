import React from 'react';
const Card = ({ children, className = '' }) => {
    return (<div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {children}
    </div>);
};
const CardContent = ({ children, className = '' }) => {
    return <div className={`p-4 ${className}`}>{children}</div>;
};
const CardHeader = ({ title, subheader, action, className = '' }) => {
    return (<div className={`flex justify-between items-center p-4 border-b ${className}`}>
      <div>
        {typeof title === 'string' ? (<h2 className="text-lg font-medium">{title}</h2>) : (title)}
        {subheader && (<p className="text-sm text-gray-500 mt-1">
            {subheader}
          </p>)}
      </div>
      {action && <div>{action}</div>}
    </div>);
};
const CardActions = ({ children, className = '' }) => {
    return (<div className={`p-4 border-t flex items-center space-x-2 ${className}`}>
      {children}
    </div>);
};
export { Card, CardContent, CardHeader, CardActions };

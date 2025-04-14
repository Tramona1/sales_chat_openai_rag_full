import React from 'react';
const ListItemIcon = ({ children, className = '', }) => {
    return (<div className={`mr-3 flex-shrink-0 text-gray-500 ${className}`}>
      {children}
    </div>);
};
export default ListItemIcon;

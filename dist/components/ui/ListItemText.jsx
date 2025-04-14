import React from 'react';
const ListItemText = ({ primary, secondary, className = '', }) => {
    return (<div className={`flex-grow min-w-0 ${className}`}>
      <div className="text-sm font-medium leading-tight">{primary}</div>
      {secondary && <div className="text-xs text-gray-500 leading-snug mt-0.5">{secondary}</div>}
    </div>);
};
export default ListItemText;

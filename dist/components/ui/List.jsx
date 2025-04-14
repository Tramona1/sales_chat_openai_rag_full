import React from 'react';
const List = ({ children, className = '', disablePadding = false, dense = false, subheader }) => {
    return (<ul className={`
        ${!disablePadding ? 'py-2' : ''}
        ${dense ? 'space-y-1' : 'space-y-2'}
        ${className}
      `}>
      {subheader && <div className="px-4 py-2 text-sm font-medium text-gray-500">{subheader}</div>}
      {children}
    </ul>);
};
export default List;

import React from 'react';
const ListItem = ({ children, className = '', disablePadding = false, button = false, selected = false, onClick, }) => {
    const Component = button ? 'button' : 'li';
    return (<Component className={`
        ${!disablePadding ? 'px-4 py-2' : ''}
        ${button ? 'w-full text-left cursor-pointer hover:bg-gray-100 focus:outline-none focus:bg-gray-100' : ''}
        ${selected ? 'bg-blue-50 text-blue-700' : ''}
        flex items-center
        ${className}
      `} onClick={onClick} type={button ? 'button' : undefined}>
      {children}
    </Component>);
};
export default ListItem;

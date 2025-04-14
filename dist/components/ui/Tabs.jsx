import React from 'react';
export const Tab = ({ label, value, icon, disabled = false, className = '', onClick, }) => {
    return (<button className={`inline-flex items-center px-4 py-2 text-sm font-medium ${className}`} role="tab" disabled={disabled} onClick={onClick}>
      {icon && <span className="mr-2">{icon}</span>}
      {label}
    </button>);
};
export const Tabs = ({ children, value, onChange, variant = 'standard', centered = false, className = '' }) => {
    // Variant styles
    const variantStyles = {
        standard: 'flex',
        fullWidth: 'flex w-full',
        scrollable: 'flex overflow-x-auto'
    };
    // Centered styles
    const centeredStyles = centered ? 'justify-center' : '';
    // Handle tab click
    const handleTabClick = (e, tabValue) => {
        onChange(e, tabValue);
    };
    return (<div className={`border-b border-gray-200 ${variantStyles[variant]} ${centeredStyles} ${className}`} role="tablist">
      {React.Children.map(children, (child) => {
            if (!React.isValidElement(child)) {
                return child;
            }
            // Get tab props
            const tabProps = child.props;
            const isActive = tabProps.value === value;
            const isDisabled = !!tabProps.disabled;
            // Build the new classname
            const tabClassName = `
          ${tabProps.className || ''} 
          ${isActive
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}
          ${isDisabled ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer'}
        `;
            // Handle click if not disabled
            const handleClick = (e) => {
                if (!isDisabled) {
                    handleTabClick(e, tabProps.value);
                }
            };
            // Use type assertion for React.cloneElement
            return React.cloneElement(child, {
                className: tabClassName,
                onClick: handleClick
            });
        })}
    </div>);
};
export const TabPanel = ({ children, value, index, className = '' }) => {
    return (<div role="tabpanel" hidden={value !== index} id={`tabpanel-${index}`} aria-labelledby={`tab-${index}`} className={`py-4 ${className}`}>
      {value === index && children}
    </div>);
};

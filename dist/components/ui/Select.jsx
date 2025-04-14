import React, { useState, useRef, useEffect } from 'react';
const Select = ({ label, value, onChange, options, placeholder = 'Select an option', fullWidth = false, disabled = false, error = false, helperText, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef(null);
    // Find the currently selected option label
    const selectedOption = options.find(option => option.value === value);
    const displayValue = selectedOption ? selectedOption.label : placeholder;
    // Handle clicks outside the select to close the dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    // Toggle dropdown
    const toggleDropdown = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    };
    // Handle option selection
    const handleOptionSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
    };
    // Base styles
    const baseStyles = 'relative border rounded transition-colors focus:outline-none';
    // Error styles
    const errorStyles = error ? 'border-red-500' : 'border-gray-300';
    // Disabled styles
    const disabledStyles = disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'cursor-pointer';
    // Width styles
    const widthStyles = fullWidth ? 'w-full' : '';
    return (<div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (<label className="block mb-1 text-sm font-medium text-gray-700">
          {label}
        </label>)}
      <div ref={selectRef} className={`${baseStyles} ${errorStyles} ${disabledStyles} ${widthStyles}`}>
        <div className="flex items-center justify-between px-4 py-2" onClick={toggleDropdown}>
          <span className={`${!selectedOption ? 'text-gray-400' : ''}`}>
            {displayValue}
          </span>
          <svg className={`w-4 h-4 ml-2 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </div>
        
        {isOpen && (<div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-auto">
            {options.map((option) => (<div key={option.value} className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${option.value === value ? 'bg-blue-100' : ''}`} onClick={() => handleOptionSelect(option.value)}>
                {option.label}
              </div>))}
          </div>)}
      </div>
      {helperText && (<p className={`mt-1 text-xs ${error ? 'text-red-500' : 'text-gray-500'}`}>
          {helperText}
        </p>)}
    </div>);
};
export default Select;

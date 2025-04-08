import React from 'react';
interface SelectOption {
    value: string;
    label: string;
}
interface SelectProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    fullWidth?: boolean;
    disabled?: boolean;
    error?: boolean;
    helperText?: string;
    className?: string;
}
declare const Select: React.FC<SelectProps>;
export default Select;

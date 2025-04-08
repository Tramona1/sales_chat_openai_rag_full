import React, { InputHTMLAttributes } from 'react';
interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    helperText?: string;
    error?: boolean;
    fullWidth?: boolean;
    variant?: 'outlined' | 'filled' | 'standard';
    size?: 'small' | 'medium';
    multiline?: boolean;
    rows?: number;
    className?: string;
}
declare const TextField: React.FC<TextFieldProps>;
export default TextField;

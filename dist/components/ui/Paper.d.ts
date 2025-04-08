import React from 'react';
interface PaperProps {
    children: React.ReactNode;
    elevation?: 0 | 1 | 2 | 3 | 4 | 5;
    square?: boolean;
    variant?: 'elevation' | 'outlined';
    className?: string;
}
declare const Paper: React.FC<PaperProps>;
export default Paper;

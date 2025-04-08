import React from 'react';
interface TypographyProps {
    children: React.ReactNode;
    variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle1' | 'subtitle2' | 'body1' | 'body2' | 'caption' | 'overline';
    component?: React.ElementType;
    align?: 'left' | 'center' | 'right' | 'justify';
    color?: 'initial' | 'inherit' | 'primary' | 'secondary' | 'textPrimary' | 'textSecondary' | 'error';
    gutterBottom?: boolean;
    noWrap?: boolean;
    paragraph?: boolean;
    className?: string;
    fontWeight?: 'normal' | 'medium' | 'bold';
}
declare const Typography: React.FC<TypographyProps>;
export default Typography;

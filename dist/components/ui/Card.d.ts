import React from 'react';
interface CardProps {
    children: React.ReactNode;
    className?: string;
}
declare const Card: React.FC<CardProps>;
interface CardContentProps {
    children: React.ReactNode;
    className?: string;
}
declare const CardContent: React.FC<CardContentProps>;
interface CardHeaderProps {
    title: React.ReactNode;
    subheader?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}
declare const CardHeader: React.FC<CardHeaderProps>;
interface CardActionsProps {
    children: React.ReactNode;
    className?: string;
}
declare const CardActions: React.FC<CardActionsProps>;
export { Card, CardContent, CardHeader, CardActions };

import React from 'react';
interface TabProps {
    label: string;
    value: string | number;
    icon?: React.ReactNode;
    disabled?: boolean;
    className?: string;
    onClick?: (e: React.SyntheticEvent) => void;
}
export declare const Tab: React.FC<TabProps>;
interface TabsProps {
    children: React.ReactNode;
    value: string | number;
    onChange: (event: React.SyntheticEvent, newValue: string | number) => void;
    variant?: 'standard' | 'fullWidth' | 'scrollable';
    centered?: boolean;
    className?: string;
}
export declare const Tabs: React.FC<TabsProps>;
interface TabPanelProps {
    children: React.ReactNode;
    value: string | number;
    index: string | number;
    className?: string;
}
export declare const TabPanel: React.FC<TabPanelProps>;
export {};

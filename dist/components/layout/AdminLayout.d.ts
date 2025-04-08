import React, { ReactNode } from 'react';
interface AdminLayoutProps {
    children: ReactNode;
    title?: string;
}
export default function AdminLayout({ children, title }: AdminLayoutProps): React.JSX.Element;
export {};

import React, { ReactNode } from 'react';
import Head from 'next/head';
import AdminSidebar from './AdminSidebar';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function AdminLayout({ children, title = 'Admin' }: AdminLayoutProps) {
  return (
    <>
      <Head>
        <title>{title} | Knowledge Base Admin</title>
      </Head>
      <div className="h-screen flex overflow-hidden bg-gray-100">
        <AdminSidebar />
        
        <div className="flex flex-col w-0 flex-1 overflow-hidden">
          <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
            <div className="md:pl-64">
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
} 
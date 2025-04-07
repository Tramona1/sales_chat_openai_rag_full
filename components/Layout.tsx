import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { MessageSquare, Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  title = 'Sales Knowledge Assistant'
}) => {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Sales knowledge assistant powered by AI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/" className="flex items-center space-x-2 text-primary-600 hover:text-primary-700">
                  <MessageSquare className="h-6 w-6" />
                  <span className="text-xl font-semibold">Sales Knowledge Assistant</span>
                </Link>
              </div>
              <nav className="flex items-center space-x-6">
                <Link
                  href="/chat"
                  className="text-gray-600 hover:text-primary-600 flex items-center space-x-1 text-sm font-medium"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Chat</span>
                </Link>
                <Link
                  href="/admin"
                  className="text-gray-600 hover:text-primary-600 flex items-center space-x-1 text-sm font-medium"
                >
                  <Settings className="h-4 w-4" />
                  <span>Admin</span>
                </Link>
              </nav>
            </div>
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
        <footer className="bg-white border-t border-gray-200 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-500">
              Sales Knowledge Assistant — Powered by AI
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Layout; 
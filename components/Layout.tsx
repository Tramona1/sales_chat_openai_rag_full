import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  MessageSquare, 
  Settings, 
  Home, 
  Users, 
  Briefcase, 
  BarChart2, 
  HelpCircle, 
  Menu, 
  X,
  Upload,
  Shield,
  Search
} from 'lucide-react';
import { useRouter } from 'next/router';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  title = 'Sales Knowledge Assistant'
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  const navItems = [
    { name: 'Home', href: '/', icon: <Home className="h-5 w-5" /> },
    { name: 'Chat', href: '/chat', icon: <MessageSquare className="h-5 w-5" /> },
    { name: 'Company Chat', href: '/company-chat', icon: <Briefcase className="h-5 w-5" /> },
    { name: 'Admin', href: '/admin', icon: <Shield className="h-5 w-5" /> },
  ];

  const isActive = (path: string) => router.pathname === path;

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Sales knowledge assistant powered by AI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen flex bg-neutral-50">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={toggleSidebar}
          />
        )}

        {/* Sidebar */}
        <aside 
          className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-neutral-200 z-30 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:static lg:w-64 lg:flex-shrink-0`}
        >
          <div className="flex flex-col h-full">
            {/* Sidebar header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-200">
              <Link href="/" className="flex items-center space-x-2 text-primary-600">
                <MessageSquare className="h-6 w-6" />
                <span className="font-semibold">Sales Assistant</span>
              </Link>
              <button 
                className="lg:hidden text-neutral-500 hover:text-neutral-700"
                onClick={toggleSidebar}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sidebar navigation */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive(item.href)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <span className={`${isActive(item.href) ? 'text-primary-600' : 'text-neutral-500'} mr-3`}>
                    {item.icon}
                  </span>
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Sidebar footer */}
            <div className="p-4 border-t border-neutral-200">
              <Link 
                href="/"
                className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-neutral-700 hover:bg-neutral-100 transition-colors"
              >
                <HelpCircle className="h-5 w-5 text-neutral-500 mr-3" />
                Help & Resources
              </Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top header */}
          <header className="bg-white border-b border-neutral-200 shadow-sm sticky top-0 z-10">
            <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              {/* Mobile menu button */}
              <button 
                className="lg:hidden text-neutral-500 hover:text-neutral-700"
                onClick={toggleSidebar}
              >
                <Menu className="h-6 w-6" />
              </button>
              
              {/* Page title - show on mobile only */}
              <div className="lg:hidden font-semibold text-neutral-900">
                {title}
              </div>
              
              {/* Right side of header - always visible */}
              <nav className="flex items-center space-x-4">
                <Link
                  href="/chat"
                  className="text-neutral-600 hover:text-primary-600 flex items-center space-x-1 text-sm font-medium"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Chat</span>
                </Link>
                <Link
                  href="/admin"
                  className="text-neutral-600 hover:text-primary-600 flex items-center space-x-1 text-sm font-medium"
                >
                  <Settings className="h-4 w-4" />
                  <span>Admin</span>
                </Link>
              </nav>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>

          <footer className="bg-white border-t border-neutral-200 py-4 text-center text-sm text-neutral-500">
            Sales Knowledge Assistant — Powered by AI
          </footer>
        </div>
      </div>
    </>
  );
};

export default Layout; 
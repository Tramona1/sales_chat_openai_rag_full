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
  title = 'Workstream Knowledge Assistant'
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  const navItems = [
    { name: 'Home', href: '/', icon: <Home className="h-5 w-5" /> },
    { name: 'Chat', href: '/chat', icon: <MessageSquare className="h-5 w-5" /> },
    { name: 'Company Chat', href: '/company-chat', icon: <Briefcase className="h-5 w-5" /> },
    { name: 'Admin', href: '/admin', icon: <Shield className="h-5 w-5" /> },
  ];

  const isActive = (path: string) => router.pathname === path;

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Workstream Knowledge Assistant powered by AI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen flex flex-col bg-neutral-50">
        {/* Top header */}
        <header className="bg-white border-b border-neutral-200 shadow-sm sticky top-0 z-10">
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center">
            {/* Logo icon */}
            <Link href="/" className="flex items-center mr-8 text-primary-600">
              <MessageSquare className="h-6 w-6" />
            </Link>
            
            {/* Desktop Navigation - hidden on mobile */}
            <nav className="hidden lg:flex items-center space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'text-primary-700'
                      : 'text-neutral-700 hover:text-primary-600'
                  }`}
                >
                  <span className={`${isActive(item.href) ? 'text-primary-600' : 'text-neutral-500'} mr-1`}>
                    {item.icon}
                  </span>
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
            
            {/* Mobile menu button - pushed to the right */}
            <div className="ml-auto lg:hidden">
              <button 
                className="text-neutral-500 hover:text-neutral-700"
                onClick={toggleMobileMenu}
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile menu dropdown (only shown when mobileMenuOpen is true) */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-neutral-200 shadow-sm z-20">
            <div className="px-4 py-2">
              <nav className="flex flex-col space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive(item.href)
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className={`${isActive(item.href) ? 'text-primary-600' : 'text-neutral-500'} mr-3`}>
                      {item.icon}
                    </span>
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-neutral-200 py-4 text-center text-sm text-neutral-500">
          Workstream Knowledge Assistant — Powered by AI
        </footer>
      </div>
    </>
  );
};

export default Layout; 
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const head_1 = __importDefault(require("next/head"));
const link_1 = __importDefault(require("next/link"));
const lucide_react_1 = require("lucide-react");
const router_1 = require("next/router");
const Layout = ({ children, title = 'Sales Knowledge Assistant' }) => {
    const [sidebarOpen, setSidebarOpen] = (0, react_1.useState)(false);
    const router = (0, router_1.useRouter)();
    const navItems = [
        { name: 'Home', href: '/', icon: <lucide_react_1.Home className="h-5 w-5"/> },
        { name: 'Chat', href: '/chat', icon: <lucide_react_1.MessageSquare className="h-5 w-5"/> },
        { name: 'Company Chat', href: '/company-chat', icon: <lucide_react_1.Briefcase className="h-5 w-5"/> },
        { name: 'Admin', href: '/admin', icon: <lucide_react_1.Shield className="h-5 w-5"/> },
    ];
    const isActive = (path) => router.pathname === path;
    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    return (<>
      <head_1.default>
        <title>{title}</title>
        <meta name="description" content="Sales knowledge assistant powered by AI"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link rel="icon" href="/favicon.ico"/>
      </head_1.default>
      <div className="min-h-screen flex bg-neutral-50">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (<div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" onClick={toggleSidebar}/>)}

        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-neutral-200 z-30 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:w-64 lg:flex-shrink-0`}>
          <div className="flex flex-col h-full">
            {/* Sidebar header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-200">
              <link_1.default href="/" className="flex items-center space-x-2 text-primary-600">
                <lucide_react_1.MessageSquare className="h-6 w-6"/>
                <span className="font-semibold">Sales Assistant</span>
              </link_1.default>
              <button className="lg:hidden text-neutral-500 hover:text-neutral-700" onClick={toggleSidebar}>
                <lucide_react_1.X className="h-5 w-5"/>
              </button>
            </div>

            {/* Sidebar navigation */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (<link_1.default key={item.href} href={item.href} className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive(item.href)
                ? 'bg-primary-50 text-primary-700'
                : 'text-neutral-700 hover:bg-neutral-100'}`}>
                  <span className={`${isActive(item.href) ? 'text-primary-600' : 'text-neutral-500'} mr-3`}>
                    {item.icon}
                  </span>
                  {item.name}
                </link_1.default>))}
            </nav>

            {/* Sidebar footer */}
            <div className="p-4 border-t border-neutral-200">
              <link_1.default href="/" className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-neutral-700 hover:bg-neutral-100 transition-colors">
                <lucide_react_1.HelpCircle className="h-5 w-5 text-neutral-500 mr-3"/>
                Help & Resources
              </link_1.default>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top header */}
          <header className="bg-white border-b border-neutral-200 shadow-sm sticky top-0 z-10">
            <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              {/* Mobile menu button */}
              <button className="lg:hidden text-neutral-500 hover:text-neutral-700" onClick={toggleSidebar}>
                <lucide_react_1.Menu className="h-6 w-6"/>
              </button>
              
              {/* Page title - show on mobile only */}
              <div className="lg:hidden font-semibold text-neutral-900">
                {title}
              </div>
              
              {/* Right side of header - always visible */}
              <nav className="flex items-center space-x-4">
                <link_1.default href="/chat" className="text-neutral-600 hover:text-primary-600 flex items-center space-x-1 text-sm font-medium">
                  <lucide_react_1.MessageSquare className="h-4 w-4"/>
                  <span>Chat</span>
                </link_1.default>
                <link_1.default href="/admin" className="text-neutral-600 hover:text-primary-600 flex items-center space-x-1 text-sm font-medium">
                  <lucide_react_1.Settings className="h-4 w-4"/>
                  <span>Admin</span>
                </link_1.default>
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
    </>);
};
exports.default = Layout;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminLayout;
const react_1 = __importDefault(require("react"));
const head_1 = __importDefault(require("next/head"));
const AdminSidebar_1 = __importDefault(require("./AdminSidebar"));
function AdminLayout({ children, title = 'Admin' }) {
    return (<>
      <head_1.default>
        <title>{title} | Knowledge Base Admin</title>
      </head_1.default>
      <div className="h-screen flex overflow-hidden bg-gray-100">
        <AdminSidebar_1.default />
        
        <div className="flex flex-col w-0 flex-1 overflow-hidden">
          <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
            <div className="md:pl-64">
              {children}
            </div>
          </main>
        </div>
      </div>
    </>);
}

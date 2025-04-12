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
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const Dialog = ({ open, onClose, title, children, actions, maxWidth = 'md' }) => {
    const dialogRef = (0, react_1.useRef)(null);
    // Close dialog when clicking outside
    (0, react_1.useEffect)(() => {
        const handleClickOutside = (event) => {
            if (dialogRef.current && !dialogRef.current.contains(event.target)) {
                onClose();
            }
        };
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [open, onClose]);
    // Prevent scrolling when dialog is open
    (0, react_1.useEffect)(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        }
        else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);
    if (!open)
        return null;
    // Determine max width class based on prop
    const maxWidthClass = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        'full': 'max-w-full'
    }[maxWidth];
    return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div ref={dialogRef} className={`bg-white rounded-lg shadow-xl w-full ${maxWidthClass} flex flex-col max-h-[95vh]`}>
        {title && (<div className="px-6 py-4 border-b flex-shrink-0">
            <h3 className="text-lg font-medium">{title}</h3>
          </div>)}
        
        <div className="px-6 py-4 overflow-y-auto flex-grow">
          {children}
        </div>
        
        {actions && (<div className="px-6 py-3 border-t flex justify-end space-x-2 bg-gray-50 flex-shrink-0 sticky bottom-0">
            {actions}
          </div>)}
      </div>
    </div>);
};
exports.default = Dialog;

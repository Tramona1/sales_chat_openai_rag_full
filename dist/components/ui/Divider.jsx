"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const Divider = ({ orientation = 'horizontal', variant = 'fullWidth', light = false, className = '', textAlign, children }) => {
    // Orientation classes
    const orientationClass = orientation === 'vertical'
        ? 'border-l h-full my-0 mx-2 inline-block'
        : 'border-t w-full';
    // Variant classes
    const variantClasses = {
        fullWidth: '',
        inset: 'ml-16',
        middle: 'mx-16'
    };
    // Light class (thinner divider)
    const lightClass = light ? 'border-gray-200' : 'border-gray-300';
    // Text alignment classes
    const textAlignClass = textAlign ? `text-${textAlign}` : '';
    // If there are children, render a divider with text
    if (children) {
        return (<div className={`flex items-center ${variantClasses[variant]} ${className}`}>
        <div className={`flex-grow border-t ${lightClass}`}></div>
        <span className={`px-3 ${textAlignClass}`}>{children}</span>
        <div className={`flex-grow border-t ${lightClass}`}></div>
      </div>);
    }
    // Otherwise render a simple divider
    return (<hr className={`${orientationClass} ${variantClasses[variant]} ${lightClass} ${className}`}/>);
};
exports.default = Divider;

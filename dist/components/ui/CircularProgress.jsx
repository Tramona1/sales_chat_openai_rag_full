"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const CircularProgress = ({ size = 40, color = 'primary', className = '' }) => {
    // Color styles
    const colorStyles = {
        primary: 'border-blue-600',
        secondary: 'border-purple-600',
        error: 'border-red-600',
        info: 'border-blue-400',
        success: 'border-green-600',
        warning: 'border-yellow-500'
    };
    return (<div className={`inline-block ${className}`}>
      <div className={`animate-spin rounded-full border-4 border-solid border-t-transparent ${colorStyles[color]}`} style={{
            width: `${size}px`,
            height: `${size}px`
        }} role="progressbar"/>
    </div>);
};
exports.default = CircularProgress;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const Toolbar = ({ children, className = '', variant = 'regular', }) => {
    const height = variant === 'dense' ? 'h-12' : 'h-16';
    return (<div className={`flex items-center justify-between px-4 ${height} ${className}`}>
      {children}
    </div>);
};
exports.default = Toolbar;

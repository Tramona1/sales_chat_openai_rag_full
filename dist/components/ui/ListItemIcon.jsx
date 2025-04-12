"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const ListItemIcon = ({ children, className = '', }) => {
    return (<div className={`mr-3 flex-shrink-0 text-gray-500 ${className}`}>
      {children}
    </div>);
};
exports.default = ListItemIcon;

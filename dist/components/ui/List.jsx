"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const List = ({ children, className = '', disablePadding = false, dense = false, subheader }) => {
    return (<ul className={`
        ${!disablePadding ? 'py-2' : ''}
        ${dense ? 'space-y-1' : 'space-y-2'}
        ${className}
      `}>
      {subheader && <div className="px-4 py-2 text-sm font-medium text-gray-500">{subheader}</div>}
      {children}
    </ul>);
};
exports.default = List;

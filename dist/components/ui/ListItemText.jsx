"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const ListItemText = ({ primary, secondary, className = '', }) => {
    return (<div className={`flex-grow min-w-0 ${className}`}>
      <div className="text-sm font-medium leading-tight">{primary}</div>
      {secondary && <div className="text-xs text-gray-500 leading-snug mt-0.5">{secondary}</div>}
    </div>);
};
exports.default = ListItemText;

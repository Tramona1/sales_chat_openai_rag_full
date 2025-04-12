"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
// Custom CSS reset/normalize component
const CssBaseline = ({ children }) => {
    // This component doesn't render anything visible but applies global styling
    return <>{children}</>;
};
exports.default = CssBaseline;

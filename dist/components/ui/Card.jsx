"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardActions = exports.CardHeader = exports.CardContent = exports.Card = void 0;
const react_1 = __importDefault(require("react"));
const Card = ({ children, className = '' }) => {
    return (<div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {children}
    </div>);
};
exports.Card = Card;
const CardContent = ({ children, className = '' }) => {
    return <div className={`p-4 ${className}`}>{children}</div>;
};
exports.CardContent = CardContent;
const CardHeader = ({ title, subheader, action, className = '' }) => {
    return (<div className={`flex justify-between items-center p-4 border-b ${className}`}>
      <div>
        {typeof title === 'string' ? (<h2 className="text-lg font-medium">{title}</h2>) : (title)}
        {subheader && (<p className="text-sm text-gray-500 mt-1">
            {subheader}
          </p>)}
      </div>
      {action && <div>{action}</div>}
    </div>);
};
exports.CardHeader = CardHeader;
const CardActions = ({ children, className = '' }) => {
    return (<div className={`p-4 border-t flex items-center space-x-2 ${className}`}>
      {children}
    </div>);
};
exports.CardActions = CardActions;

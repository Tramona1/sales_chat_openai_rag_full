"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const Typography = ({ children, variant = 'body1', component, align = 'left', color = 'initial', gutterBottom = false, noWrap = false, paragraph = false, className = '', fontWeight }) => {
    // Determine which component to render
    const Component = component || getDefaultComponent(variant, paragraph);
    // Variant styles
    const variantStyles = {
        h1: 'text-4xl font-bold',
        h2: 'text-3xl font-bold',
        h3: 'text-2xl font-bold',
        h4: 'text-xl font-bold',
        h5: 'text-lg font-medium',
        h6: 'text-base font-medium',
        subtitle1: 'text-base',
        subtitle2: 'text-sm',
        body1: 'text-base',
        body2: 'text-sm',
        caption: 'text-xs',
        overline: 'text-xs uppercase tracking-wider'
    };
    // Alignment styles
    const alignStyles = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
        justify: 'text-justify'
    };
    // Color styles
    const colorStyles = {
        initial: 'text-inherit',
        inherit: 'text-inherit',
        primary: 'text-blue-600',
        secondary: 'text-purple-600',
        textPrimary: 'text-gray-900',
        textSecondary: 'text-gray-600',
        error: 'text-red-600'
    };
    // Margin bottom for gutterBottom prop
    const gutterBottomStyles = gutterBottom ? 'mb-2' : '';
    // Text wrapping
    const noWrapStyles = noWrap ? 'whitespace-nowrap overflow-hidden text-ellipsis' : '';
    // Paragraph styles
    const paragraphStyles = paragraph ? 'mb-4' : '';
    // Font weight styles
    const fontWeightStyles = fontWeight ? getFontWeightClass(fontWeight) : '';
    return (<Component className={`
        ${variantStyles[variant]} 
        ${alignStyles[align]} 
        ${colorStyles[color]} 
        ${gutterBottomStyles} 
        ${noWrapStyles} 
        ${paragraphStyles}
        ${fontWeightStyles}
        ${className}
      `}>
      {children}
    </Component>);
};
// Helper function to determine the default component based on variant
function getDefaultComponent(variant, isParagraph) {
    if (isParagraph)
        return 'p';
    switch (variant) {
        case 'h1':
            return 'h1';
        case 'h2':
            return 'h2';
        case 'h3':
            return 'h3';
        case 'h4':
            return 'h4';
        case 'h5':
            return 'h5';
        case 'h6':
            return 'h6';
        case 'subtitle1':
        case 'subtitle2':
            return 'h6';
        case 'body1':
        case 'body2':
            return 'p';
        case 'caption':
        case 'overline':
            return 'span';
        default:
            return 'p';
    }
}
// Helper function to get font weight class
function getFontWeightClass(weight) {
    switch (weight) {
        case 'normal':
            return 'font-normal';
        case 'medium':
            return 'font-medium';
        case 'bold':
            return 'font-bold';
        default:
            return '';
    }
}
exports.default = Typography;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
/**
 * Simple Box component to replace MUI Box in case of compatibility issues
 */
const Box = ({ children, sx, className, style }) => {
    // Convert sx prop to inline styles
    const convertSxToStyle = (sxProp) => {
        const styles = {};
        // Handle common sx properties
        if (sxProp.display)
            styles.display = sxProp.display;
        if (sxProp.flexDirection)
            styles.flexDirection = sxProp.flexDirection;
        if (sxProp.flexGrow)
            styles.flexGrow = sxProp.flexGrow;
        if (sxProp.gap)
            styles.gap = typeof sxProp.gap === 'number' ? `${sxProp.gap * 8}px` : sxProp.gap;
        if (sxProp.p)
            styles.padding = `${sxProp.p * 8}px`;
        if (sxProp.px)
            styles.paddingLeft = styles.paddingRight = `${sxProp.px * 8}px`;
        if (sxProp.py)
            styles.paddingTop = styles.paddingBottom = `${sxProp.py * 8}px`;
        if (sxProp.pt)
            styles.paddingTop = `${sxProp.pt * 8}px`;
        if (sxProp.pr)
            styles.paddingRight = `${sxProp.pr * 8}px`;
        if (sxProp.pb)
            styles.paddingBottom = `${sxProp.pb * 8}px`;
        if (sxProp.pl)
            styles.paddingLeft = `${sxProp.pl * 8}px`;
        if (sxProp.m)
            styles.margin = `${sxProp.m * 8}px`;
        if (sxProp.mx)
            styles.marginLeft = styles.marginRight = `${sxProp.mx * 8}px`;
        if (sxProp.my)
            styles.marginTop = styles.marginBottom = `${sxProp.my * 8}px`;
        if (sxProp.mt)
            styles.marginTop = `${sxProp.mt * 8}px`;
        if (sxProp.mr)
            styles.marginRight = `${sxProp.mr * 8}px`;
        if (sxProp.mb)
            styles.marginBottom = `${sxProp.mb * 8}px`;
        if (sxProp.ml)
            styles.marginLeft = `${sxProp.ml * 8}px`;
        if (sxProp.width)
            styles.width = sxProp.width;
        if (sxProp.height)
            styles.height = sxProp.height;
        if (sxProp.justifyContent)
            styles.justifyContent = sxProp.justifyContent;
        if (sxProp.alignItems)
            styles.alignItems = sxProp.alignItems;
        if (sxProp.flexWrap)
            styles.flexWrap = sxProp.flexWrap;
        return styles;
    };
    return (<div className={className} style={{
            ...style,
            ...(sx ? convertSxToStyle(sx) : {})
        }}>
      {children}
    </div>);
};
exports.default = Box;

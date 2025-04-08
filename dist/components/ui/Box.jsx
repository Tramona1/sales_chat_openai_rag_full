"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const Box = ({ children, className = '', style = {}, onClick, display, flexDirection, alignItems, justifyContent, flexWrap, flexGrow, gap, p, px, py, pt, pr, pb, pl, m, mx, my, mt, mr, mb, ml, width, height, maxWidth, maxHeight, minWidth, minHeight, borderRadius, position, overflow, bgcolor, color, ...rest }) => {
    const getSpacingClass = (value, prefix) => {
        if (value === undefined)
            return '';
        return `${prefix}-${value}`;
    };
    const displayClass = display ? `${display}` : '';
    const flexDirectionClass = flexDirection ? `flex-${flexDirection}` : '';
    const alignItemsClass = alignItems ? `items-${alignItems}` : '';
    const justifyContentClass = justifyContent ? `justify-${justifyContent}` : '';
    const flexWrapClass = flexWrap ? `flex-${flexWrap}` : '';
    const flexGrowClass = flexGrow !== undefined ? `flex-grow-${flexGrow}` : '';
    const gapClass = gap !== undefined ? `gap-${gap}` : '';
    const positionClass = position ? `${position}` : '';
    const overflowClass = overflow ? `overflow-${overflow}` : '';
    // Combine all spacing classes
    const spacingClasses = [
        getSpacingClass(p, 'p'),
        getSpacingClass(px, 'px'),
        getSpacingClass(py, 'py'),
        getSpacingClass(pt, 'pt'),
        getSpacingClass(pr, 'pr'),
        getSpacingClass(pb, 'pb'),
        getSpacingClass(pl, 'pl'),
        getSpacingClass(m, 'm'),
        getSpacingClass(mx, 'mx'),
        getSpacingClass(my, 'my'),
        getSpacingClass(mt, 'mt'),
        getSpacingClass(mr, 'mr'),
        getSpacingClass(mb, 'mb'),
        getSpacingClass(ml, 'ml')
    ].filter(Boolean).join(' ');
    // Combine all classes
    const combinedClasses = [
        displayClass,
        flexDirectionClass,
        alignItemsClass,
        justifyContentClass,
        flexWrapClass,
        flexGrowClass,
        gapClass,
        spacingClasses,
        positionClass,
        overflowClass,
        className
    ].filter(Boolean).join(' ');
    // Combine all styles
    const combinedStyles = {
        ...style,
        ...(width !== undefined && { width }),
        ...(height !== undefined && { height }),
        ...(maxWidth !== undefined && { maxWidth }),
        ...(maxHeight !== undefined && { maxHeight }),
        ...(minWidth !== undefined && { minWidth }),
        ...(minHeight !== undefined && { minHeight }),
        ...(borderRadius !== undefined && { borderRadius }),
        ...(bgcolor !== undefined && { backgroundColor: bgcolor }),
        ...(color !== undefined && { color })
    };
    return (<div className={combinedClasses} style={combinedStyles} onClick={onClick} {...rest}>
      {children}
    </div>);
};
exports.default = Box;

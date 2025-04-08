import React from 'react';

interface BoxProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  display?: 'block' | 'flex' | 'inline' | 'inline-block' | 'grid';
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  flexGrow?: number;
  gap?: number;
  p?: number;
  px?: number;
  py?: number;
  pt?: number;
  pr?: number;
  pb?: number;
  pl?: number;
  m?: number;
  mx?: number;
  my?: number;
  mt?: number;
  mr?: number;
  mb?: number;
  ml?: number;
  width?: string | number;
  height?: string | number;
  maxWidth?: string | number;
  maxHeight?: string | number;
  minWidth?: string | number;
  minHeight?: string | number;
  borderRadius?: string | number;
  position?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
  overflow?: 'visible' | 'hidden' | 'scroll' | 'auto';
  bgcolor?: string;
  color?: string;
  [key: string]: any;
}

const Box: React.FC<BoxProps> = ({
  children,
  className = '',
  style = {},
  onClick,
  display,
  flexDirection,
  alignItems,
  justifyContent,
  flexWrap,
  flexGrow,
  gap,
  p,
  px,
  py,
  pt,
  pr,
  pb,
  pl,
  m,
  mx,
  my,
  mt,
  mr,
  mb,
  ml,
  width,
  height,
  maxWidth,
  maxHeight,
  minWidth,
  minHeight,
  borderRadius,
  position,
  overflow,
  bgcolor,
  color,
  ...rest
}) => {
  const getSpacingClass = (value: number | undefined, prefix: string) => {
    if (value === undefined) return '';
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
  const combinedStyles: React.CSSProperties = {
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

  return (
    <div
      className={combinedClasses}
      style={combinedStyles}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
};

export default Box; 
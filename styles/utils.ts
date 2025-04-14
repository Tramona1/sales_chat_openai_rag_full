/**
 * UI Utilities for components migrating from MUI
 * 
 * This file provides helper functions to make the transition from MUI to custom styling easier.
 */

import { colors } from './theme';

/**
 * Maps a color variant to its corresponding color value
 * This helps maintain consistency with how MUI color variants were used
 */
export const getColorByVariant = (
  colorName: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'default', 
  variant: 'light' | 'main' | 'dark' = 'main'
): string => {
  switch (colorName) {
    case 'primary':
      return variant === 'light' ? colors.primary[300] : 
             variant === 'dark' ? colors.primary[700] : 
             colors.primary[500];
    case 'secondary':
      return variant === 'light' ? colors.gray[300] : 
             variant === 'dark' ? colors.gray[700] : 
             colors.gray[500];
    case 'success':
      return variant === 'light' ? colors.success.light : 
             variant === 'dark' ? colors.success.dark : 
             colors.success.main;
    case 'error':
      return variant === 'light' ? colors.error.light : 
             variant === 'dark' ? colors.error.dark : 
             colors.error.main;
    case 'warning':
      return variant === 'light' ? colors.warning.light : 
             variant === 'dark' ? colors.warning.dark : 
             colors.warning.main;
    case 'info':
      return variant === 'light' ? colors.info.light : 
             variant === 'dark' ? colors.info.dark : 
             colors.info.main;
    case 'default':
    default:
      return variant === 'light' ? colors.gray[100] : 
             variant === 'dark' ? colors.gray[800] : 
             colors.gray[500];
  }
};

/**
 * Generates CSS classes for a button based on its variant and color
 * This helps migrate from MUI buttons to custom styled buttons
 */
export const getButtonClasses = (
  variant: 'contained' | 'outlined' | 'text' = 'contained',
  color: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'default' = 'primary',
  size: 'small' | 'medium' | 'large' = 'medium',
  fullWidth: boolean = false,
  disabled: boolean = false
): string => {
  const baseClasses = 'font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const sizeClasses = size === 'small' ? 'px-2.5 py-1.5 text-xs' :
                      size === 'large' ? 'px-6 py-3 text-base' :
                      'px-4 py-2 text-sm';
  const widthClass = fullWidth ? 'w-full' : '';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';
  
  if (variant === 'contained') {
    const bgColor = `bg-${color}-500 hover:bg-${color}-600 text-white`;
    return `${baseClasses} ${sizeClasses} ${bgColor} ${widthClass} ${disabledClass}`;
  } else if (variant === 'outlined') {
    const borderColor = `border border-${color}-500 text-${color}-500 hover:bg-${color}-50`;
    return `${baseClasses} ${sizeClasses} ${borderColor} ${widthClass} ${disabledClass}`;
  } else {
    // text variant
    const textColor = `text-${color}-500 hover:bg-${color}-50`;
    return `${baseClasses} ${sizeClasses} ${textColor} ${widthClass} ${disabledClass}`;
  }
};

export default {
  getColorByVariant,
  getButtonClasses,
}; 
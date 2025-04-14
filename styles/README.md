# Theme Configuration

## Overview

This directory contains theming utilities for the application. The project previously used Material UI (MUI) for theming but has been migrated to a simpler approach using:

- Tailwind CSS for styling components
- Custom theme utility for consistent colors and design tokens
- React-feather for icons

## Files

- `theme.ts` - Contains color palette, spacing, typography, and breakpoint values
- `globals.css` - Global styles and Tailwind CSS configuration
- `markdown.css` - Styles specific to rendering markdown content

## Usage

### Colors

Import colors from the theme file:

```tsx
import { colors } from '../styles/theme';

// In your component
<div className="text-blue-700" style={{ borderColor: colors.primary[700] }}>
  Primary colored border
</div>
```

### Icons

We use react-feather for icons:

```tsx
import { Home, Search, AlertTriangle } from 'react-feather';

// In your component
<Home className="h-5 w-5 text-gray-500" />
```

## Migrating from MUI

This project was migrated from Material UI v7 to avoid build issues. If you're updating components that previously used MUI:

1. Replace MUI components with native HTML or custom components
2. Use Tailwind CSS classes for styling
3. Use the theme tokens from `theme.ts` for custom styling
4. Replace MUI icons with equivalent react-feather icons 
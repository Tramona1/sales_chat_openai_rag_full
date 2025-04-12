// ESLint v9 configuration file
import nextPlugin from 'eslint-config-next';

export default [
  // Apply Next.js recommended rules and core web vitals rules
  ...nextPlugin,

  // Additional custom rules
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      // Your custom rules can go here
      'no-unused-vars': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  
  // Specific overrides for certain file patterns
  {
    files: ['pages/api/**/*.{js,ts}'],
    rules: {
      // Rules specific to API routes
    },
  },
]; 
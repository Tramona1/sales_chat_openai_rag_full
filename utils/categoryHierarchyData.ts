import { CategoryHierarchy } from './hierarchicalCategories';

/**
 * Base category hierarchy used as a template for building category facets
 */
export const BASE_CATEGORY_HIERARCHY: CategoryHierarchy[] = [
  {
    id: 'product',
    displayName: 'Product',
    documentCount: 0,
    children: [
      {
        id: 'features',
        displayName: 'Features',
        documentCount: 0,
        children: [
          {
            id: 'core_features',
            displayName: 'Core Features',
            documentCount: 0,
            children: []
          },
          {
            id: 'advanced_features',
            displayName: 'Advanced Features',
            documentCount: 0,
            children: []
          },
          {
            id: 'upcoming_features',
            displayName: 'Upcoming Features',
            documentCount: 0,
            children: []
          }
        ]
      },
      {
        id: 'pricing',
        displayName: 'Pricing',
        documentCount: 0,
        children: []
      },
      {
        id: 'integrations',
        displayName: 'Integrations',
        documentCount: 0,
        children: []
      }
    ]
  },
  {
    id: 'industry',
    displayName: 'Industry',
    documentCount: 0,
    children: [
      {
        id: 'healthcare',
        displayName: 'Healthcare',
        documentCount: 0,
        children: []
      },
      {
        id: 'finance',
        displayName: 'Finance',
        documentCount: 0,
        children: []
      },
      {
        id: 'retail',
        displayName: 'Retail',
        documentCount: 0,
        children: []
      },
      {
        id: 'technology',
        displayName: 'Technology',
        documentCount: 0,
        children: []
      },
      {
        id: 'manufacturing',
        displayName: 'Manufacturing',
        documentCount: 0,
        children: []
      }
    ]
  },
  {
    id: 'function',
    displayName: 'Function',
    documentCount: 0,
    children: [
      {
        id: 'sales',
        displayName: 'Sales',
        documentCount: 0,
        children: []
      },
      {
        id: 'marketing',
        displayName: 'Marketing',
        documentCount: 0,
        children: []
      },
      {
        id: 'support',
        displayName: 'Support',
        documentCount: 0,
        children: []
      },
      {
        id: 'hr',
        displayName: 'HR',
        documentCount: 0,
        children: []
      },
      {
        id: 'operations',
        displayName: 'Operations',
        documentCount: 0,
        children: []
      }
    ]
  },
  {
    id: 'use_case',
    displayName: 'Use Case',
    documentCount: 0,
    children: [
      {
        id: 'onboarding',
        displayName: 'Onboarding',
        documentCount: 0,
        children: []
      },
      {
        id: 'customer_acquisition',
        displayName: 'Customer Acquisition',
        documentCount: 0,
        children: []
      },
      {
        id: 'customer_retention',
        displayName: 'Customer Retention',
        documentCount: 0,
        children: []
      },
      {
        id: 'workflow_optimization',
        displayName: 'Workflow Optimization',
        documentCount: 0,
        children: []
      }
    ]
  },
  {
    id: 'technical_level',
    displayName: 'Technical Level',
    documentCount: 0,
    children: [
      {
        id: 'beginner',
        displayName: 'Beginner',
        documentCount: 0,
        children: []
      },
      {
        id: 'intermediate',
        displayName: 'Intermediate',
        documentCount: 0,
        children: []
      },
      {
        id: 'advanced',
        displayName: 'Advanced',
        documentCount: 0,
        children: []
      }
    ]
  }
]; 
# Custom UI Component Library

This documentation outlines the custom UI components created for the Sales Knowledge Assistant application. These components are built with React and styled with Tailwind CSS, providing a consistent, modern, and accessible interface across the application.

## Table of Contents
- [Button](#button)
- [Box](#box)
- [Card](#card)
- [Typography](#typography)
- [Dialog](#dialog)
- [Alert](#alert)
- [DataGrid](#datagrid)
- [Select](#select)
- [TextField](#textfield)
- [Chip](#chip)
- [Paper](#paper)
- [CircularProgress](#circularprogress)
- [Divider](#divider)
- [Tabs](#tabs)

## Button

A versatile button component with support for different variants, sizes, and states.

```jsx
import Button from '../ui/Button';

// Primary button
<Button variant="primary" onClick={handleClick}>
  Primary Action
</Button>

// Secondary button
<Button variant="secondary" size="small">
  Secondary Action
</Button>

// Error button
<Button variant="error" disabled={true}>
  Delete
</Button>

// Outline button
<Button variant="outline" fullWidth={true}>
  Full Width Action
</Button>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `variant` | `'primary' \| 'secondary' \| 'error' \| 'outline'` | `'primary'` | The visual style of the button |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | The size of the button |
| `fullWidth` | `boolean` | `false` | Whether the button should take up the full width of its container |
| `disabled` | `boolean` | `false` | Whether the button is disabled |
| `onClick` | `() => void` | - | Function to call when the button is clicked |
| `className` | `string` | `''` | Additional CSS classes |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | HTML button type attribute |
| `autoFocus` | `boolean` | `false` | Whether the button should automatically receive focus when the page loads |

## Box

A flexible layout component that provides convenient shortcuts for applying common styles with Tailwind.

```jsx
import Box from '../ui/Box';

<Box 
  display="flex" 
  flexDirection="column" 
  gap={2}
  p={4} 
  bgcolor="#f5f5f5"
>
  Content here
</Box>
```

### Props

The Box component accepts all HTML div attributes plus the following layout-specific props:

| Prop | Type | Description |
| ---- | ---- | ----------- |
| `display` | `'block' \| 'flex' \| 'inline' \| 'inline-block' \| 'grid'` | CSS display property |
| `flexDirection` | `'row' \| 'column' \| 'row-reverse' \| 'column-reverse'` | Direction of flex items |
| `alignItems` | `'flex-start' \| 'flex-end' \| 'center' \| 'baseline' \| 'stretch'` | Alignment of flex items |
| `justifyContent` | `'flex-start' \| 'flex-end' \| 'center' \| 'space-between' \| 'space-around' \| 'space-evenly'` | Justification of flex items |
| `flexWrap` | `'nowrap' \| 'wrap' \| 'wrap-reverse'` | Whether flex items should wrap |
| `flexGrow` | `number` | Grow factor of the flex item |
| `gap` | `number` | Gap between grid/flex items |
| `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl` | `number` | Padding (all, x-axis, y-axis, top, right, bottom, left) |
| `m`, `mx`, `my`, `mt`, `mr`, `mb`, `ml` | `number` | Margin (all, x-axis, y-axis, top, right, bottom, left) |
| `width`, `height` | `string \| number` | Width and height |
| `bgcolor` | `string` | Background color |
| `color` | `string` | Text color |

## Card

A container component that provides a flexible and extensible content container with shadows, borders, and padding.

```jsx
import { Card, CardContent, CardHeader, CardActions } from '../ui/Card';

<Card>
  <CardHeader title="Card Title" subheader="Card Subtitle" />
  <CardContent>
    Card content goes here
  </CardContent>
  <CardActions>
    <Button>Action 1</Button>
    <Button>Action 2</Button>
  </CardActions>
</Card>
```

### Card Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `className` | `string` | `''` | Additional CSS classes |

### CardHeader Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `title` | `React.ReactNode` | - | The title to display |
| `subheader` | `React.ReactNode` | - | The subheader to display |
| `action` | `React.ReactNode` | - | An action element to display |
| `className` | `string` | `''` | Additional CSS classes |

### CardContent Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `className` | `string` | `''` | Additional CSS classes |

### CardActions Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `className` | `string` | `''` | Additional CSS classes |

## Typography

A component for presenting text with consistent styling and semantic meaning.

```jsx
import Typography from '../ui/Typography';

<Typography variant="h1">Heading 1</Typography>
<Typography variant="body1" color="textSecondary">
  Body text with secondary color
</Typography>
<Typography variant="subtitle1" gutterBottom>
  Subtitle with margin bottom
</Typography>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `variant` | Various heading and text styles | `'body1'` | The variant to use |
| `component` | `React.ElementType` | Depends on variant | The component used for the root node |
| `align` | `'left' \| 'center' \| 'right' \| 'justify'` | `'left'` | Text alignment |
| `color` | Various color options | `'initial'` | The color of the text |
| `gutterBottom` | `boolean` | `false` | Whether to add margin bottom |
| `noWrap` | `boolean` | `false` | Whether the text should be truncated with ellipsis if it overflows |
| `paragraph` | `boolean` | `false` | Whether to render as a paragraph with margin bottom |
| `className` | `string` | `''` | Additional CSS classes |
| `fontWeight` | `'normal' \| 'medium' \| 'bold'` | - | The font weight to use |

## Dialog

A modal dialog component that can be used to prompt users for decisions or to display critical information.

```jsx
import Dialog from '../ui/Dialog';
import Button from '../ui/Button';

const [open, setOpen] = useState(false);

<Button onClick={() => setOpen(true)}>Open Dialog</Button>
<Dialog
  open={open}
  onClose={() => setOpen(false)}
  title="Dialog Title"
  actions={
    <>
      <Button onClick={() => setOpen(false)} variant="secondary">
        Cancel
      </Button>
      <Button onClick={handleConfirm} variant="primary">
        Confirm
      </Button>
    </>
  }
>
  <p>Dialog content goes here.</p>
</Dialog>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `open` | `boolean` | - | Whether the dialog is open |
| `onClose` | `() => void` | - | Function to call when the dialog requests to be closed |
| `title` | `string` | - | The title of the dialog |
| `actions` | `React.ReactNode` | - | Actions to display in the dialog footer |
| `children` | `React.ReactNode` | - | The content of the dialog |

## Alert

A component for displaying feedback messages to users.

```jsx
import Alert from '../ui/Alert';

<Alert severity="success">
  Operation completed successfully!
</Alert>

<Alert 
  severity="error" 
  onClose={() => handleClose()}
  variant="filled"
>
  An error occurred while processing your request.
</Alert>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `severity` | `'error' \| 'warning' \| 'info' \| 'success'` | `'info'` | The severity of the alert |
| `onClose` | `() => void` | - | Function to call when the alert's close button is clicked |
| `variant` | `'standard' \| 'filled' \| 'outlined'` | `'standard'` | The variant to use |
| `className` | `string` | `''` | Additional CSS classes |

## DataGrid

A powerful data table component for displaying tabular data with features like sorting, pagination, and row selection.

```jsx
import DataGrid from '../ui/DataGrid';

const columns = [
  { field: 'id', headerName: 'ID', width: 90 },
  { field: 'name', headerName: 'Name', width: 150 },
  { 
    field: 'actions', 
    headerName: 'Actions', 
    width: 120,
    renderCell: (params) => (
      <Button onClick={() => handleAction(params.row.id)}>
        View
      </Button>
    )
  }
];

const rows = [
  { id: 1, name: 'John Doe' },
  { id: 2, name: 'Jane Smith' }
];

<DataGrid
  rows={rows}
  columns={columns}
  pageSize={5}
  checkboxSelection
  onSelectionModelChange={handleSelectionChange}
/>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `rows` | `any[]` | - | The rows to display |
| `columns` | `Column[]` | - | The columns configuration |
| `onSelectionModelChange` | `(selectedIds: string[]) => void` | - | Callback fired when the selection model changes |
| `checkboxSelection` | `boolean` | `false` | Whether to show checkboxes for row selection |
| `className` | `string` | `''` | Additional CSS classes |
| `autoHeight` | `boolean` | `false` | Whether the grid should automatically adjust its height |
| `pageSize` | `number` | `10` | Number of rows per page |

## Select

A form control component for selecting a value from multiple options.

```jsx
import Select from '../ui/Select';

const [value, setValue] = useState('option1');

const options = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' }
];

<Select
  label="Select an option"
  value={value}
  onChange={(newValue) => setValue(newValue)}
  options={options}
  fullWidth
/>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `label` | `string` | - | The label for the select |
| `value` | `string` | - | The selected value |
| `onChange` | `(value: string) => void` | - | Function to call when the value changes |
| `options` | `{ value: string; label: string }[]` | - | The options to display |
| `placeholder` | `string` | `'Select an option'` | Placeholder text when no value is selected |
| `fullWidth` | `boolean` | `false` | Whether the select should take the full width of its container |
| `disabled` | `boolean` | `false` | Whether the select is disabled |
| `error` | `boolean` | `false` | Whether to show an error state |
| `helperText` | `string` | - | Helper text to display below the select |
| `className` | `string` | `''` | Additional CSS classes |

## TextField

A form control component for inputting text.

```jsx
import TextField from '../ui/TextField';

const [value, setValue] = useState('');

<TextField
  label="Name"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  fullWidth
  placeholder="Enter your name"
/>

<TextField
  label="Description"
  multiline
  rows={4}
  fullWidth
/>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `label` | `string` | - | The label for the input |
| `helperText` | `string` | - | Helper text to display below the input |
| `error` | `boolean` | `false` | Whether to show an error state |
| `fullWidth` | `boolean` | `false` | Whether the input should take the full width of its container |
| `variant` | `'outlined' \| 'filled' \| 'standard'` | `'outlined'` | The variant to use |
| `size` | `'small' \| 'medium'` | `'medium'` | The size of the input |
| `multiline` | `boolean` | `false` | Whether the input is a textarea |
| `rows` | `number` | `1` | The number of rows for a textarea |
| `className` | `string` | `''` | Additional CSS classes |

## Chip

A compact element that represents an input, attribute, or action.

```jsx
import Chip from '../ui/Chip';

<Chip label="Basic" />

<Chip 
  label="Deletable" 
  onDelete={() => handleDelete()}
  color="primary"
  variant="outlined"
/>

<Chip
  label="With Icon"
  icon={<CheckIcon />}
  color="success"
/>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `label` | `string` | - | The content of the chip |
| `onDelete` | `() => void` | - | Function to call when the delete icon is clicked |
| `color` | Various color options | `'default'` | The color of the chip |
| `variant` | `'filled' \| 'outlined'` | `'filled'` | The variant to use |
| `size` | `'small' \| 'medium'` | `'medium'` | The size of the chip |
| `className` | `string` | `''` | Additional CSS classes |
| `icon` | `React.ReactNode` | - | An icon element to display at the start of the chip |
| `clickable` | `boolean` | `false` | Whether the chip is clickable |
| `onClick` | `() => void` | - | Function to call when the chip is clicked |

## Paper

A surface component that provides a proper elevation appearance.

```jsx
import Paper from '../ui/Paper';

<Paper elevation={1} className="p-4">
  Content on a slightly elevated surface
</Paper>

<Paper variant="outlined" className="p-4">
  Content on an outlined surface
</Paper>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `1` | The elevation of the paper |
| `square` | `boolean` | `false` | Whether to remove border radius |
| `variant` | `'elevation' \| 'outlined'` | `'elevation'` | The variant to use |
| `className` | `string` | `''` | Additional CSS classes |

## CircularProgress

A circular progress indicator component.

```jsx
import CircularProgress from '../ui/CircularProgress';

<CircularProgress />

<CircularProgress size={24} color="secondary" />
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `size` | `number` | `40` | The size of the circle |
| `color` | `'primary' \| 'secondary' \| 'error' \| 'info' \| 'success' \| 'warning'` | `'primary'` | The color of the progress indicator |
| `className` | `string` | `''` | Additional CSS classes |

## Divider

A component that separates content.

```jsx
import Divider from '../ui/Divider';

<Divider />

<Divider orientation="vertical" />

<Divider light textAlign="center">
  Text within divider
</Divider>
```

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | The orientation of the divider |
| `variant` | `'fullWidth' \| 'inset' \| 'middle'` | `'fullWidth'` | The variant to use |
| `light` | `boolean` | `false` | Whether to use a lighter color |
| `textAlign` | `'center' \| 'left' \| 'right'` | - | The alignment of the text within the divider |
| `className` | `string` | `''` | Additional CSS classes |

## Tabs

A navigation component that organizes content into separate views that a user can switch between.

```jsx
import { Tabs, Tab, TabPanel } from '../ui/Tabs';

const [value, setValue] = useState(0);

<Tabs value={value} onChange={(e, newValue) => setValue(newValue)}>
  <Tab label="Tab 1" value={0} />
  <Tab label="Tab 2" value={1} />
  <Tab label="Tab 3" value={2} />
</Tabs>

<TabPanel value={value} index={0}>
  Content for Tab 1
</TabPanel>
<TabPanel value={value} index={1}>
  Content for Tab 2
</TabPanel>
<TabPanel value={value} index={2}>
  Content for Tab 3
</TabPanel>
```

### Tabs Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `value` | `string \| number` | - | The value of the currently selected tab |
| `onChange` | `(event: React.SyntheticEvent, newValue: string \| number) => void` | - | Function to call when the selected tab changes |
| `variant` | `'standard' \| 'fullWidth' \| 'scrollable'` | `'standard'` | The variant to use |
| `centered` | `boolean` | `false` | Whether to center the tabs |
| `className` | `string` | `''` | Additional CSS classes |

### Tab Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `label` | `string` | - | The label for the tab |
| `value` | `string \| number` | - | The value of the tab |
| `icon` | `React.ReactNode` | - | An icon element to display |
| `disabled` | `boolean` | `false` | Whether the tab is disabled |
| `className` | `string` | `''` | Additional CSS classes |

### TabPanel Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `value` | `string \| number` | - | The value of the currently selected tab |
| `index` | `string \| number` | - | The index of this tab panel |
| `className` | `string` | `''` | Additional CSS classes |

## Usage Guidelines

1. **Consistency**: Use these components consistently throughout the application to maintain a uniform look and feel.

2. **Accessibility**: These components are designed with accessibility in mind. Maintain proper keyboard navigation, focus management, and ARIA attributes.

3. **Responsive Design**: Leverage Tailwind's responsive utilities to ensure components adapt well to different screen sizes.

4. **Theme Customization**: Colors and styles can be adjusted by modifying the Tailwind configuration.

## Admin Dashboard UI

The Sales Knowledge Assistant includes a modern admin dashboard interface built with our custom components. The admin dashboard provides several views for managing the application:

- System Metrics
- Document Management
- Chat Sessions
- Company Sessions
- Pending Documents

### Layout Structure

The admin dashboard follows a consistent layout pattern that you can reuse for other admin interfaces:

```jsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  <h1 className="text-2xl font-bold mb-6 text-primary-900">Admin Dashboard</h1>
  
  {/* Navigation tabs */}
  <div className="border-b border-gray-200 mb-6">
    <nav className="-mb-px flex space-x-8 overflow-x-auto">
      <button
        onClick={() => setActiveTab('tab1')}
        className={`${
          activeTab === 'tab1'
            ? 'border-primary-500 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center transition-colors`}
      >
        <Icon className="h-5 w-5 mr-2" />
        Tab 1
      </button>
      {/* More tabs... */}
    </nav>
  </div>
  
  {/* Tab content */}
  <div>
    {activeTab === 'tab1' && <Tab1Content />}
    {/* Other tab contents... */}
  </div>
</div>
```

### Data Tables

For data-dense admin views, use this table pattern:

```jsx
<div className="bg-white shadow-sm overflow-hidden rounded-lg">
  <div className="border-b border-gray-200">
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr>
          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Column 1
          </th>
          {/* More columns... */}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {items.map((item) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-4 py-2 whitespace-nowrap text-sm">
              {item.property}
            </td>
            {/* More cells... */}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  
  {/* Pagination */}
  <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-gray-700">
          Showing <span className="font-medium">{page * pageSize + 1}</span> to{' '}
          <span className="font-medium">{Math.min((page + 1) * pageSize, totalItems)}</span>{' '}
          of <span className="font-medium">{totalItems}</span> results
        </p>
      </div>
      <div>
        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
          {/* Pagination buttons... */}
        </nav>
      </div>
    </div>
  </div>
</div>
```

### Card-Based Layouts

For content-focused views, use cards with consistent padding and spacing:

```jsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <Card className="shadow-sm">
    <CardContent>
      <Typography variant="h6" className="font-medium mb-2">
        Card Title
      </Typography>
      <Typography variant="body2">
        Card content goes here
      </Typography>
    </CardContent>
  </Card>
  {/* More cards... */}
</div>
```

### Split Views

For views with navigation and details side-by-side:

```jsx
<div className="bg-white rounded-lg shadow-sm overflow-hidden">
  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-x divide-gray-200">
    {/* Navigation/List panel */}
    <div className="md:col-span-1 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Items</h2>
        <Button variant="primary" size="small">Add New</Button>
      </div>
      
      {/* List of items */}
      <div className="overflow-y-auto max-h-[500px]">
        <ul className="divide-y divide-gray-200">
          {items.map((item) => (
            <li key={item.id} className="py-3">
              <button
                onClick={() => selectItem(item.id)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50
                          transition-colors focus:outline-none focus:ring-2 
                          focus:ring-blue-500 focus:ring-opacity-50"
              >
                <p className="font-medium text-gray-900">{item.title}</p>
                <p className="text-sm text-gray-500">{item.subtitle}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
    
    {/* Details panel */}
    <div className="md:col-span-2 p-4 bg-gray-50">
      {selectedItem ? (
        <div className="h-full flex flex-col">
          <div className="border-b border-gray-200 pb-4 mb-4">
            <h2 className="text-xl font-semibold">{selectedItem.title}</h2>
          </div>
          
          {/* Item details */}
          <div className="space-y-4">
            {/* Content here... */}
          </div>
        </div>
      ) : (
        <div className="flex justify-center items-center h-full">
          <p className="text-gray-500 italic">Select an item to view details</p>
        </div>
      )}
    </div>
  </div>
</div>
```

### Design Principles

When implementing admin interfaces, follow these principles:

1. **Clear Visual Hierarchy**: Use typography, spacing, and color to establish importance.
2. **Whitespace**: Use consistent spacing and padding for better readability.
3. **Subtle Shadows**: Use light shadows for depth without heavy effects.
4. **Clear State Feedback**: Indicate hover, active, and selected states clearly.
5. **Consistent Actions**: Place primary actions in consistent locations.
6. **Responsive Design**: Ensure the interface works on all screen sizes.
7. **Loading States**: Provide clear loading indicators.
8. **Empty States**: Have helpful empty state messages. 
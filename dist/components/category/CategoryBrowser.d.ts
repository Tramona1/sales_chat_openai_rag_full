import React from 'react';
import { CategoryHierarchy } from '../../utils/hierarchicalCategories';
interface CategoryBrowserProps {
    categories: CategoryHierarchy[];
    selectedPath: string[];
    onSelectCategory: (path: string[]) => void;
    loading?: boolean;
}
declare const CategoryBrowser: React.FC<CategoryBrowserProps>;
export default CategoryBrowser;

import React, { useState, useEffect } from 'react';
import { CategoryHierarchy } from '../../utils/hierarchicalCategories';
import Chip from '../ui/Chip';
import Button from '../ui/Button';

interface CategoryBrowserProps {
  categories: CategoryHierarchy[];
  selectedPath: string[];
  onSelectCategory: (path: string[]) => void;
  loading?: boolean;
}

const CategoryBrowser: React.FC<CategoryBrowserProps> = ({
  categories,
  selectedPath,
  onSelectCategory,
  loading = false,
}) => {
  const [currentCategories, setCurrentCategories] = useState<CategoryHierarchy[]>(categories);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string; }>>([]);

  // When selected path or categories change, update the view
  useEffect(() => {
    if (!categories || categories.length === 0) return;
    
    if (!selectedPath || selectedPath.length === 0) {
      // At root level
      setCurrentCategories(categories);
      setBreadcrumbs([]);
      return;
    }
    
    // Navigate to the selected path
    let currentLevel = categories;
    const crumbs: Array<{ id: string; name: string; }> = [];
    
    for (let i = 0; i < selectedPath.length; i++) {
      const categoryId = selectedPath[i];
      const category = currentLevel.find(c => c.id === categoryId);
      
      if (category) {
        crumbs.push({ id: category.id, name: category.displayName });
        
        if (i === selectedPath.length - 1) {
          // Last item in path - show its children
          setCurrentCategories(category.children);
        } else {
          // Navigate to next level
          currentLevel = category.children;
        }
      } else {
        // Path not found, revert to root
        setCurrentCategories(categories);
        setBreadcrumbs([]);
        return;
      }
    }
    
    setBreadcrumbs(crumbs);
  }, [categories, selectedPath]);

  // Handle clicking on a category
  const handleCategoryClick = (category: CategoryHierarchy) => {
    const newPath = [...selectedPath, category.id];
    onSelectCategory(newPath);
  };
  
  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (index: number) => {
    // Navigate to specific breadcrumb level
    // If clicking the last breadcrumb, we want to stay at the current level
    // and show the children of the last category in the path
    if (index === breadcrumbs.length - 1) {
      return;
    }
    
    const newPath = selectedPath.slice(0, index + 1);
    onSelectCategory(newPath);
  };
  
  // Go up one level
  const handleGoUp = () => {
    if (selectedPath.length === 0) return;
    const newPath = selectedPath.slice(0, -1);
    onSelectCategory(newPath);
  };

  // Go to root level
  const handleGoToRoot = () => {
    onSelectCategory([]);
  };

  return (
    <div className="category-browser">
      {/* Breadcrumb navigation */}
      {selectedPath.length > 0 && (
        <div className="flex items-center mb-4 overflow-x-auto whitespace-nowrap pb-2">
          <Button 
            variant="outline" 
            size="small" 
            onClick={handleGoToRoot}
            className="mr-2"
          >
            All Categories
          </Button>
          
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.id}>
              <span className="mx-1 text-gray-400">/</span>
              <Button
                variant="outline"
                size="small"
                onClick={() => handleBreadcrumbClick(index)}
                className={index === breadcrumbs.length - 1 ? 'font-bold' : ''}
              >
                {crumb.name}
              </Button>
            </React.Fragment>
          ))}
          
          {selectedPath.length > 0 && (
            <Button 
              variant="outline" 
              size="small" 
              onClick={handleGoUp}
              className="ml-auto"
            >
              Go Up
            </Button>
          )}
        </div>
      )}
      
      {/* Categories grid */}
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {currentCategories.map(category => (
            <div 
              key={category.id}
              onClick={() => handleCategoryClick(category)}
              className="p-4 border rounded-lg shadow-sm transition-all hover:shadow-md cursor-pointer"
              style={{ borderLeft: `4px solid ${category.color}` }}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-medium">{category.displayName}</h3>
                <Chip 
                  label={`${category.documentCount}`} 
                  variant="outlined" 
                  size="small"
                  color="primary"
                />
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{category.description}</p>
              
              {category.children.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Subcategories: {category.children.length}</span>
                </div>
              )}
            </div>
          ))}
          
          {currentCategories.length === 0 && selectedPath.length > 0 && (
            <div className="col-span-3 p-8 text-center text-gray-500">
              No subcategories found in this category.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CategoryBrowser; 
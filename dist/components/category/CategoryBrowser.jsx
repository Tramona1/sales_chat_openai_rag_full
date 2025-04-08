"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const Chip_1 = __importDefault(require("../ui/Chip"));
const Button_1 = __importDefault(require("../ui/Button"));
const CategoryBrowser = ({ categories, selectedPath, onSelectCategory, loading = false, }) => {
    const [currentCategories, setCurrentCategories] = (0, react_1.useState)(categories);
    const [breadcrumbs, setBreadcrumbs] = (0, react_1.useState)([]);
    // When selected path or categories change, update the view
    (0, react_1.useEffect)(() => {
        if (!categories || categories.length === 0)
            return;
        if (!selectedPath || selectedPath.length === 0) {
            // At root level
            setCurrentCategories(categories);
            setBreadcrumbs([]);
            return;
        }
        // Navigate to the selected path
        let currentLevel = categories;
        const crumbs = [];
        for (let i = 0; i < selectedPath.length; i++) {
            const categoryId = selectedPath[i];
            const category = currentLevel.find(c => c.id === categoryId);
            if (category) {
                crumbs.push({ id: category.id, name: category.displayName });
                if (i === selectedPath.length - 1) {
                    // Last item in path - show its children
                    setCurrentCategories(category.children);
                }
                else {
                    // Navigate to next level
                    currentLevel = category.children;
                }
            }
            else {
                // Path not found, revert to root
                setCurrentCategories(categories);
                setBreadcrumbs([]);
                return;
            }
        }
        setBreadcrumbs(crumbs);
    }, [categories, selectedPath]);
    // Handle clicking on a category
    const handleCategoryClick = (category) => {
        const newPath = [...selectedPath, category.id];
        onSelectCategory(newPath);
    };
    // Handle breadcrumb navigation
    const handleBreadcrumbClick = (index) => {
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
        if (selectedPath.length === 0)
            return;
        const newPath = selectedPath.slice(0, -1);
        onSelectCategory(newPath);
    };
    // Go to root level
    const handleGoToRoot = () => {
        onSelectCategory([]);
    };
    return (<div className="category-browser">
      {/* Breadcrumb navigation */}
      {selectedPath.length > 0 && (<div className="flex items-center mb-4 overflow-x-auto whitespace-nowrap pb-2">
          <Button_1.default variant="outline" size="small" onClick={handleGoToRoot} className="mr-2">
            All Categories
          </Button_1.default>
          
          {breadcrumbs.map((crumb, index) => (<react_1.default.Fragment key={crumb.id}>
              <span className="mx-1 text-gray-400">/</span>
              <Button_1.default variant="outline" size="small" onClick={() => handleBreadcrumbClick(index)} className={index === breadcrumbs.length - 1 ? 'font-bold' : ''}>
                {crumb.name}
              </Button_1.default>
            </react_1.default.Fragment>))}
          
          {selectedPath.length > 0 && (<Button_1.default variant="outline" size="small" onClick={handleGoUp} className="ml-auto">
              Go Up
            </Button_1.default>)}
        </div>)}
      
      {/* Categories grid */}
      {loading ? (<div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>) : (<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {currentCategories.map(category => (<div key={category.id} onClick={() => handleCategoryClick(category)} className="p-4 border rounded-lg shadow-sm transition-all hover:shadow-md cursor-pointer" style={{ borderLeft: `4px solid ${category.color}` }}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-medium">{category.displayName}</h3>
                <Chip_1.default label={`${category.documentCount}`} variant="outlined" size="small" color="primary"/>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{category.description}</p>
              
              {category.children.length > 0 && (<div className="mt-3 pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Subcategories: {category.children.length}</span>
                </div>)}
            </div>))}
          
          {currentCategories.length === 0 && selectedPath.length > 0 && (<div className="col-span-3 p-8 text-center text-gray-500">
              No subcategories found in this category.
            </div>)}
        </div>)}
    </div>);
};
exports.default = CategoryBrowser;

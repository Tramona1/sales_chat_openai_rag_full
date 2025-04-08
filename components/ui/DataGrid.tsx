import React, { useState } from 'react';

interface Column {
  field: string;
  headerName: string;
  width?: number;
  flex?: number;
  renderCell?: (params: { row: any; value: any }) => React.ReactNode;
}

interface DataGridProps {
  columns: Column[];
  rows: any[];
  onSelectionModelChange?: (selectedIds: string[]) => void;
  checkboxSelection?: boolean;
  className?: string;
  autoHeight?: boolean;
  pageSize?: number;
}

const DataGrid: React.FC<DataGridProps> = ({
  columns,
  rows,
  onSelectionModelChange,
  checkboxSelection = false,
  className = '',
  autoHeight = false,
  pageSize = 10
}) => {
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate total pages
  const totalPages = Math.ceil(rows.length / pageSize);
  
  // Get current page data
  const startIndex = (currentPage - 1) * pageSize;
  const displayedRows = rows.slice(startIndex, startIndex + pageSize);

  const handleCheckboxChange = (id: string) => {
    const newSelectedRows = { ...selectedRows };
    
    if (newSelectedRows[id]) {
      delete newSelectedRows[id];
    } else {
      newSelectedRows[id] = true;
    }
    
    setSelectedRows(newSelectedRows);
    
    if (onSelectionModelChange) {
      onSelectionModelChange(Object.keys(newSelectedRows));
    }
  };

  const handleSelectAll = () => {
    if (Object.keys(selectedRows).length === displayedRows.length) {
      // Deselect all
      setSelectedRows({});
      if (onSelectionModelChange) {
        onSelectionModelChange([]);
      }
    } else {
      // Select all
      const newSelectedRows: Record<string, boolean> = {};
      displayedRows.forEach(row => {
        newSelectedRows[row.id] = true;
      });
      setSelectedRows(newSelectedRows);
      if (onSelectionModelChange) {
        onSelectionModelChange(displayedRows.map(row => row.id));
      }
    }
  };

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {checkboxSelection && (
                <th scope="col" className="px-6 py-3 w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={displayedRows.length > 0 && Object.keys(selectedRows).length === displayedRows.length}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.field}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  style={{ 
                    width: column.width, 
                    minWidth: column.width,
                    flex: column.flex 
                  }}
                >
                  {column.headerName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayedRows.map((row) => (
              <tr key={row.id}>
                {checkboxSelection && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={!!selectedRows[row.id]}
                      onChange={() => handleCheckboxChange(row.id)}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={`${row.id}-${column.field}`}
                    className="px-6 py-4 whitespace-nowrap"
                  >
                    {column.renderCell 
                      ? column.renderCell({ row, value: row[column.field] }) 
                      : row[column.field]
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(startIndex + pageSize, rows.length)}
                </span>{' '}
                of <span className="font-medium">{rows.length}</span> results
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                      currentPage === i + 1
                        ? 'bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                        : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataGrid; 
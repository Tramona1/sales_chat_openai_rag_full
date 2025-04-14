/**
 * Generic Table Component
 * 
 * A simple replacement for MUI DataGrid that uses Tailwind CSS for styling
 */

import React from 'react';
import { 
  ChevronRight as ChevronRightIcon, 
  ChevronLeft as ChevronLeftIcon,
  ChevronsLeft as ChevronsLeftIcon,
  ChevronsRight as ChevronsRightIcon
} from 'react-feather';

export interface TableColumn<T = any> {
  field: string;
  headerName: string;
  width?: number | string;
  flex?: number;
  sortable?: boolean;
  renderCell?: (row: T) => React.ReactNode;
  valueGetter?: (row: T) => any;
  valueFormatter?: (value: any) => string;
}

export interface TableProps<T = any> {
  rows: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  getRowId?: (row: T) => string | number;
  pagination?: boolean;
  paginationModel?: {
    pageSize: number;
    page: number;
  };
  onPaginationModelChange?: (model: { pageSize: number; page: number }) => void;
  rowCount?: number;
  className?: string;
}

const Table = <T extends Record<string, any>>({
  rows,
  columns,
  loading = false,
  getRowId = (row) => row.id,
  pagination = false,
  paginationModel = { pageSize: 10, page: 0 },
  onPaginationModelChange,
  rowCount = 0,
  className = ''
}: TableProps<T>) => {
  // Helper to get a value from a row
  const getCellValue = (row: T, column: TableColumn<T>) => {
    if (column.valueGetter) {
      return column.valueGetter(row);
    }
    
    const value = row[column.field];
    
    if (column.valueFormatter && value !== undefined) {
      return column.valueFormatter(value);
    }
    
    return value;
  };
  
  // Calculate total pages
  const totalPages = Math.ceil(rowCount / paginationModel.pageSize);
  
  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (onPaginationModelChange) {
      onPaginationModelChange({
        ...paginationModel,
        page: newPage
      });
    }
  };
  
  // Handle page size change
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onPaginationModelChange) {
      onPaginationModelChange({
        page: 0, // Reset to first page when changing page size
        pageSize: Number(e.target.value)
      });
    }
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8">
        <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((column, index) => (
                    <th
                      key={index}
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      style={{ 
                        width: column.width, 
                        flex: column.flex
                      }}
                    >
                      {column.headerName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={columns.length} className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="ml-2">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-6 py-4 text-center text-gray-500">
                      No data available
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={getRowId(row)} className="hover:bg-gray-50">
                      {columns.map((column, colIndex) => (
                        <td key={colIndex} className="px-6 py-4 whitespace-nowrap">
                          {column.renderCell ? (
                            column.renderCell(row)
                          ) : (
                            <span className="text-sm text-gray-900">
                              {getCellValue(row, column)}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {pagination && (
        <div className="flex justify-between items-center px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
          <div className="flex items-center">
            <select
              value={paginationModel.pageSize}
              onChange={handlePageSizeChange}
              className="mr-2 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
            <span className="text-sm text-gray-700">
              Showing <span className="font-medium">{rows.length > 0 ? paginationModel.page * paginationModel.pageSize + 1 : 0}</span> to{" "}
              <span className="font-medium">
                {Math.min((paginationModel.page + 1) * paginationModel.pageSize, rowCount)}
              </span>{" "}
              of <span className="font-medium">{rowCount}</span> results
            </span>
          </div>
          
          <div className="flex">
            <button
              onClick={() => handlePageChange(0)}
              disabled={paginationModel.page === 0}
              className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                paginationModel.page === 0
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span className="sr-only">First</span>
              <ChevronsLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              onClick={() => handlePageChange(paginationModel.page - 1)}
              disabled={paginationModel.page === 0}
              className={`relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium ${
                paginationModel.page === 0
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span className="sr-only">Previous</span>
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
              {paginationModel.page + 1} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(paginationModel.page + 1)}
              disabled={paginationModel.page >= totalPages - 1}
              className={`relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium ${
                paginationModel.page >= totalPages - 1
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span className="sr-only">Next</span>
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages - 1)}
              disabled={paginationModel.page >= totalPages - 1}
              className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                paginationModel.page >= totalPages - 1
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span className="sr-only">Last</span>
              <ChevronsRightIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table; 
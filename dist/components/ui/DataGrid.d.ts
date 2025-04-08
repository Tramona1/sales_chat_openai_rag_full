import React from 'react';
interface Column {
    field: string;
    headerName: string;
    width?: number;
    flex?: number;
    renderCell?: (params: {
        row: any;
        value: any;
    }) => React.ReactNode;
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
declare const DataGrid: React.FC<DataGridProps>;
export default DataGrid;

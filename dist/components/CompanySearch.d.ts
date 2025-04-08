import React from 'react';
interface CompanySearchProps {
    companyName: string;
    onChange: (value: string) => void;
    onSearch: () => void;
    isSearching: boolean;
    error?: string;
    darkMode?: boolean;
}
declare const CompanySearch: React.FC<CompanySearchProps>;
export default CompanySearch;

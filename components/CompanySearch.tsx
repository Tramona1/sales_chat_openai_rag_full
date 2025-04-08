import React from 'react';

interface CompanySearchProps {
  companyName: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  error?: string;
  darkMode?: boolean;
}

const CompanySearch: React.FC<CompanySearchProps> = ({
  companyName,
  onChange,
  onSearch,
  isSearching,
  error,
  darkMode = false
}) => {
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch();
  };

  // Handle pressing Enter key in input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch();
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex flex-col space-y-2">
          <label htmlFor="company-name" className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Company Name
          </label>
          <div className="flex">
            <input
              id="company-name"
              type="text"
              className={`flex-grow px-4 py-2 border ${
                darkMode 
                  ? 'bg-[#3e3f4b] border-gray-600 text-white focus:ring-blue-500 focus:border-blue-500' 
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              } rounded-l-lg`}
              placeholder="Enter company name..."
              value={companyName}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSearching}
            />
            <button
              type="submit"
              className={`px-4 py-2 rounded-r-lg text-white ${
                isSearching
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              disabled={isSearching}
            >
              {isSearching ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Searching...
                </span>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className={`p-3 ${darkMode ? 'bg-red-900/50 border-red-800 text-red-200' : 'bg-red-50 border-red-200 text-red-600'} border rounded-md text-sm mb-4`}>
          {error}
        </div>
      )}

      <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-4`}>
        <p>
          <strong>Tip:</strong> Enter the exact company name for best results. For example, "Starbucks" or "Tesla Motors".
        </p>
        <p className="mt-2">
          <strong>Note:</strong> This will make a real-time search for current company information, which may take a few moments.
        </p>
      </div>
    </div>
  );
};

export default CompanySearch; 
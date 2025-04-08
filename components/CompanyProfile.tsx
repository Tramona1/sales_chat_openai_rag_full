import React from 'react';

interface CompanyProfileProps {
  company: {
    name: string;
    industry?: string;
    size?: string;
    location?: string;
    website?: string;
    founded?: string;
    lastUpdated: Date;
  };
  onReset: () => void;
}

const CompanyProfile: React.FC<CompanyProfileProps> = ({ company, onReset }) => {
  const { name, industry, size, location, website, founded, lastUpdated } = company;
  
  // Format the last updated timestamp
  const formattedLastUpdated = new Date(lastUpdated).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-700 text-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">{name}</h2>
          {industry && <p className="text-blue-100">{industry}</p>}
        </div>
        <button
          onClick={onReset}
          className="px-3 py-1 bg-blue-800 hover:bg-blue-900 rounded-md text-sm"
          title="Search for a different company"
        >
          New Search
        </button>
      </div>
      
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {size && (
            <div className="flex items-start">
              <div className="mr-2 text-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Company Size</h3>
                <p className="text-gray-900">{size}</p>
              </div>
            </div>
          )}
          
          {location && (
            <div className="flex items-start">
              <div className="mr-2 text-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Location</h3>
                <p className="text-gray-900">{location}</p>
              </div>
            </div>
          )}
          
          {founded && (
            <div className="flex items-start">
              <div className="mr-2 text-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Founded</h3>
                <p className="text-gray-900">{founded}</p>
              </div>
            </div>
          )}
          
          {website && (
            <div className="flex items-start">
              <div className="mr-2 text-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Website</h3>
                <a 
                  href={website.startsWith('http') ? website : `https://${website}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {website}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 border-t">
        <p>Information last updated: {formattedLastUpdated}</p>
      </div>
    </div>
  );
};

export default CompanyProfile; 
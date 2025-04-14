import React, { useState } from 'react';
const TagFilterPanel = ({ availableTags, selectedTags, onTagSelect, onTagDeselect, onClearFilters }) => {
    // Group tags by type
    const topicTags = availableTags.filter(tag => tag.type === 'topic');
    const audienceTags = availableTags.filter(tag => tag.type === 'audience');
    const entityTags = availableTags.filter(tag => tag.type === 'entity');
    const technicalTags = availableTags.filter(tag => tag.type === 'technical');
    // State for expanded sections
    const [expandedSections, setExpandedSections] = useState({
        topics: true,
        audience: true,
        entities: true,
        technical: true
    });
    // Toggle section expansion
    const toggleSection = (section) => {
        setExpandedSections({
            ...expandedSections,
            [section]: !expandedSections[section]
        });
    };
    // Handle tag click
    const handleTagClick = (tag) => {
        if (selectedTags.includes(tag)) {
            onTagDeselect(tag);
        }
        else {
            onTagSelect(tag);
        }
    };
    return (<div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Filters</h3>
        {selectedTags.length > 0 && (<button onClick={onClearFilters} className="text-sm text-blue-600 hover:text-blue-800">
            Clear all
          </button>)}
      </div>
      
      {/* Show selected tags at the top if any */}
      {selectedTags.length > 0 && (<div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Selected filters:</p>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map(tag => (<span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 cursor-pointer" onClick={() => onTagDeselect(tag)}>
                {tag}
                <svg className="ml-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </span>))}
          </div>
        </div>)}
      
      {/* Topics section */}
      {topicTags.length > 0 && (<div className="mb-4">
          <button className="flex w-full justify-between items-center text-sm font-medium text-gray-900 py-2" onClick={() => toggleSection('topics')}>
            Topics
            <svg className={`h-5 w-5 transform ${expandedSections.topics ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          
          {expandedSections.topics && (<div className="mt-2 flex flex-wrap gap-2">
              {topicTags.map(tag => (<span key={tag.value} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer ${selectedTags.includes(tag.value)
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`} onClick={() => handleTagClick(tag.value)}>
                  {tag.value}
                  {tag.count !== undefined && <span className="ml-1 text-xs">({tag.count})</span>}
                </span>))}
            </div>)}
        </div>)}
      
      {/* Audience section */}
      {audienceTags.length > 0 && (<div className="mb-4">
          <button className="flex w-full justify-between items-center text-sm font-medium text-gray-900 py-2" onClick={() => toggleSection('audience')}>
            Audience
            <svg className={`h-5 w-5 transform ${expandedSections.audience ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          
          {expandedSections.audience && (<div className="mt-2 flex flex-wrap gap-2">
              {audienceTags.map(tag => (<span key={tag.value} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer ${selectedTags.includes(tag.value)
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`} onClick={() => handleTagClick(tag.value)}>
                  {tag.value}
                  {tag.count !== undefined && <span className="ml-1 text-xs">({tag.count})</span>}
                </span>))}
            </div>)}
        </div>)}
      
      {/* Entities section */}
      {entityTags.length > 0 && (<div className="mb-4">
          <button className="flex w-full justify-between items-center text-sm font-medium text-gray-900 py-2" onClick={() => toggleSection('entities')}>
            Mentioned Companies/Products
            <svg className={`h-5 w-5 transform ${expandedSections.entities ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          
          {expandedSections.entities && (<div className="mt-2 flex flex-wrap gap-2">
              {entityTags.map(tag => (<span key={tag.value} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer ${selectedTags.includes(tag.value)
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`} onClick={() => handleTagClick(tag.value)}>
                  {tag.value}
                  {tag.count !== undefined && <span className="ml-1 text-xs">({tag.count})</span>}
                </span>))}
            </div>)}
        </div>)}
      
      {/* Technical level section */}
      {technicalTags.length > 0 && (<div className="mb-4">
          <button className="flex w-full justify-between items-center text-sm font-medium text-gray-900 py-2" onClick={() => toggleSection('technical')}>
            Technical Level
            <svg className={`h-5 w-5 transform ${expandedSections.technical ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          
          {expandedSections.technical && (<div className="mt-2 flex flex-wrap gap-2">
              {technicalTags.map(tag => (<span key={tag.value} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer ${selectedTags.includes(tag.value)
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`} onClick={() => handleTagClick(tag.value)}>
                  {tag.value}
                  {tag.count !== undefined && <span className="ml-1 text-xs">({tag.count})</span>}
                </span>))}
            </div>)}
        </div>)}
    </div>);
};
export default TagFilterPanel;

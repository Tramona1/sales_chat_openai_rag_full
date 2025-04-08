import React, { useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';

/**
 * This page has been deprecated in favor of integrating hierarchical search directly
 * into the hybrid search system. It now redirects to the main chat page.
 */
const HierarchicalSearchPage: NextPage = () => {
  const router = useRouter();

  // Redirect to the chat page
  useEffect(() => {
    router.replace('/chat');
  }, [router]);

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <p className="text-gray-600">Redirecting to Chat...</p>
        <p className="text-sm text-gray-500 mt-2">
          The hierarchical search capabilities have been integrated into the main search system.
        </p>
      </div>
    </div>
  );
};

export default HierarchicalSearchPage; 
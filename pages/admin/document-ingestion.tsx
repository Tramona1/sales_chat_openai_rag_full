import React, { useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';

const DocumentIngestionPage: NextPage = () => {
  const router = useRouter();

  // Redirect to the pending documents page
  useEffect(() => {
    router.replace('/admin/pending-documents');
  }, [router]);

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <p className="text-gray-600">Redirecting to Pending Documents...</p>
      </div>
    </div>
  );
};

export default DocumentIngestionPage; 
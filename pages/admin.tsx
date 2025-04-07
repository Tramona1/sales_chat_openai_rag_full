import React, { useState } from 'react';
import { GetServerSideProps } from 'next';
import fs from 'fs';
import path from 'path';
import { FeedbackLog } from '../types/feedback';
import Layout from '../components/Layout';
import { Search, Calendar, User, MessageSquare, Download, Layers } from 'lucide-react';
import SystemMetrics from '../components/SystemMetrics';
import DocumentManager from '../components/DocumentManager';

interface AdminProps {
  logs: FeedbackLog[];
}

export const getServerSideProps: GetServerSideProps = async () => {
  const logPath = path.join(process.cwd(), 'feedback.json');
  let logs: FeedbackLog[] = [];
  
  if (fs.existsSync(logPath)) {
    try {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      // Sort logs by timestamp, newest first
      logs.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error parsing logs:', error);
    }
  }
  
  return { props: { logs } };
};

export default function Admin({ logs }: AdminProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'metrics' | 'documents' | 'feedback'>('metrics');
  
  const filteredLogs = logs.filter(log => 
    log.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.response.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.sender.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Function to export logs as JSON
  const exportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `sales_assistant_logs_${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <Layout title="Admin Dashboard">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          
          {activeTab === 'feedback' && (
            <div className="flex gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search logs..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <button
                onClick={exportLogs}
                className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 transition"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`${
                activeTab === 'metrics'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Layers className="h-5 w-5 mr-2" />
              System Metrics
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`${
                activeTab === 'documents'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              Document Management
            </button>
            <button
              onClick={() => setActiveTab('feedback')}
              className={`${
                activeTab === 'feedback'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <User className="h-5 w-5 mr-2" />
              Feedback Logs
            </button>
          </nav>
        </div>
        
        {/* Tab content */}
        <div className="space-y-6">
          {activeTab === 'metrics' && (
            <SystemMetrics refreshInterval={30000} />
          )}
          
          {activeTab === 'documents' && (
            <DocumentManager limit={100} />
          )}
          
          {activeTab === 'feedback' && (
            <>
              {filteredLogs.length === 0 && (
                <div className="bg-white rounded-lg shadow p-6 text-center">
                  <p className="text-gray-500">
                    {logs.length === 0 ? 'No logs available yet.' : 'No logs match your search.'}
                  </p>
                </div>
              )}
              
              <div className="space-y-4">
                {filteredLogs.map((log, idx) => (
                  <div key={idx} className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center bg-gray-50">
                      <div className="flex items-center flex-1">
                        <User className="h-4 w-4 text-primary-600 mr-2" />
                        <span className="font-medium text-gray-700">{log.sender}</span>
                      </div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="p-4 space-y-3">
                      <div className="flex items-start">
                        <div className="mt-1 mr-3">
                          <div className="bg-primary-100 text-primary-800 p-1 rounded-full">
                            <MessageSquare className="h-4 w-4" />
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 mb-1">Question</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{log.text}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="mt-1 mr-3">
                          <div className="bg-gray-100 text-gray-800 p-1 rounded-full">
                            <MessageSquare className="h-4 w-4" />
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 mb-1">Response</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{log.response}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
} 
import React from 'react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import Layout from '@/components/Layout';
import { 
  MessageSquare, 
  Shield, 
  DollarSign, 
  Users, 
  BarChart, 
  Zap, 
  Upload, 
  X, 
  BookOpen,
  Trophy,
  Briefcase,
  CheckCircle,
  Clock,
  FileSearch,
  Star,
  PieChart,
  Search,
  Send
} from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import DirectTextInput from '@/components/DirectTextInput';

// Product Suite information
const productSuite = [
  {
    name: "Applicant Tracking",
    description: "Streamline your hiring process with automated tracking and screening",
    icon: <FileSearch className="h-6 w-6 text-primary-600" />
  },
  {
    name: "Onboarding",
    description: "Digital onboarding with automated workflows and document management",
    icon: <CheckCircle className="h-6 w-6 text-primary-600" />
  },
  {
    name: "Scheduling",
    description: "AI-powered scheduling system to optimize workforce management",
    icon: <Clock className="h-6 w-6 text-primary-600" />
  },
  {
    name: "Analytics",
    description: "Real-time reporting and insights to measure performance metrics",
    icon: <PieChart className="h-6 w-6 text-primary-600" />
  }
];

// Template categories with pre-defined questions
const templates = [
  {
    category: 'Pricing & Packages',
    icon: <DollarSign className="h-6 w-6 text-primary-600" />,
    color: 'bg-neutral-50 border-neutral-200',
    iconColor: 'bg-white',
    questions: [
      'What are our current pricing tiers?',
      'How does our enterprise pricing work?',
      'What discounts can we offer for annual commitments?',
      'How does our pricing compare to competitors?'
    ]
  },
  {
    category: 'Product Features',
    icon: <Zap className="h-6 w-6 text-primary-600" />,
    color: 'bg-neutral-50 border-neutral-200',
    iconColor: 'bg-white',
    questions: [
      'What are our most popular features?',
      'What new features were launched this quarter?',
      'How does our platform integrate with other systems?',
      'What features set us apart from our competitors?'
    ]
  },
  {
    category: 'Objection Handling',
    icon: <Shield className="h-6 w-6 text-primary-600" />,
    color: 'bg-neutral-50 border-neutral-200',
    iconColor: 'bg-white',
    questions: [
      'How to respond when a client says our price is too high?',
      'What to say when prospects mention our competitor?',
      'How to handle security and compliance concerns?',
      'What if they say they need to think about it?'
    ]
  },
  {
    category: 'Success Stories',
    icon: <Trophy className="h-6 w-6 text-primary-600" />,
    color: 'bg-neutral-50 border-neutral-200',
    iconColor: 'bg-white',
    questions: [
      'What ROI have our clients seen?',
      'Do we have case studies for the retail industry?',
      'Share our biggest customer success story',
      'What testimonials can I share during presentations?'
    ]
  },
  {
    category: 'Market & Competitors',
    icon: <BarChart className="h-6 w-6 text-primary-600" />,
    color: 'bg-neutral-50 border-neutral-200',
    iconColor: 'bg-white',
    questions: [
      'Who are our main competitors?',
      'What is our market share in this industry?',
      'How has the market evolved in the past year?',
      'What are our competitive advantages?'
    ]
  },
  {
    category: 'Technical Details',
    icon: <BookOpen className="h-6 w-6 text-primary-600" />,
    color: 'bg-neutral-50 border-neutral-200',
    iconColor: 'bg-white',
    questions: [
      'What is our uptime guarantee?',
      'How do we handle data security?',
      'What API capabilities do we offer?',
      'How does our implementation process work?'
    ]
  }
];

// Frequently asked sales questions
const salesFaqs = [
  'Who are our investors and how much funding have we raised?',
  'What industries do we specialize in?',
  'What is our company mission and vision?',
  'How many customers do we currently have?',
  'What is our customer retention rate?',
  'Who are our strategic partners?',
  'What certifications and compliance standards do we meet?',
  'What is our current growth trajectory?'
];

export default function Home() {
  const router = useRouter();
  const [showTrainPanel, setShowTrainPanel] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(true);
  const [showTextInput, setShowTextInput] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showProductInfo, setShowProductInfo] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Navigate to chat with a specific question
  const startChatWithQuestion = (question: string) => {
    // Add a short delay to prevent potential double executions
    // which could be happening due to event bubbling or multiple click handlers
    setTimeout(() => {
      router.push({
        pathname: '/chat',
        query: { 
          question,
          autoResponse: 'true'  // This flag indicates the AI should be shown as responding
        }
      });
    }, 50);
  };

  // Handle chat input submission
  const handleChatInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      startChatWithQuestion(chatInput);
    }
  };

  // Navigate to empty chat
  const startNewChat = () => {
    router.push('/chat');
  };

  const handleUploadComplete = (message: string) => {
    setMessage(message);
    setTimeout(() => setMessage(null), 5000); // Clear message after 5 seconds
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Quick chat input bar */}
        <div className="my-6">
          <form onSubmit={handleChatInputSubmit} className="relative max-w-3xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask anything about our products, pricing, or competitors..."
                className="w-full py-3 pl-12 pr-16 rounded-full border border-neutral-300 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
              />
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-neutral-400" />
              </div>
              <button 
                type="submit" 
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-primary-600 hover:text-primary-800"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </form>
        </div>

        {/* Main hero section */}
        <div className="text-center mb-16 mt-8">
          <h1 className="text-4xl font-bold text-neutral-900 mb-6">
            Workstream Knowledge Assistant
          </h1>
          <p className="text-xl text-neutral-600 max-w-3xl mx-auto leading-relaxed">
            Access all your sales knowledge instantly. Get answers about products, pricing, 
            competitors, and more to close deals faster.
          </p>
          
          {/* Action buttons */}
          <div className="flex flex-wrap gap-4 justify-center mt-10">
            <button 
              onClick={startNewChat} 
              className="flex items-center px-8 py-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition shadow-lg text-lg font-medium transform hover:scale-105"
            >
              <MessageSquare className="mr-2 h-5 w-5" />
              Start New Chat
            </button>
            
            <button 
              onClick={() => router.push('/company-chat')} 
              className="flex items-center px-6 py-4 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition shadow-md"
            >
              <Briefcase className="mr-2 h-5 w-5" />
              Company Chat
            </button>
            
            <button 
              onClick={() => setShowTrainPanel(!showTrainPanel)}
              className="flex items-center px-6 py-4 bg-white text-neutral-800 rounded-lg hover:bg-neutral-50 transition border border-neutral-300 shadow-sm"
            >
              <Upload className="mr-2 h-5 w-5 text-primary-600" />
              Train Assistant
            </button>
            
            <button 
              onClick={() => setShowProductInfo(!showProductInfo)}
              className="flex items-center px-6 py-4 bg-neutral-50 text-neutral-800 rounded-lg hover:bg-neutral-100 transition border border-neutral-200 shadow-sm"
            >
              <Briefcase className="mr-2 h-5 w-5 text-primary-600" />
              Product Suite Info
            </button>
          </div>
          
          {/* Success message */}
          {message && (
            <div className="mt-8 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200 shadow-sm relative max-w-2xl mx-auto">
              <button 
                onClick={() => setMessage(null)}
                className="absolute top-2 right-2 text-green-500 hover:text-green-700"
              >
                <X className="h-4 w-4" />
              </button>
              <p>{message}</p>
            </div>
          )}
          
          {/* Training panel */}
          {showTrainPanel && (
            <div className="mt-8 max-w-2xl mx-auto bg-white p-6 rounded-xl border border-neutral-200 shadow-card">
              <div className="flex justify-between mb-4">
                <h2 className="text-xl font-semibold text-neutral-800">Add Training Data</h2>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setShowFileUpload(true);
                      setShowTextInput(false);
                    }}
                    className={`text-sm px-3 py-1 rounded-md ${
                      showFileUpload 
                        ? 'bg-primary-100 text-primary-700' 
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    Upload Files
                  </button>
                  <button 
                    onClick={() => {
                      setShowFileUpload(false);
                      setShowTextInput(true);
                    }}
                    className={`text-sm px-3 py-1 rounded-md ${
                      showTextInput 
                        ? 'bg-primary-100 text-primary-700' 
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    Enter Text
                  </button>
                </div>
              </div>
              
              <div className="mt-4">
                {showFileUpload && (
                  <FileUpload onUploadComplete={handleUploadComplete} />
                )}
                
                {showTextInput && (
                  <DirectTextInput onUploadComplete={handleUploadComplete} />
                )}
              </div>
            </div>
          )}
          
          {/* Product information */}
          {showProductInfo && (
            <div className="mt-8 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-neutral-800 mb-6">Our Product Suite</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {productSuite.map((product, index) => (
                  <div 
                    key={index} 
                    className="bg-white p-6 rounded-xl border border-neutral-200 shadow-card hover:shadow-card-hover transition flex items-start space-x-4"
                  >
                    <div className="bg-primary-50 p-3 rounded-lg">
                      {product.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-800">{product.name}</h3>
                      <p className="text-neutral-600 mt-1">{product.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Quick Answer Templates */}
        <div className="mb-16">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-neutral-800">Quick Answer Templates</h2>
            <a href="#" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View all questions
            </a>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {templates.map((template, index) => (
              <div key={index} className={`${template.color} rounded-xl border overflow-hidden shadow-card hover:shadow-card-hover transition-shadow`}>
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className={`${template.iconColor} p-3 rounded-lg shadow-sm`}>
                      {template.icon}
                    </div>
                    <h3 className="ml-3 text-lg font-semibold text-neutral-800">{template.category}</h3>
                  </div>
                  <ul className="space-y-3">
                    {template.questions.map((question, qIndex) => (
                      <li key={qIndex}>
                        <button
                          onClick={() => startChatWithQuestion(question)}
                          className="text-left w-full py-2 px-3 rounded-lg hover:bg-neutral-100 text-neutral-700 flex items-start"
                        >
                          <Star className="h-5 w-5 text-primary-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>{question}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Frequently Asked Questions */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-neutral-800 mb-6">Frequently Asked Questions</h2>
          <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {salesFaqs.map((faq, index) => (
                <button
                  key={index}
                  onClick={() => startChatWithQuestion(faq)}
                  className="text-left py-3 px-4 rounded-lg hover:bg-primary-50 text-neutral-700 border border-neutral-200 hover:border-primary-200 transition"
                >
                  {faq}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
} 
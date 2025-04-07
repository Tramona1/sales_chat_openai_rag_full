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
  PieChart
} from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import DirectTextInput from '@/components/DirectTextInput';

// Product Suite information
const productSuite = [
  {
    name: "Applicant Tracking",
    description: "Streamline your hiring process with automated tracking and screening",
    icon: <FileSearch className="h-6 w-6 text-indigo-600" />
  },
  {
    name: "Onboarding",
    description: "Digital onboarding with automated workflows and document management",
    icon: <CheckCircle className="h-6 w-6 text-emerald-600" />
  },
  {
    name: "Scheduling",
    description: "AI-powered scheduling system to optimize workforce management",
    icon: <Clock className="h-6 w-6 text-amber-600" />
  },
  {
    name: "Analytics",
    description: "Real-time reporting and insights to measure performance metrics",
    icon: <PieChart className="h-6 w-6 text-blue-600" />
  }
];

// Template categories with pre-defined questions
const templates = [
  {
    category: 'Pricing & Packages',
    icon: <DollarSign className="h-6 w-6 text-primary-600" />,
    color: 'bg-gray-50 border-gray-200',
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
    color: 'bg-gray-50 border-gray-200',
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
    color: 'bg-gray-50 border-gray-200',
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
    color: 'bg-gray-50 border-gray-200',
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
    color: 'bg-gray-50 border-gray-200',
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
    color: 'bg-gray-50 border-gray-200',
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

  // Navigate to chat with a specific question
  const startChatWithQuestion = (question: string) => {
    router.push({
      pathname: '/chat',
      query: { 
        question,
        autoResponse: 'true'  // This flag indicates the AI should be shown as responding
      }
    });
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Main hero section */}
        <div className="text-center mb-12 mt-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            Sales Knowledge Assistant
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Access all your sales knowledge instantly. Get answers about products, pricing, 
            competitors, and more to close deals faster.
          </p>
          
          {/* Action buttons */}
          <div className="flex flex-wrap gap-4 justify-center mt-8">
            <button 
              onClick={startNewChat} 
              className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition shadow-sm"
            >
              <MessageSquare className="mr-2 h-5 w-5" />
              Start New Chat
            </button>
            
            <button 
              onClick={() => setShowTrainPanel(!showTrainPanel)}
              className="flex items-center px-6 py-3 bg-white text-gray-800 rounded-lg hover:bg-gray-50 transition border border-gray-300 shadow-sm"
            >
              <Upload className="mr-2 h-5 w-5" />
              Train Assistant
            </button>
            
            <button 
              onClick={() => setShowProductInfo(!showProductInfo)}
              className="flex items-center px-6 py-3 bg-gray-50 text-gray-800 rounded-lg hover:bg-gray-100 transition border border-gray-200 shadow-sm"
            >
              <Briefcase className="mr-2 h-5 w-5" />
              Product Suite Info
            </button>
          </div>
          
          {/* Success message */}
          {message && (
            <div className="mt-6 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200 shadow-sm relative max-w-2xl mx-auto">
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
            <div className="mt-6 max-w-2xl mx-auto bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Add Training Data</h2>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setShowFileUpload(true);
                      setShowTextInput(false);
                    }}
                    className={`text-sm px-3 py-1 rounded-md ${
                      showFileUpload 
                        ? 'bg-primary-100 text-primary-700' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Paste Text
                  </button>
                </div>
              </div>
              
              {showFileUpload && <FileUpload onUploadComplete={handleUploadComplete} />}
              {showTextInput && <DirectTextInput onUploadComplete={handleUploadComplete} />}
            </div>
          )}
          
          {/* Product Suite information */}
          {showProductInfo && (
            <div className="mt-6 max-w-4xl mx-auto bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Our Product Suite</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {productSuite.map((product, index) => (
                  <div key={index} className="flex gap-4 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                    <div className="flex-shrink-0 p-2 bg-gray-50 rounded-lg">
                      {product.icon}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{product.name}</h3>
                      <p className="text-gray-600 text-sm mt-1">{product.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <button
                  onClick={() => startChatWithQuestion("Tell me about our full product suite and how the components work together")}
                  className="text-primary-600 hover:text-primary-800 font-medium inline-flex items-center"
                >
                  <span>Ask for detailed product information</span>
                  <MessageSquare className="ml-2 h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Quick Answer Templates section */}
        <div className="mb-14">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Quick Answer Templates
            </h2>
            <button 
              onClick={() => startChatWithQuestion("What are the most common questions prospects ask about our offerings?")}
              className="text-primary-600 hover:text-primary-800 text-sm font-medium"
            >
              View all questions
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template, index) => (
              <div key={index} className={`rounded-xl border ${template.color} p-5 transition hover:shadow-md`}>
                <div className="flex items-center mb-4">
                  <div className={`p-2 rounded-lg ${template.iconColor} mr-3 border border-gray-100`}>
                    {template.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {template.category}
                  </h3>
                </div>
                
                <ul className="space-y-2 mt-3">
                  {template.questions.map((question, qIndex) => (
                    <li key={qIndex}>
                      <button
                        onClick={() => startChatWithQuestion(question)}
                        className="w-full text-left flex items-center p-2 rounded-lg hover:bg-white text-gray-700 transition border border-transparent hover:border-gray-200"
                      >
                        <Star className="h-4 w-4 text-primary-500 mr-2 flex-shrink-0" />
                        <span className="text-sm">{question}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        
        {/* Company Information & FAQs */}
        <div className="mb-16 bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Company Knowledge</h2>
            <button 
              onClick={() => startChatWithQuestion("Give me a company overview with key metrics and recent achievements")}
              className="text-primary-600 hover:text-primary-800 text-sm font-medium"
            >
              Full company overview
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {salesFaqs.slice(0, 4).map((question, index) => (
              <button
                key={index}
                onClick={() => startChatWithQuestion(question)}
                className="flex flex-col justify-between h-full bg-gray-50 hover:bg-gray-100 p-4 rounded-lg border border-gray-200 transition shadow-sm hover:shadow"
              >
                <p className="text-gray-800 text-sm font-medium">{question}</p>
                <div className="flex justify-end mt-2">
                  <MessageSquare className="h-4 w-4 text-primary-500" />
                </div>
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {salesFaqs.slice(4).map((question, index) => (
              <button
                key={index}
                onClick={() => startChatWithQuestion(question)}
                className="flex flex-col justify-between h-full bg-gray-50 hover:bg-gray-100 p-4 rounded-lg border border-gray-200 transition shadow-sm hover:shadow"
              >
                <p className="text-gray-800 text-sm font-medium">{question}</p>
                <div className="flex justify-end mt-2">
                  <MessageSquare className="h-4 w-4 text-primary-500" />
                </div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Instructions section */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            How to Use the Assistant
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-primary-600">1</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a Conversation</h3>
              <p className="text-gray-600">Click "Start New Chat" or choose one of the template questions to begin a conversation.</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-primary-600">2</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ask Questions</h3>
              <p className="text-gray-600">Ask any question about products, pricing, competitors, or company information in natural language.</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-primary-600">3</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Get Instant Answers</h3>
              <p className="text-gray-600">Receive accurate responses based on your company's knowledge base to help close deals faster.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
} 
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPLEX_QUERIES = exports.MEDIUM_QUERIES = exports.SIMPLE_QUERIES = exports.GENERAL_QUERIES = exports.TECHNICAL_QUERIES = exports.COMPETITOR_QUERIES = exports.FEATURE_QUERIES = exports.PRICING_QUERIES = exports.TEST_QUERIES = void 0;
/**
 * Comprehensive test set for RAG system evaluation
 * Categories: pricing, features, competitors, technical, general
 * Complexity: 1 (simple) to 3 (complex)
 */
exports.TEST_QUERIES = [
    // PRICING QUERIES (15)
    {
        query: "What is the price of the basic plan?",
        expectedKeywords: ["basic plan", "price", "monthly", "cost"],
        category: "pricing",
        complexity: 1
    },
    {
        query: "How much does the enterprise solution cost?",
        expectedKeywords: ["enterprise", "price", "cost", "billing"],
        category: "pricing",
        complexity: 1
    },
    {
        query: "What's included in the premium tier?",
        expectedKeywords: ["premium", "tier", "features", "includes"],
        category: "pricing",
        complexity: 1
    },
    {
        query: "Do you offer volume discounts for more than 100 users?",
        expectedKeywords: ["volume", "discount", "bulk", "users", "100"],
        category: "pricing",
        complexity: 2
    },
    {
        query: "What's the difference in pricing between the standard and professional plans?",
        expectedKeywords: ["standard", "professional", "difference", "comparison", "pricing"],
        category: "pricing",
        complexity: 2
    },
    {
        query: "Is there an annual discount if we pay upfront?",
        expectedKeywords: ["annual", "discount", "upfront", "payment", "yearly"],
        category: "pricing",
        complexity: 1
    },
    {
        query: "How does your pricing compare to Competitor X?",
        expectedKeywords: ["competitor x", "pricing", "compare", "difference", "cheaper", "expensive"],
        category: "pricing",
        complexity: 2
    },
    {
        query: "If we upgrade from basic to professional mid-contract, how is the billing prorated?",
        expectedKeywords: ["upgrade", "mid-contract", "prorate", "billing", "basic", "professional"],
        category: "pricing",
        complexity: 3
    },
    {
        query: "What would be the total cost for our team of 75 people using the premium features?",
        expectedKeywords: ["team", "premium", "features", "total cost", "75 people"],
        category: "pricing",
        complexity: 2
    },
    {
        query: "Are there any hidden fees we should know about?",
        expectedKeywords: ["hidden fees", "additional costs", "extra charges"],
        category: "pricing",
        complexity: 1
    },
    {
        query: "If we need custom features, how does that affect pricing?",
        expectedKeywords: ["custom features", "customization", "additional cost", "pricing", "affects"],
        category: "pricing",
        complexity: 2
    },
    {
        query: "What's your refund policy if we're not satisfied?",
        expectedKeywords: ["refund", "policy", "satisfaction guarantee", "money back"],
        category: "pricing",
        complexity: 1
    },
    {
        query: "Can you break down all costs associated with implementation, including training and support?",
        expectedKeywords: ["implementation", "costs", "training", "support", "breakdown", "fees"],
        category: "pricing",
        complexity: 3
    },
    {
        query: "Do you offer any non-profit or educational discounts?",
        expectedKeywords: ["non-profit", "educational", "discount", "special pricing"],
        category: "pricing",
        complexity: 1
    },
    {
        query: "What's the ROI calculation for businesses similar to ours that have implemented your solution?",
        expectedKeywords: ["ROI", "calculation", "return on investment", "similar businesses", "implementation"],
        category: "pricing",
        complexity: 3
    },
    // FEATURE QUERIES (15)
    {
        query: "What are the main features of your product?",
        expectedKeywords: ["main features", "key features", "product", "capabilities"],
        category: "features",
        complexity: 1
    },
    {
        query: "Does your platform offer multi-user collaboration?",
        expectedKeywords: ["multi-user", "collaboration", "team", "sharing"],
        category: "features",
        complexity: 1
    },
    {
        query: "How secure is your data storage?",
        expectedKeywords: ["security", "data storage", "encryption", "protection"],
        category: "features",
        complexity: 1
    },
    {
        query: "Can your system integrate with our existing CRM?",
        expectedKeywords: ["integration", "CRM", "connect", "existing systems"],
        category: "features",
        complexity: 2
    },
    {
        query: "What reporting capabilities does your platform provide?",
        expectedKeywords: ["reporting", "analytics", "insights", "dashboards", "capabilities"],
        category: "features",
        complexity: 2
    },
    {
        query: "Do you have a mobile application?",
        expectedKeywords: ["mobile", "app", "iOS", "Android", "smartphone"],
        category: "features",
        complexity: 1
    },
    {
        query: "What kind of customer support do you offer?",
        expectedKeywords: ["customer support", "help", "service", "assistance", "contact"],
        category: "features",
        complexity: 1
    },
    {
        query: "How does your AI feature help predict customer behavior?",
        expectedKeywords: ["AI", "artificial intelligence", "predict", "customer behavior", "machine learning"],
        category: "features",
        complexity: 2
    },
    {
        query: "Can we customize the workflow to match our specific processes?",
        expectedKeywords: ["customize", "workflow", "specific processes", "tailor", "adaptation"],
        category: "features",
        complexity: 2
    },
    {
        query: "What kind of data migration support do you provide when onboarding?",
        expectedKeywords: ["data migration", "onboarding", "support", "transfer", "importing"],
        category: "features",
        complexity: 2
    },
    {
        query: "How does your solution maintain GDPR compliance for European customers?",
        expectedKeywords: ["GDPR", "compliance", "European", "data protection", "privacy"],
        category: "features",
        complexity: 3
    },
    {
        query: "Can the platform handle multiple languages for our global team?",
        expectedKeywords: ["multiple languages", "global", "localization", "international", "translation"],
        category: "features",
        complexity: 2
    },
    {
        query: "What are the limitations of the API in terms of rate limits and functionality?",
        expectedKeywords: ["API", "rate limits", "limitations", "functionality", "integration"],
        category: "features",
        complexity: 3
    },
    {
        query: "How does the backup and disaster recovery system work?",
        expectedKeywords: ["backup", "disaster recovery", "data protection", "recovery time"],
        category: "features",
        complexity: 2
    },
    {
        query: "Can you explain the workflow automation features in detail, including conditional logic capabilities?",
        expectedKeywords: ["workflow automation", "conditional logic", "triggers", "actions", "rules"],
        category: "features",
        complexity: 3
    },
    // COMPETITOR QUERIES (10)
    {
        query: "How do you compare to Competitor X?",
        expectedKeywords: ["competitor x", "compare", "difference", "advantage"],
        category: "competitors",
        complexity: 1
    },
    {
        query: "What makes your solution better than Competitor Y's offering?",
        expectedKeywords: ["competitor y", "better", "advantage", "difference", "superior"],
        category: "competitors",
        complexity: 2
    },
    {
        query: "We're currently using Competitor Z. Why should we switch to your platform?",
        expectedKeywords: ["competitor z", "switch", "migrate", "benefits", "advantage"],
        category: "competitors",
        complexity: 2
    },
    {
        query: "How does your pricing model differ from Competitor X?",
        expectedKeywords: ["competitor x", "pricing model", "difference", "cost comparison"],
        category: "competitors",
        complexity: 2
    },
    {
        query: "Do you have features that Competitor Y doesn't offer?",
        expectedKeywords: ["competitor y", "unique features", "exclusive", "missing"],
        category: "competitors",
        complexity: 2
    },
    {
        query: "We're considering both your solution and Competitor Z. Can you provide a detailed comparison?",
        expectedKeywords: ["competitor z", "detailed comparison", "differences", "advantages", "disadvantages"],
        category: "competitors",
        complexity: 3
    },
    {
        query: "How does your customer support compare to Competitor X's?",
        expectedKeywords: ["competitor x", "customer support", "service", "comparison", "response time"],
        category: "competitors",
        complexity: 2
    },
    {
        query: "Is your platform more user-friendly than Competitor Y?",
        expectedKeywords: ["competitor y", "user-friendly", "ease of use", "interface", "learning curve"],
        category: "competitors",
        complexity: 2
    },
    {
        query: "Can you explain why your security measures are more robust than Competitor Z's?",
        expectedKeywords: ["competitor z", "security measures", "robust", "data protection", "encryption"],
        category: "competitors",
        complexity: 3
    },
    {
        query: "How does your roadmap for future features compare to what Competitor X has announced?",
        expectedKeywords: ["competitor x", "roadmap", "future features", "development", "upcoming"],
        category: "competitors",
        complexity: 3
    },
    // TECHNICAL QUERIES (5)
    {
        query: "What programming languages does your API support?",
        expectedKeywords: ["programming languages", "API", "support", "integration", "code"],
        category: "technical",
        complexity: 2
    },
    {
        query: "What's your typical server uptime percentage?",
        expectedKeywords: ["server uptime", "percentage", "reliability", "availability", "SLA"],
        category: "technical",
        complexity: 1
    },
    {
        query: "How do you handle load balancing during traffic spikes?",
        expectedKeywords: ["load balancing", "traffic spikes", "scaling", "performance", "infrastructure"],
        category: "technical",
        complexity: 3
    },
    {
        query: "What authentication methods do you support?",
        expectedKeywords: ["authentication", "methods", "OAuth", "SSO", "login", "security"],
        category: "technical",
        complexity: 2
    },
    {
        query: "Can you explain your approach to database sharding and how it affects performance?",
        expectedKeywords: ["database sharding", "performance", "data architecture", "scaling", "approach"],
        category: "technical",
        complexity: 3
    },
    // GENERAL QUERIES (5)
    {
        query: "How long has your company been in business?",
        expectedKeywords: ["company", "business", "founded", "history", "years"],
        category: "general",
        complexity: 1
    },
    {
        query: "Who are some of your biggest clients?",
        expectedKeywords: ["biggest clients", "customers", "references", "case studies"],
        category: "general",
        complexity: 1
    },
    {
        query: "What industries do you primarily serve?",
        expectedKeywords: ["industries", "serve", "focus", "specialization", "sectors"],
        category: "general",
        complexity: 1
    },
    {
        query: "Can you tell me about your company's approach to innovation?",
        expectedKeywords: ["innovation", "approach", "research", "development", "new features"],
        category: "general",
        complexity: 2
    },
    {
        query: "What's your company's mission and how does it influence product development?",
        expectedKeywords: ["mission", "company values", "product development", "influence", "vision"],
        category: "general",
        complexity: 2
    }
];
// Export queries grouped by category for easier testing of specific categories
exports.PRICING_QUERIES = exports.TEST_QUERIES.filter(q => q.category === 'pricing');
exports.FEATURE_QUERIES = exports.TEST_QUERIES.filter(q => q.category === 'features');
exports.COMPETITOR_QUERIES = exports.TEST_QUERIES.filter(q => q.category === 'competitors');
exports.TECHNICAL_QUERIES = exports.TEST_QUERIES.filter(q => q.category === 'technical');
exports.GENERAL_QUERIES = exports.TEST_QUERIES.filter(q => q.category === 'general');
// Export queries grouped by complexity for focused testing
exports.SIMPLE_QUERIES = exports.TEST_QUERIES.filter(q => q.complexity === 1);
exports.MEDIUM_QUERIES = exports.TEST_QUERIES.filter(q => q.complexity === 2);
exports.COMPLEX_QUERIES = exports.TEST_QUERIES.filter(q => q.complexity === 3);

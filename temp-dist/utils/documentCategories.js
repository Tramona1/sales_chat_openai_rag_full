"use strict";
/**
 * Document Categories Definition
 *
 * This module defines the document categories used for classifying content
 * and enabling smart query routing.
 *
 * NOTE: These categories are now aligned with STANDARD_CATEGORIES from tagUtils.ts
 * to ensure consistency across the application. Any changes to categories should be
 * made in both places.
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityType = exports.ConfidenceLevel = exports.QualityControlFlag = exports.CATEGORY_ATTRIBUTES = exports.DocumentCategoryType = void 0;
exports.getAllCategories = getAllCategories;
exports.getStandardCategories = getStandardCategories;
exports.getSensitiveCategories = getSensitiveCategories;
exports.getApprovalRequiredCategories = getApprovalRequiredCategories;
exports.getHighPriorityCategories = getHighPriorityCategories;
exports.getCategoryAttributes = getCategoryAttributes;
exports.mapToStandardCategory = mapToStandardCategory;
exports.requiresHumanReview = requiresHumanReview;
exports.detectCategoryFromText = detectCategoryFromText;
/**
 * Document category types - Aligned with STANDARD_CATEGORIES in tagUtils.ts
 */
var DocumentCategoryType;
(function (DocumentCategoryType) {
    // Primary Categories
    DocumentCategoryType["HIRING"] = "HIRING";
    DocumentCategoryType["ONBOARDING"] = "ONBOARDING";
    DocumentCategoryType["HR_MANAGEMENT"] = "HR_MANAGEMENT";
    DocumentCategoryType["PAYROLL"] = "PAYROLL";
    DocumentCategoryType["COMPLIANCE"] = "COMPLIANCE";
    DocumentCategoryType["SCHEDULING"] = "SCHEDULING";
    DocumentCategoryType["RETENTION"] = "RETENTION";
    DocumentCategoryType["OPTIMIZATION"] = "OPTIMIZATION";
    DocumentCategoryType["AUTOMATION"] = "AUTOMATION";
    DocumentCategoryType["AI_TOOLS"] = "AI_TOOLS";
    DocumentCategoryType["JOB_POSTING"] = "JOB_POSTING";
    DocumentCategoryType["CANDIDATE_SCREENING"] = "CANDIDATE_SCREENING";
    DocumentCategoryType["INTERVIEW_SCHEDULING"] = "INTERVIEW_SCHEDULING";
    DocumentCategoryType["REPORTING"] = "REPORTING";
    DocumentCategoryType["MOBILE_SOLUTIONS"] = "MOBILE_SOLUTIONS";
    DocumentCategoryType["DOCUMENTS"] = "DOCUMENTS";
    DocumentCategoryType["TIME_TRACKING"] = "TIME_TRACKING";
    DocumentCategoryType["TAX_COMPLIANCE"] = "TAX_COMPLIANCE";
    DocumentCategoryType["ENGAGEMENT"] = "ENGAGEMENT";
    DocumentCategoryType["SECURITY_PRIVACY"] = "SECURITY_PRIVACY";
    // Secondary Categories
    DocumentCategoryType["TEXT_TO_APPLY"] = "TEXT_TO_APPLY";
    DocumentCategoryType["TWO_WAY_SMS"] = "TWO_WAY_SMS";
    DocumentCategoryType["BACKGROUND_CHECKS"] = "BACKGROUND_CHECKS";
    DocumentCategoryType["SHIFT_MANAGEMENT"] = "SHIFT_MANAGEMENT";
    DocumentCategoryType["DIGITAL_SIGNATURES"] = "DIGITAL_SIGNATURES";
    DocumentCategoryType["CUSTOMIZABLE_TEMPLATES"] = "CUSTOMIZABLE_TEMPLATES";
    DocumentCategoryType["FRANCHISE_MANAGEMENT"] = "FRANCHISE_MANAGEMENT";
    DocumentCategoryType["SMALL_BUSINESS_TOOLS"] = "SMALL_BUSINESS_TOOLS";
    DocumentCategoryType["REMOTE_WORKFORCE"] = "REMOTE_WORKFORCE";
    DocumentCategoryType["DESKLESS_WORKFORCE"] = "DESKLESS_WORKFORCE";
    DocumentCategoryType["DIVERSITY_INCLUSION"] = "DIVERSITY_INCLUSION";
    DocumentCategoryType["TEAM_COLLABORATION"] = "TEAM_COLLABORATION";
    DocumentCategoryType["CROSS_DEPT_COORDINATION"] = "CROSS_DEPT_COORDINATION";
    DocumentCategoryType["LEADERSHIP_DEV"] = "LEADERSHIP_DEV";
    DocumentCategoryType["SCALABILITY"] = "SCALABILITY";
    DocumentCategoryType["TRAINING_MODULES"] = "TRAINING_MODULES";
    DocumentCategoryType["PERFORMANCE_TRACKING"] = "PERFORMANCE_TRACKING";
    DocumentCategoryType["CUSTOMER_SUPPORT_INTEGRATION"] = "CUSTOMER_SUPPORT_INTEGRATION";
    DocumentCategoryType["JOB_BOARD_INTEGRATIONS"] = "JOB_BOARD_INTEGRATIONS";
    DocumentCategoryType["CALENDAR_INTEGRATIONS"] = "CALENDAR_INTEGRATIONS";
    DocumentCategoryType["INDUSTRY_SPECIFIC"] = "INDUSTRY_SPECIFIC";
    DocumentCategoryType["INTEGRATIONS"] = "INTEGRATIONS";
    // Foundational / Other
    DocumentCategoryType["GENERAL"] = "GENERAL";
})(DocumentCategoryType || (exports.DocumentCategoryType = DocumentCategoryType = {}));
/**
 * Map of category attributes for each document category
 * NOTE: Using default/estimated values for new categories. Review required.
 */
exports.CATEGORY_ATTRIBUTES = (_a = {},
    // Primary Categories
    _a[DocumentCategoryType.HIRING] = {
        displayName: 'Hiring',
        description: 'Covers all aspects of the hiring process, from sourcing to offer letters.',
        associatedKeywords: ['hiring', 'recruitment', 'applicant tracking', 'ats', 'sourcing', 'offer letter', 'candidate screening', 'interview scheduling'],
        potentiallySensitive: false, requiresApproval: false, color: '#4285F4', routingPriority: 1
    },
    _a[DocumentCategoryType.ONBOARDING] = {
        displayName: 'Onboarding',
        description: 'Information related to employee onboarding processes and documentation.',
        associatedKeywords: ['onboarding', 'new hire', 'paperwork', 'welcome kit', 'orientation', 'i-9', 'e-verify'],
        potentiallySensitive: true, requiresApproval: false, color: '#34A853', routingPriority: 2
    },
    _a[DocumentCategoryType.HR_MANAGEMENT] = {
        displayName: 'HR Management',
        description: 'General Human Resources management topics, employee relations, records.',
        associatedKeywords: ['hr', 'human resources', 'employee records', 'personnel', 'hr tasks', 'relations'],
        potentiallySensitive: true, requiresApproval: false, color: '#FBBC05', routingPriority: 3
    },
    _a[DocumentCategoryType.PAYROLL] = {
        displayName: 'Payroll',
        description: 'Payroll processing, payments, deductions, and related systems.',
        associatedKeywords: ['payroll', 'payment', 'salary', 'wages', 'compensation', 'deductions', 'taxes'],
        potentiallySensitive: true, requiresApproval: true, color: '#EA4335', routingPriority: 1
    },
    _a[DocumentCategoryType.COMPLIANCE] = {
        displayName: 'Compliance',
        description: 'Legal and regulatory compliance in HR and hiring (excluding specific tax forms).',
        associatedKeywords: ['compliance', 'legal', 'regulation', 'policy', 'eeoc', 'labor law', 'hipaa', 'ada'],
        potentiallySensitive: true, requiresApproval: true, color: '#F44336', routingPriority: 1
    },
    _a[DocumentCategoryType.SCHEDULING] = {
        displayName: 'Scheduling',
        description: 'Employee scheduling, shift management, and time-off requests.',
        associatedKeywords: ['schedule', 'scheduling', 'shift', 'rota', 'time off', 'workforce', 'shift management'],
        potentiallySensitive: false, requiresApproval: false, color: '#FF9800', routingPriority: 2
    },
    _a[DocumentCategoryType.RETENTION] = {
        displayName: 'Employee Retention',
        description: 'Strategies and information related to retaining employees.',
        associatedKeywords: ['retention', 'turnover', 'employee satisfaction', 'loyalty', 'attrition', 'engagement'],
        potentiallySensitive: false, requiresApproval: false, color: '#9C27B0', routingPriority: 3
    },
    _a[DocumentCategoryType.OPTIMIZATION] = {
        displayName: 'Workforce Optimization',
        description: 'Optimizing workforce performance, costs, and efficiency.',
        associatedKeywords: ['optimization', 'efficiency', 'productivity', 'workforce planning', 'labor cost', 'analytics'],
        potentiallySensitive: false, requiresApproval: false, color: '#009688', routingPriority: 3
    },
    _a[DocumentCategoryType.AUTOMATION] = {
        displayName: 'Automation',
        description: 'Automating HR and hiring tasks and workflows.',
        associatedKeywords: ['automation', 'workflow', 'automated', 'streamline', 'efficiency', 'bots'],
        potentiallySensitive: false, requiresApproval: false, color: '#795548', routingPriority: 2
    },
    _a[DocumentCategoryType.AI_TOOLS] = {
        displayName: 'AI-Powered Tools',
        description: 'Features and tools leveraging Artificial Intelligence.',
        associatedKeywords: ['ai', 'artificial intelligence', 'machine learning', 'screening', 'matching', 'parsing'],
        potentiallySensitive: false, requiresApproval: false, color: '#607D8B', routingPriority: 2
    },
    _a[DocumentCategoryType.JOB_POSTING] = {
        displayName: 'Job Posting',
        description: 'Creating, managing, and distributing job postings to various boards.',
        associatedKeywords: ['job posting', 'job ad', 'job description', 'job board', 'distribution', 'syndication', 'indeed', 'ziprecruiter'],
        potentiallySensitive: false, requiresApproval: false, color: '#3F51B5', routingPriority: 2
    },
    _a[DocumentCategoryType.CANDIDATE_SCREENING] = {
        displayName: 'Candidate Screening',
        description: 'Tools and processes for screening and filtering job applicants.',
        associatedKeywords: ['screening', 'candidate', 'applicant', 'filter', 'assessment', 'resume', 'parsing', 'ai screening'],
        potentiallySensitive: false, requiresApproval: false, color: '#03A9F4', routingPriority: 2
    },
    _a[DocumentCategoryType.INTERVIEW_SCHEDULING] = {
        displayName: 'Interview Scheduling',
        description: 'Tools and processes for coordinating and scheduling interviews.',
        associatedKeywords: ['interview', 'scheduling', 'calendar', 'booking', 'appointment', 'coordination'],
        potentiallySensitive: false, requiresApproval: false, color: '#00BCD4', routingPriority: 2
    },
    _a[DocumentCategoryType.REPORTING] = {
        displayName: 'Reporting & Analytics',
        description: 'Generating reports and analyzing HR, hiring, and workforce data.',
        associatedKeywords: ['report', 'reporting', 'analytics', 'metrics', 'kpi', 'dashboard', 'data', 'insights'],
        potentiallySensitive: true, requiresApproval: false, color: '#8BC34A', routingPriority: 2
    },
    _a[DocumentCategoryType.MOBILE_SOLUTIONS] = {
        displayName: 'Mobile-Friendly Solutions',
        description: 'Features and accessibility through mobile applications or responsive design.',
        associatedKeywords: ['mobile', 'app', 'ios', 'android', 'responsive', 'on the go', 'text-to-apply', 'sms'],
        potentiallySensitive: false, requiresApproval: false, color: '#CDDC39', routingPriority: 3
    },
    _a[DocumentCategoryType.DOCUMENTS] = {
        displayName: 'Document Management',
        description: 'Storing, managing, accessing, and signing HR-related documents.',
        associatedKeywords: ['document', 'storage', 'esignature', 'digital signature', 'records', 'paperwork', 'templates', 'offer letter'],
        potentiallySensitive: true, requiresApproval: false, color: '#FFC107', routingPriority: 2
    },
    _a[DocumentCategoryType.TIME_TRACKING] = {
        displayName: 'Time Tracking',
        description: 'Tracking employee work hours, attendance, time clocks, and geofencing.',
        associatedKeywords: ['time tracking', 'timesheet', 'attendance', 'clock in', 'clock out', 'hours', 'geofencing'],
        potentiallySensitive: false, requiresApproval: false, color: '#FF5722', routingPriority: 2
    },
    _a[DocumentCategoryType.TAX_COMPLIANCE] = {
        displayName: 'Tax Forms & Compliance',
        description: 'Handling specific tax forms (WOTC, I-9, etc.) and related compliance.',
        associatedKeywords: ['tax', 'wotc', 'i-9', 'e-verify', 'compliance', 'form', 'government', 'tax credits'],
        potentiallySensitive: true, requiresApproval: true, color: '#F44336', routingPriority: 1
    },
    _a[DocumentCategoryType.ENGAGEMENT] = {
        displayName: 'Employee Engagement',
        description: 'Tools and strategies for improving employee engagement, surveys, and communication.',
        associatedKeywords: ['engagement', 'employee survey', 'feedback', 'communication', 'recognition', 'culture'],
        potentiallySensitive: false, requiresApproval: false, color: '#E91E63', routingPriority: 3
    },
    _a[DocumentCategoryType.SECURITY_PRIVACY] = {
        displayName: 'Security & Privacy',
        description: 'Data security measures, privacy policies, access control, and compliance (GDPR, CCPA).',
        associatedKeywords: ['security', 'privacy', 'data protection', 'encryption', 'gdpr', 'ccpa', 'hipaa', 'rbac', 'sso', 'mfa'],
        potentiallySensitive: true, requiresApproval: true, color: '#673AB7', routingPriority: 1
    },
    // Secondary Categories
    _a[DocumentCategoryType.TEXT_TO_APPLY] = {
        displayName: 'Text-to-Apply Features',
        description: 'Specific features allowing candidates to initiate applications via text message.',
        associatedKeywords: ['text to apply', 'sms apply', 'text hiring', 'mobile application', 'qr code'],
        potentiallySensitive: false, requiresApproval: false, color: '#4DD0E1', routingPriority: 3
    },
    _a[DocumentCategoryType.TWO_WAY_SMS] = {
        displayName: 'Two-Way SMS Communication',
        description: 'Features enabling two-way text message communication with candidates and employees.',
        associatedKeywords: ['sms', 'text message', 'two way sms', 'communication', 'chat', 'candidate communication'],
        potentiallySensitive: false, requiresApproval: false, color: '#4DD0E1', routingPriority: 3
    },
    _a[DocumentCategoryType.BACKGROUND_CHECKS] = {
        displayName: 'Background Checks Integration',
        description: 'Integration capabilities with third-party background check services.',
        associatedKeywords: ['background check', 'screening', 'criminal record', 'verification', 'integration'],
        potentiallySensitive: true, requiresApproval: false, color: '#BDBDBD', routingPriority: 2
    },
    _a[DocumentCategoryType.SHIFT_MANAGEMENT] = {
        displayName: 'Shift Management Tools',
        description: 'Specific tools for creating schedules, managing shifts, swaps, and coverage.',
        associatedKeywords: ['shift', 'swap', 'open shift', 'schedule', 'coverage', 'staffing'],
        potentiallySensitive: false, requiresApproval: false, color: '#FFB74D', routingPriority: 2
    },
    _a[DocumentCategoryType.DIGITAL_SIGNATURES] = {
        displayName: 'Digital Signatures Collection',
        description: 'Functionality for collecting legally binding electronic signatures on documents.',
        associatedKeywords: ['digital signature', 'esignature', 'sign', 'document signing', 'contract', 'offer letter'],
        potentiallySensitive: true, requiresApproval: false, color: '#FFD54F', routingPriority: 2
    },
    _a[DocumentCategoryType.CUSTOMIZABLE_TEMPLATES] = {
        displayName: 'Customizable Templates',
        description: 'Availability and customization options for various templates (offer letters, emails, forms).',
        associatedKeywords: ['template', 'customizable', 'offer letter', 'email template', 'form', 'branding'],
        potentiallySensitive: false, requiresApproval: false, color: '#AED581', routingPriority: 3
    },
    _a[DocumentCategoryType.FRANCHISE_MANAGEMENT] = {
        displayName: 'Franchise Management Solutions',
        description: 'Features and solutions specifically designed for franchise businesses and multi-location management.',
        associatedKeywords: ['franchise', 'multi location', 'franchisor', 'franchisee', 'brand consistency', 'corporate'],
        potentiallySensitive: false, requiresApproval: false, color: '#BA68C8', routingPriority: 2
    },
    _a[DocumentCategoryType.SMALL_BUSINESS_TOOLS] = {
        displayName: 'Small Business Hiring Tools',
        description: 'Tools, features, and pricing plans suitable for small and medium-sized businesses.',
        associatedKeywords: ['small business', 'smb', 'startup', 'affordable', 'easy to use', 'limited budget'],
        potentiallySensitive: false, requiresApproval: false, color: '#4FC3F7', routingPriority: 2
    },
    _a[DocumentCategoryType.REMOTE_WORKFORCE] = {
        displayName: 'Remote Workforce Management',
        description: 'Capabilities for managing hiring, onboarding, and HR for remote or distributed workforces.',
        associatedKeywords: ['remote work', 'distributed team', 'work from home', 'virtual team', 'telecommute', 'hybrid work'],
        potentiallySensitive: false, requiresApproval: false, color: '#7986CB', routingPriority: 3
    },
    _a[DocumentCategoryType.DESKLESS_WORKFORCE] = {
        displayName: 'Deskless Workforce Solutions',
        description: 'Solutions tailored for managing employees who do not typically work at a desk (e.g., retail, hospitality, field services).',
        associatedKeywords: ['deskless', 'hourly worker', 'frontline', 'field worker', 'mobile workforce', 'non-desk'],
        potentiallySensitive: false, requiresApproval: false, color: '#4DB6AC', routingPriority: 3
    },
    _a[DocumentCategoryType.DIVERSITY_INCLUSION] = {
        displayName: 'Diversity and Inclusion Initiatives',
        description: 'Features, reporting, or information supporting diversity, equity, and inclusion (DE&I) efforts in hiring and HR.',
        associatedKeywords: ['diversity', 'inclusion', 'd&i', 'dei', 'equity', 'belonging', 'bias reduction', 'eeo reporting'],
        potentiallySensitive: false, requiresApproval: false, color: '#F06292', routingPriority: 3
    },
    _a[DocumentCategoryType.TEAM_COLLABORATION] = {
        displayName: 'Team Collaboration Tools',
        description: 'Tools facilitating collaboration among hiring managers, recruiters, and other team members.',
        associatedKeywords: ['collaboration', 'teamwork', 'communication', 'shared access', 'notes', 'feedback', 'hiring team'],
        potentiallySensitive: false, requiresApproval: false, color: '#9575CD', routingPriority: 4
    },
    _a[DocumentCategoryType.CROSS_DEPT_COORDINATION] = {
        displayName: 'Cross-Department Coordination',
        description: 'Features supporting coordination and workflows between different departments (e.g., HR, Finance, IT).',
        associatedKeywords: ['cross functional', 'interdepartmental', 'coordination', 'workflow', 'approval', 'integration'],
        potentiallySensitive: false, requiresApproval: false, color: '#A1887F', routingPriority: 4
    },
    _a[DocumentCategoryType.LEADERSHIP_DEV] = {
        displayName: 'Leadership Development Resources',
        description: 'Resources, content, or tools related to leadership development and training.',
        associatedKeywords: ['leadership', 'management training', 'development', 'succession planning', 'coaching'],
        potentiallySensitive: false, requiresApproval: false, color: '#FF8A65', routingPriority: 4
    },
    _a[DocumentCategoryType.SCALABILITY] = {
        displayName: 'Scalability for Growing Businesses',
        description: 'Information addressing how the platform scales to accommodate business growth and high volume.',
        associatedKeywords: ['scalability', 'growth', 'scaling', 'enterprise', 'high volume', 'performance'],
        potentiallySensitive: false, requiresApproval: false, color: '#81C784', routingPriority: 3
    },
    _a[DocumentCategoryType.TRAINING_MODULES] = {
        displayName: 'Training Programs & Development Modules',
        description: 'Built-in or integrated modules for employee training and development.',
        associatedKeywords: ['training', 'learning', 'development', 'lms', 'course', 'employee training', 'compliance training'],
        potentiallySensitive: false, requiresApproval: false, color: '#DCE775', routingPriority: 3
    },
    _a[DocumentCategoryType.PERFORMANCE_TRACKING] = {
        displayName: 'Performance Metrics Tracking (KPIs)',
        description: 'Capabilities for tracking employee performance or key hiring/HR metrics.',
        associatedKeywords: ['performance', 'kpi', 'metrics', 'tracking', 'evaluation', 'review', 'analytics'],
        potentiallySensitive: true, requiresApproval: false, color: '#FFF176', routingPriority: 3
    },
    _a[DocumentCategoryType.CUSTOMER_SUPPORT_INTEGRATION] = {
        displayName: 'Customer Support Integration',
        description: 'Integration capabilities with customer support platforms (e.g., Zendesk, Salesforce Service Cloud).',
        associatedKeywords: ['support', 'helpdesk', 'zendesk', 'salesforce', 'ticketing', 'customer service', 'integration'],
        potentiallySensitive: false, requiresApproval: false, color: '#64B5F6', routingPriority: 4
    },
    _a[DocumentCategoryType.JOB_BOARD_INTEGRATIONS] = {
        displayName: 'Job Board Integrations',
        description: 'Integration capabilities with external job boards (e.g., Indeed, ZipRecruiter, LinkedIn).',
        associatedKeywords: ['job board', 'integration', 'indeed', 'ziprecruiter', 'linkedin', 'posting', 'syndication'],
        potentiallySensitive: false, requiresApproval: false, color: '#7986CB', routingPriority: 3
    },
    _a[DocumentCategoryType.CALENDAR_INTEGRATIONS] = {
        displayName: 'Calendar Integrations',
        description: 'Integration capabilities with calendar systems (e.g., Google Calendar, Outlook Calendar).',
        associatedKeywords: ['calendar', 'integration', 'google calendar', 'outlook', 'scheduling', 'sync', 'interview scheduling'],
        potentiallySensitive: false, requiresApproval: false, color: '#4DD0E1', routingPriority: 3
    },
    _a[DocumentCategoryType.INDUSTRY_SPECIFIC] = {
        displayName: 'Industry Specific',
        description: 'Solutions, features, or content tailored to specific industries (e.g., Restaurants, Retail, Healthcare).',
        associatedKeywords: ['industry', 'vertical', 'restaurant', 'retail', 'healthcare', 'logistics', 'manufacturing', 'hospitality'],
        potentiallySensitive: false, requiresApproval: false, color: '#90CAF9', routingPriority: 2
    },
    _a[DocumentCategoryType.INTEGRATIONS] = {
        displayName: 'Integrations',
        description: 'General information about third-party integrations and API capabilities.',
        associatedKeywords: ['integration', 'api', 'connect', 'third party', 'ecosystem', 'marketplace', 'payroll integration', 'hris integration'],
        potentiallySensitive: false, requiresApproval: false, color: '#BDBDBD', routingPriority: 2
    },
    // Foundational / Other
    _a[DocumentCategoryType.GENERAL] = {
        displayName: 'General / Other',
        description: 'General information, company overview, or content that doesn\'t fit other specific categories.',
        associatedKeywords: ['general', 'information', 'about', 'misc', 'other', 'uncategorized', 'overview', 'company'],
        potentiallySensitive: false, requiresApproval: false, color: '#9E9E9E', routingPriority: 5
    },
    _a);
/**
 * Get all available document categories (enum keys)
 */
function getAllCategories() {
    // Filter out numeric keys if the enum is not string-based
    return Object.values(DocumentCategoryType).filter(function (value) { return typeof value === 'string'; });
}
/**
 * Get all standard categories (now includes primary and secondary)
 */
function getStandardCategories() {
    return getAllCategories(); // All defined enum members are now considered standard
}
/**
 * Get categories that potentially contain sensitive information
 */
function getSensitiveCategories() {
    return Object.entries(exports.CATEGORY_ATTRIBUTES)
        .filter(function (_a) {
        var _ = _a[0], attributes = _a[1];
        return attributes.potentiallySensitive;
    })
        .map(function (_a) {
        var category = _a[0];
        return category;
    });
}
/**
 * Get categories that require approval
 */
function getApprovalRequiredCategories() {
    return Object.entries(exports.CATEGORY_ATTRIBUTES)
        .filter(function (_a) {
        var _ = _a[0], attributes = _a[1];
        return attributes.requiresApproval;
    })
        .map(function (_a) {
        var category = _a[0];
        return category;
    });
}
/**
 * Get high priority categories for routing
 */
function getHighPriorityCategories() {
    return Object.entries(exports.CATEGORY_ATTRIBUTES)
        .filter(function (_a) {
        var _ = _a[0], attributes = _a[1];
        return attributes.routingPriority <= 2;
    })
        .map(function (_a) {
        var category = _a[0];
        return category;
    });
}
/**
 * Get category attributes for a specific category
 */
function getCategoryAttributes(category) {
    return exports.CATEGORY_ATTRIBUTES[category];
}
/**
 * Map a legacy category to its standardized equivalent
 * (Now mostly returns the input as legacy categories are removed/mapped implicitly)
 * @param category The category to map
 * @returns The standardized category
 */
function mapToStandardCategory(category) {
    // Since legacy categories are removed from the enum, this function
    // mainly acts as a passthrough unless specific explicit mappings are needed later.
    return category;
}
/**
 * Quality control flags for content
 */
var QualityControlFlag;
(function (QualityControlFlag) {
    QualityControlFlag["APPROVED"] = "approved";
    QualityControlFlag["PENDING_REVIEW"] = "pending_review";
    QualityControlFlag["NEEDS_CLARIFICATION"] = "needs_clarification";
    QualityControlFlag["CONTAINS_CONTRADICTIONS"] = "contains_contradictions";
    QualityControlFlag["OUTDATED"] = "outdated";
    QualityControlFlag["UNRELIABLE_SOURCE"] = "unreliable_source";
    QualityControlFlag["OUTDATED_CONTENT"] = "outdated_content";
    QualityControlFlag["INCOMPLETE_CONTENT"] = "incomplete_content";
    QualityControlFlag["FORMATTING_ISSUES"] = "formatting_issues";
})(QualityControlFlag || (exports.QualityControlFlag = QualityControlFlag = {}));
/**
 * Determines if a flag requires human review
 */
function requiresHumanReview(flag) {
    return [
        QualityControlFlag.PENDING_REVIEW,
        QualityControlFlag.NEEDS_CLARIFICATION,
        QualityControlFlag.CONTAINS_CONTRADICTIONS,
        QualityControlFlag.UNRELIABLE_SOURCE,
        QualityControlFlag.OUTDATED, // Added outdated as needing review
        QualityControlFlag.OUTDATED_CONTENT,
        QualityControlFlag.INCOMPLETE_CONTENT
    ].includes(flag);
}
/**
 * Document confidence level
 */
var ConfidenceLevel;
(function (ConfidenceLevel) {
    ConfidenceLevel["HIGH"] = "high";
    ConfidenceLevel["MEDIUM"] = "medium";
    ConfidenceLevel["LOW"] = "low";
    ConfidenceLevel["UNCERTAIN"] = "uncertain";
})(ConfidenceLevel || (exports.ConfidenceLevel = ConfidenceLevel = {}));
/**
 * Entity types that can be extracted from documents
 */
var EntityType;
(function (EntityType) {
    EntityType["PERSON"] = "person";
    EntityType["ORGANIZATION"] = "organization";
    EntityType["PRODUCT"] = "product";
    EntityType["FEATURE"] = "feature";
    EntityType["PRICE"] = "price";
    EntityType["DATE"] = "date";
    EntityType["LOCATION"] = "location";
    EntityType["INDUSTRY"] = "industry";
    EntityType["JOB_TITLE"] = "job_title";
    EntityType["COMPETITOR"] = "competitor";
    EntityType["INTEGRATION_PARTNER"] = "integration_partner";
    EntityType["TECHNOLOGY"] = "technology";
    EntityType["REGULATION"] = "regulation";
    EntityType["OTHER"] = "other";
})(EntityType || (exports.EntityType = EntityType = {}));
/**
 * Basic rules-based category detection (Fallback)
 * TODO: Implement more robust logic if needed, maybe using keywords from CATEGORY_ATTRIBUTES.
 */
function detectCategoryFromText(text) {
    var lowerText = text.toLowerCase();
    // Prioritize technical keywords
    if (/\b(api|sdk|integration|technical|developer|code|endpoint)\b/.test(lowerText)) {
        return [DocumentCategoryType.INTEGRATIONS, 0.7]; // Or TECHNICAL if that's added back
    }
    if (/\b(compliance|regulation|law|wotc|i-9|e-verify|tax form|hipaa|ab5)\b/.test(lowerText)) {
        return [DocumentCategoryType.COMPLIANCE, 0.8];
    }
    if (/\b(payroll|wage|salary|paycheck|deduction)\b/.test(lowerText)) {
        return [DocumentCategoryType.PAYROLL, 0.7];
    }
    if (/\b(hiring|recruitment|ats|applicant|candidate|job posting|screening|interview)\b/.test(lowerText)) {
        return [DocumentCategoryType.HIRING, 0.6];
    }
    if (/\b(onboarding|new hire|orientation|paperwork)\b/.test(lowerText)) {
        return [DocumentCategoryType.ONBOARDING, 0.6];
    }
    if (/\b(schedule|shift|time off|clock in|attendance)\b/.test(lowerText)) {
        return [DocumentCategoryType.SCHEDULING, 0.6];
    }
    // Add more rules based on associatedKeywords...
    return [DocumentCategoryType.GENERAL, 0.3]; // Default fallback
}

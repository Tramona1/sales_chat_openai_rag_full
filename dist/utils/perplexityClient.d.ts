/**
 * Perplexity API Client
 *
 * A lightweight client for the Perplexity API that provides real-time web search
 * capability to fetch information about companies.
 */
export interface CompanyInformation {
    companyInfo: string;
    industry?: string;
    size?: string;
    location?: string;
    website?: string;
    founded?: string;
    citations: string[];
    lastUpdated: Date;
    isRateLimited: boolean;
}
export interface CompanyIdentity {
    exists: boolean;
    fullName?: string;
    description?: string;
    industry?: string;
    isRateLimited: boolean;
}
/**
 * Get company information from Perplexity API
 *
 * This function fetches information about a company using real-time web search
 * via the Perplexity API, with caching to minimize API calls.
 *
 * @param companyName Name of the company
 * @param options Optional settings
 * @returns Company information object
 */
export declare function getCompanyInformation(companyName: string, options?: {
    forceRefresh?: boolean;
    searchMode?: 'low' | 'medium' | 'high';
}): Promise<CompanyInformation>;
/**
 * Verify if a company exists and get basic identification
 *
 * This provides a lighter-weight API call to confirm company identity
 * before fetching full details.
 *
 * @param companyName Name to verify
 * @returns Company verification object
 */
export declare function verifyCompanyIdentity(companyName: string): Promise<CompanyIdentity>;

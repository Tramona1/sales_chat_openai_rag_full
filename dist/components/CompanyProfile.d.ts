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
declare const CompanyProfile: React.FC<CompanyProfileProps>;
export default CompanyProfile;

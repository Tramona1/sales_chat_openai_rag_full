import React from 'react';
import { GetServerSideProps } from 'next';
import { FeedbackLog } from '../types/feedback';
interface AdminProps {
    logs: FeedbackLog[];
}
export declare const getServerSideProps: GetServerSideProps;
export default function Admin({ logs }: AdminProps): React.JSX.Element;
export {};

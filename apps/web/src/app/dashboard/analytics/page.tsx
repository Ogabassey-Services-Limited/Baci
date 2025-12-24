import type { Metadata } from 'next';
import AnalyticsClientPage from './client-page';

export const metadata: Metadata = {
  title: 'Analytics | Baci Dashboard',
  description:
    'Deep dive into your store performance, revenue, and customer insights.',
};

export default function AnalyticsPage() {
  return <AnalyticsClientPage />;
}

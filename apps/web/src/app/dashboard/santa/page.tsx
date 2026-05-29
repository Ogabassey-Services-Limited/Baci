import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getMerchantForUser } from '@/lib/merchant-server';
import SantaClientPage from './client-page';

export const metadata: Metadata = {
  title: 'Santa Analytics | Dashboard',
  description:
    'View real-time interactions and sales from the Santa AI campaign.',
};

export default async function SantaPage() {
  const { merchant } = await getMerchantForUser();

  // Guard: Only allow 'ogabassey' merchant to access this page
  if (merchant?.slug !== 'ogabassey') {
    notFound();
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <Suspense fallback={<div>Loading Santa's workshop data...</div>}>
        <SantaClientPage />
      </Suspense>
    </div>
  );
}

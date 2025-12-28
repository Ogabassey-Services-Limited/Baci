import type { Metadata } from 'next';
import { Suspense } from 'react';
import SantaClientPage from './client-page';

export const metadata: Metadata = {
  title: 'Santa Analytics | Dashboard',
  description:
    'View real-time interactions and sales from the Santa AI campaign.',
};

export default function SantaPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <Suspense fallback={<div>Loading Santa's workshop data...</div>}>
        <SantaClientPage />
      </Suspense>
    </div>
  );
}

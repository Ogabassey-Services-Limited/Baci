import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BnplLauncher } from '@/components/storefront/ogabassey/pages/bnpl-launcher';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isDomainIdentifier } from '@/lib/validation';

function BnplLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-12 h-12 bg-gray-200 rounded-full mb-4" />
        <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
      </div>
    </div>
  );
}

export default async function BnplCheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Verify merchant exists
  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // We rely on the client component to handle the specific logic
  // This page wrapper mainly ensures we have a valid merchant context if needed
  // and provides the Suspense boundary for useSearchParams

  return (
    <Suspense fallback={<BnplLoading />}>
      <BnplLauncher />
    </Suspense>
  );
}

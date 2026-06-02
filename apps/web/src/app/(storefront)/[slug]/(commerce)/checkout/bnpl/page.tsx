import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BnplLauncher } from '@/components/storefront/ogabassey/pages/bnpl-launcher';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isDomainIdentifier } from '@/lib/validation';

function BnplCheckoutFallback() {
  return (
    <div
      aria-label="Loading BNPL checkout"
      className="min-h-screen bg-white flex flex-col items-center justify-center p-4"
      role="status"
    >
      <div className="text-center">
        <div aria-hidden="true" className="relative size-20 mx-auto mb-6">
          <div className="absolute inset-0 border-4 border-gray-100 rounded-full" />
          <div className="absolute inset-0 border-4 border-store-primary rounded-full border-t-transparent animate-spin" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Secure Checkout
        </h1>
        <p className="text-gray-500">Launching payment gateway...</p>
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

  return (
    <Suspense fallback={<BnplCheckoutFallback />}>
      <BnplLauncher merchantSlug={slug} />
    </Suspense>
  );
}

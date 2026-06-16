import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BnplLauncher } from '@/components/storefront/ogabassey/pages/bnpl-launcher';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isDomainIdentifier } from '@/lib/validation';

export const metadata: Metadata = {
  title: 'BNPL Checkout',
  description: 'Complete your private buy-now-pay-later checkout securely.',
  robots: { index: false, follow: false },
};

function BnplCheckoutFallback() {
  return (
    <div
      role="status"
      aria-label="Loading BNPL checkout"
      className="flex min-h-screen flex-col items-center justify-center bg-store-background p-4 text-store-background-text"
    >
      <div className="text-center">
        <div aria-hidden="true" className="relative size-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-store-background-text/10" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-store-primary border-t-transparent" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-store-background-text">
          Secure Checkout
        </h1>
        <p className="text-store-background-text/70">
          Launching payment gateway...
        </p>
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

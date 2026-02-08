import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CryptoCheckoutPage } from '@/components/storefront/ogabassey/pages/crypto-checkout';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isDomainIdentifier } from '@/lib/validation';

function CryptoLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-12 h-12 bg-gray-200 rounded-full mb-4" />
        <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
      </div>
    </div>
  );
}

export default async function CryptoCheckoutRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  return (
    <Suspense fallback={<CryptoLoading />}>
      <CryptoCheckoutPage />
    </Suspense>
  );
}

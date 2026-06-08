import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CryptoCheckoutPage } from '@/components/storefront/ogabassey/pages/crypto-checkout';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isDomainIdentifier } from '@/lib/validation';

export const metadata: Metadata = {
  title: 'Crypto Checkout',
  description: 'Complete your private crypto checkout securely.',
  robots: { index: false, follow: false },
};

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

  return <CryptoCheckoutPage />;
}

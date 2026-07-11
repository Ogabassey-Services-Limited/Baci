import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OgabasseyUnlockOrders } from '@/components/storefront/ogabassey/pages/unlock-orders';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';

export const metadata: Metadata = {
  description: 'Track clean carrier-unlock orders.',
  robots: { follow: false, index: false },
  title: 'Unlock Orders',
};

export default async function UnlockOrdersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isValidMerchantIdentifier(slug)) notFound();
  const lookupKey = slug.toLowerCase();
  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(lookupKey)
    : await getCachedMerchant(lookupKey);
  if (merchant?.template_id !== 'ogabassey') notFound();
  return <OgabasseyUnlockOrders />;
}

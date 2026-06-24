import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OgabasseyV2Repairs } from '@/components/storefront/ogabassey/pages/repairs';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';

export const metadata: Metadata = {
  title: 'Book a Repair',
  description: 'Schedule a repair for your device',
};

export default async function RepairsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Validate identifier
  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  // Get merchant data handling both slugs and domains
  const lookupKey = slug.toLowerCase();
  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(lookupKey)
    : await getCachedMerchant(lookupKey);

  if (!merchant) {
    notFound();
  }

  // Only show for Ogabassey template (merchant-specific feature)
  if (
    (merchant as unknown as { template_id?: string }).template_id !==
    'ogabassey'
  ) {
    notFound();
  }

  return <OgabasseyV2Repairs />;
}

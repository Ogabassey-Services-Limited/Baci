import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { OgabasseyV2Repairs } from '@/components/storefront/ogabassey/pages/repairs';
import {
  isValidMerchantIdentifier,
  isDomainIdentifier,
} from '@/lib/validation';
import type { V2ThemeMode } from '@/components/storefront/ogabassey/providers/v2-theme-context';

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

  // Read theme cookie server-side for SSR consistency
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('storefront-theme')?.value;
  const _initialTheme: V2ThemeMode | undefined =
    themeCookie === 'standard' || themeCookie === 'santa'
      ? themeCookie
      : undefined;

  if (
    (merchant as unknown as { template_id?: string }).template_id ===
    'ogabassey'
  ) {
    return <OgabasseyV2Repairs />;
  }

  // Fallback
  return notFound();
}

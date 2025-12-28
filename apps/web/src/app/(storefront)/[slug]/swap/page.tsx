import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { OgabasseyV2Swap } from '@/components/storefront/ogabassey/pages/swap';
import type { V2ThemeMode } from '@/components/storefront/ogabassey/providers/v2-theme-context';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';

export const metadata: Metadata = {
  title: 'Swap Your Device',
  description: 'Trade in your old device for a new one',
};

export default async function SwapPage({
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

  // Only show for Ogabassey template (merchant-specific feature)
  if (
    (merchant as unknown as { template_id?: string }).template_id !==
    'ogabassey'
  ) {
    notFound();
  }

  return <OgabasseyV2Swap />;
}

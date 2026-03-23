import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { OgabasseyV2Wallet } from '@/components/storefront/ogabassey/pages/wallet';
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
  title: 'Wallet Balance',
  description: 'Check your wallet balance',
};

/**
 * Synchronous page wrapper ensures the H1 tag appears in the initial SSR HTML,
 * rather than being deferred to RSC streaming (which crawlers like Ahrefs miss).
 */
export default function WalletPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <>
      <h1 className="sr-only">Wallet</h1>
      <Suspense
        fallback={
          <div className="container mx-auto px-4 py-12 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="sr-only">Loading wallet...</span>
          </div>
        }
      >
        <WalletContent params={params} />
      </Suspense>
    </>
  );
}

async function WalletContent({
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
  if (merchant.template_id !== 'ogabassey') {
    notFound();
  }

  // Read theme cookie server-side for SSR consistency
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('storefront-theme')?.value;
  const _initialTheme: V2ThemeMode | undefined =
    themeCookie === 'standard' || themeCookie === 'santa'
      ? themeCookie
      : undefined;

  return <OgabasseyV2Wallet />;
}

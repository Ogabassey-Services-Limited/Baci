import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { OgabasseyV2Wallet } from '@/components/storefront/ogabassey/pages/wallet';
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

export default function WalletPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <WalletContent params={params} />;
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

  // `OgabasseyV2Wallet` is a pure client component and has no server-rendered
  // heading. Provide a sr-only `<h1>` so crawlers and no-JS/slow-hydration
  // users see a labelled main region in the initial HTML.
  return (
    <section aria-label="Wallet Balance">
      <h1 className="sr-only">Wallet Balance</h1>
      <OgabasseyV2Wallet />
    </section>
  );
}

import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { BnplLauncher } from '@/components/storefront/ogabassey/pages/bnpl-launcher';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isDomainIdentifier } from '@/lib/validation';

export default async function BnplCheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();

  const { slug } = await params;

  // Verify merchant exists
  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  return <BnplLauncher merchantSlug={slug} />;
}

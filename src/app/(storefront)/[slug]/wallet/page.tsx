import { notFound } from 'next/navigation';
import { OgabasseyV2Wallet } from '@/components/storefront/ogabassey/pages/wallet';
import { getCachedMerchant } from '@/lib/cached-data';

export default async function WalletPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // Only for Ogabassey template
  if (
    (merchant as unknown as { template_id?: string }).template_id ===
    'ogabassey'
  ) {
    return <OgabasseyV2Wallet />;
  }

  // Fallback
  return notFound();
}

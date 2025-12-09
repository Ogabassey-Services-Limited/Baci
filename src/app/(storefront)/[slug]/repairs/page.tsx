import { notFound } from 'next/navigation';
import { OgabasseyV2Repairs } from '@/components/storefront/ogabassey/pages/repairs';
import { getCachedMerchant } from '@/lib/cached-data';
import { StorefrontPageWrapper } from '../storefront-page-wrapper';

export default async function RepairsPage({
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
    return <OgabasseyV2Repairs />;
  }

  // Fallback
  return notFound();
}

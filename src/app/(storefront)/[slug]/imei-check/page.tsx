import { notFound } from 'next/navigation';
import { OgabasseyImeiChecker } from '@/components/storefront/ogabassey/pages/imei-checker';
import { getCachedMerchant } from '@/lib/cached-data';
import { StorefrontPageWrapper } from '../storefront-page-wrapper';

export default async function ImeiCheckPage({
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
    return <OgabasseyImeiChecker />;
  }

  // Fallback for other templates (e.g. 404 or coming soon)
  return notFound();
}

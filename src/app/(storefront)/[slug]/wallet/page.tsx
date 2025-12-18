import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { OgabasseyLayout } from '@/components/storefront/ogabassey/layout';
import { OgabasseyV2Wallet } from '@/components/storefront/ogabassey/pages/wallet';
import type { V2ThemeMode } from '@/components/storefront/ogabassey/providers/v2-theme-context';
import type { MerchantData } from '@/hooks/use-merchant';
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

  // Read theme cookie server-side for SSR consistency
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('storefront-theme')?.value;
  const initialTheme: V2ThemeMode | undefined =
    themeCookie === 'standard' || themeCookie === 'santa'
      ? themeCookie
      : undefined;

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

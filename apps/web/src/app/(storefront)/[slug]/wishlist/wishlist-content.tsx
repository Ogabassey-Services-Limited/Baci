import { getMerchantByIdentifier } from '@/lib/cached-data';
import { WishListPageClient } from './wishlist-client';

export async function WishListContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);
  const merchantCountry = merchant?.country ?? null;

  return <WishListPageClient merchantCountry={merchantCountry} />;
}

import type { Metadata } from 'next';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { WishListPageClient } from './wishlist-client';

export const metadata: Metadata = {
  title: 'Your Wish List',
  description: 'View and manage your saved items.',
  robots: { index: false },
};

export default async function WishListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);
  const merchantCountry = merchant?.country ?? null;

  return <WishListPageClient merchantCountry={merchantCountry} />;
}

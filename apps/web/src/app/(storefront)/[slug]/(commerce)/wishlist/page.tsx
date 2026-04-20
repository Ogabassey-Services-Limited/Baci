import type { Metadata } from 'next';
import { WishListContent } from './wishlist-content';

export const metadata: Metadata = {
  title: 'Your Wish List',
  description: 'View and manage your saved items.',
  robots: { index: false },
};

export default function WishListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <WishListContent params={params} />;
}

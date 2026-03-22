import type { Metadata } from 'next';
import { WishListPageClient } from './wishlist-client';

export const metadata: Metadata = {
  title: 'Your Wish List',
  description: 'View and manage your saved items.',
  robots: { index: false },
};

export default function WishListPage() {
  return (
    <>
      <h1 className="sr-only">Your Wish List</h1>
      <WishListPageClient />
    </>
  );
}

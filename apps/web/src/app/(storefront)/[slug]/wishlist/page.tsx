import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { WishListPageClient } from './wishlist-client';

export const metadata: Metadata = {
  title: 'Your Wish List',
  description: 'View and manage your saved items.',
  robots: { index: false },
};

/**
 * Synchronous page wrapper ensures the H1 tag appears in the initial SSR HTML,
 * rather than being deferred to RSC streaming (which crawlers like Ahrefs miss).
 */
export default function WishListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <>
      <h1 className="sr-only">Your Wish List</h1>
      <Suspense
        fallback={
          <div className="container mx-auto px-4 py-12 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="sr-only">Loading wish list...</span>
          </div>
        }
      >
        <WishListContent params={params} />
      </Suspense>
    </>
  );
}

async function WishListContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);
  const merchantCountry = merchant?.country ?? null;

  return <WishListPageClient merchantCountry={merchantCountry} />;
}

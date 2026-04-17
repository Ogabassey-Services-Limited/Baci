import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import { isValidMerchantIdentifier } from '@/lib/validation';
import { SearchPageContent, type SearchPageProps } from './search-page-content';

export async function generateMetadata({
  params,
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  const { q } = await searchParams;
  const trimmedQuery = (q || '').trim();
  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());

  return {
    title: trimmedQuery
      ? `Search results for ${trimmedQuery} | ${merchant.business_name}`
      : `Search | ${merchant.business_name}`,
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: trimmedQuery
        ? `${baseUrl}/search?q=${encodeURIComponent(trimmedQuery)}`
        : `${baseUrl}/search`,
    },
  };
}

export default function SearchPage(props: SearchPageProps) {
  return (
    <Suspense fallback={<ProductGridSkeleton count={8} columns={4} />}>
      <SearchPageContent {...props} />
    </Suspense>
  );
}

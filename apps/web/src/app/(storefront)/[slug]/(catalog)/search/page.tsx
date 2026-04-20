import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { sanitizeSearchQuery } from '@/lib/sanitize-core';
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
  const sanitizedQuery = sanitizeSearchQuery(q || '');
  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());

  return {
    title: sanitizedQuery
      ? `Search results for ${sanitizedQuery} | ${merchant.business_name}`
      : `Search | ${merchant.business_name}`,
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: sanitizedQuery
        ? `${baseUrl}/search?q=${encodeURIComponent(sanitizedQuery)}`
        : `${baseUrl}/search`,
    },
  };
}

export default function SearchPage(props: SearchPageProps) {
  return <SearchPageContent {...props} />;
}

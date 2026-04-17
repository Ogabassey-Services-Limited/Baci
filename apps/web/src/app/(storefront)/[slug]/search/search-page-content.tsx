import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { asRoute } from '@/lib/routes';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { generateBreadcrumbSchema, getProductUrl } from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import { getStorefrontSearchProducts } from '@/lib/storefront-search';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';
import { ProductIndexCard } from '../products/product-index-card';

export interface SearchPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}

function getStorefrontPathPrefix(slug: string, merchantSlug: string) {
  return isDomainIdentifier(slug) ? '' : `/${merchantSlug}`;
}

function formatResultCount(count: number) {
  return new Intl.NumberFormat('en-NG').format(count);
}

function formatSearchSummary({
  query,
  totalCount,
  visibleCount,
}: {
  query: string;
  totalCount: number;
  visibleCount: number;
}) {
  if (!query) {
    return 'Enter a search term to browse matching products.';
  }

  if (totalCount === 0) {
    return `No results found for “${query}”`;
  }

  if (totalCount > visibleCount) {
    return `Showing first ${formatResultCount(visibleCount)} of ${formatResultCount(totalCount)} results for “${query}”`;
  }

  return `${formatResultCount(totalCount)} result${totalCount === 1 ? '' : 's'} for “${query}”`;
}

export async function SearchPageContent({
  params,
  searchParams,
}: SearchPageProps) {
  const { slug } = await params;
  const { q } = await searchParams;
  const query = (q || '').trim();

  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  const searchResult = query
    ? await getStorefrontSearchProducts({
        merchantId: merchant.id,
        query,
        limit: 20,
      })
    : {
        count: 0,
        didYouMean: null,
        products: [],
        query: '',
      };

  const pathPrefix = getStorefrontPathPrefix(slug, merchant.slug);
  const storeUrl = buildRequestScopedStoreUrl(merchant, await headers());
  const pageUrl = query
    ? `${storeUrl}/search?q=${encodeURIComponent(query)}`
    : `${storeUrl}/search`;
  const priceFormatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: merchant.payout_currency || 'NGN',
    maximumFractionDigits: 0,
  });
  const visibleCount = searchResult.products.length;
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: merchant.business_name, url: storeUrl },
    { name: 'Search Results', url: pageUrl },
  ]);
  const searchResultsSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: query
      ? `Search results for ${query}`
      : `Search results | ${merchant.business_name}`,
    url: pageUrl,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: searchResult.products.map((product, index) => {
        const productUrl = `${storeUrl}${getProductUrl(product)}`;

        return {
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'Product',
            name: product.name,
            url: productUrl || undefined,
            image: product.imageLarge || product.image || undefined,
            offers: {
              '@type': 'Offer',
              price: product.price,
              priceCurrency: merchant.payout_currency || 'NGN',
              url: productUrl || undefined,
            },
          },
        };
      }),
    },
    numberOfItems: searchResult.products.length,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema serialized safely
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbSchema),
        }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema serialized safely
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(searchResultsSchema),
        }}
      />
      <div className="min-h-screen bg-[color:color-mix(in_srgb,var(--store-background,#ffffff)_94%,var(--store-background-text,#111827)_6%)] pb-20 pt-6">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6">
          <nav className="flex items-center gap-2 text-sm text-[var(--store-background-text,#111827)]/55">
            <Link
              href={asRoute(pathPrefix || '/')}
              prefetch={false}
              className="transition-colors hover:text-[var(--store-primary)]"
            >
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-[var(--store-background-text,#111827)]">
              Search
            </span>
          </nav>

          <div className="mt-6 space-y-2">
            <h1 className="text-3xl font-bold text-[var(--store-background-text,#111827)] md:text-4xl">
              Search Results
            </h1>
            <p className="max-w-2xl text-sm text-[var(--store-background-text,#111827)]/60 md:text-base">
              {formatSearchSummary({
                query,
                totalCount: searchResult.count,
                visibleCount,
              })}
            </p>
          </div>

          {searchResult.didYouMean && (
            <p className="mt-4 text-sm text-[var(--store-background-text,#111827)]/55">
              Did you mean{' '}
              <span className="font-medium">{searchResult.didYouMean}</span>?
            </p>
          )}

          {query ? (
            searchResult.products.length > 0 ? (
              <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {searchResult.products.map((product) => (
                  <ProductIndexCard
                    key={product.id}
                    formattedPrice={priceFormatter.format(product.price)}
                    pathPrefix={pathPrefix}
                    product={product}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-10 rounded-3xl border border-[var(--store-background-text,#111827)]/10 bg-[var(--store-background,#ffffff)] px-6 py-16 text-center shadow-sm">
                <h2 className="text-xl font-semibold text-[var(--store-background-text,#111827)]">
                  No products found
                </h2>
                <p className="mt-2 text-sm text-[var(--store-background-text,#111827)]/55">
                  We could not find any products matching “{searchResult.query}
                  ”.
                </p>
              </div>
            )
          ) : (
            <div className="mt-10 rounded-3xl border border-[var(--store-background-text,#111827)]/10 bg-[var(--store-background,#ffffff)] px-6 py-16 text-center shadow-sm">
              <h2 className="text-xl font-semibold text-[var(--store-background-text,#111827)]">
                Start a search
              </h2>
              <p className="mt-2 text-sm text-[var(--store-background-text,#111827)]/55">
                Enter a product name or keyword to see matching items.
              </p>
            </div>
          )}

          {searchResult.didYouMean && searchResult.products.length === 0 && (
            <p className="mt-4 text-sm text-[var(--store-background-text,#111827)]/55">
              Try searching for{' '}
              <span className="font-medium">{searchResult.didYouMean}</span>.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

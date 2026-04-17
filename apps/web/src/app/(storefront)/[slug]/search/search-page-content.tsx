import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { asRoute } from '@/lib/routes';
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
  const priceFormatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: merchant.payout_currency || 'NGN',
    maximumFractionDigits: 0,
  });

  return (
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
            {query
              ? `${formatResultCount(searchResult.count)} result${searchResult.count === 1 ? '' : 's'} for “${searchResult.query}”`
              : 'Enter a search term to browse matching products.'}
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
                We could not find any products matching “{searchResult.query}”.
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
  );
}

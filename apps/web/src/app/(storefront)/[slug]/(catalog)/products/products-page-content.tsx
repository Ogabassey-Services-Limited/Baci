import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StorefrontPagination } from '@/components/storefront/ogabassey/components/StorefrontPagination';
import {
  getCachedCategories,
  getRequestScopedMerchant,
} from '@/lib/cached-data';
import { getCachedStorefrontProductIndex } from '@/lib/cached-storefront-product-index';
import type { Product } from '@/lib/products';
import { asRoute } from '@/lib/routes';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
} from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { canonicalizeCategorySlug } from '@/lib/storefront-canonical-url';
import {
  parseStorefrontPageParam,
  STOREFRONT_PRODUCTS_PER_PAGE,
} from '@/lib/storefront-pagination';
import { isValidMerchantIdentifier } from '@/lib/validation';
import { ProductIndexCard } from './product-index-card';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

function getStorefrontPathPrefix(
  headersList: Awaited<ReturnType<typeof headers>>,
  merchantSlug: string
) {
  return headersList.has('x-custom-domain') ||
    headersList.has('x-merchant-slug')
    ? ''
    : `/${merchantSlug}`;
}

export async function ProductsPageContent({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const currentPage = parseStorefrontPageParam(resolvedSearchParams.page);

  if (!currentPage) {
    notFound();
  }

  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  const headersList = await headers();

  const [categories, currentProductIndex, firstPageProductIndex] =
    await Promise.all([
      getCachedCategories(merchant.id),
      getCachedStorefrontProductIndex(merchant.id, {
        page: currentPage,
        limit: STOREFRONT_PRODUCTS_PER_PAGE,
      }),
      getCachedStorefrontProductIndex(merchant.id, {
        page: 1,
        limit: STOREFRONT_PRODUCTS_PER_PAGE,
      }),
    ]);
  const totalPages = Math.max(1, currentProductIndex.totalPages || 1);

  if (!currentProductIndex.hasError && currentPage > totalPages) {
    notFound();
  }

  const baseUrl = buildStoreUrl(merchant);
  const pathPrefix = getStorefrontPathPrefix(headersList, merchant.slug);
  const description =
    merchant.site_description ||
    `Browse all products available at ${merchant.business_name}.`;
  const displayCategories = Array.from(
    new Map(
      categories
        .map((category) => {
          const canonicalSlug = canonicalizeCategorySlug(category.slug);
          if (canonicalSlug === null) {
            return null;
          }
          // Replace the raw slug with its canonical form so downstream link
          // rendering always targets the canonical category URL, even when the
          // retained duplicate happened to have odd casing or whitespace.
          return {
            ...category,
            slug: canonicalSlug,
            canonicalSlug,
          };
        })
        .filter(
          (category): category is NonNullable<typeof category> =>
            category !== null
        )
        // Key by the canonical (trimmed + lowercased) form of the merchant's
        // stored slug. This preserves distinct merchant-defined categories such
        // as `samsung` and `smartphones` so they each resolve to their own
        // category page, while still collapsing case/whitespace duplicates.
        .map((category) => [category.canonicalSlug, category])
    ).values()
  );
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: merchant.business_name, url: baseUrl },
    {
      name: 'Products',
      url:
        currentPage > 1
          ? `${baseUrl}/products?page=${currentPage}`
          : `${baseUrl}/products`,
    },
  ]);
  const collectionSchema = generateCollectionPageSchema({
    name: 'Products',
    description,
    url:
      currentPage > 1
        ? `${baseUrl}/products?page=${currentPage}`
        : `${baseUrl}/products`,
    products: currentProductIndex.products as unknown as Product[],
    merchantName: merchant.business_name,
    currency: merchant.payout_currency || 'NGN',
  });
  const priceFormatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: merchant.payout_currency || 'NGN',
    maximumFractionDigits: 0,
  });
  const rangeStart =
    currentProductIndex.totalCount === 0
      ? 0
      : (currentPage - 1) * STOREFRONT_PRODUCTS_PER_PAGE + 1;
  const rangeEnd =
    currentProductIndex.totalCount === 0
      ? 0
      : rangeStart + currentProductIndex.products.length - 1;
  const deepLinkProducts = firstPageProductIndex.products
    .filter((product) => product.slug)
    .slice(0, 18);

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(collectionSchema),
        }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbSchema),
        }}
      />

      <div className="min-h-screen bg-[color-mix(in_srgb,var(--store-background,#ffffff)_94%,var(--store-background-text,#111827)_6%)] pb-20 pt-6">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6">
          <nav className="flex items-center gap-2 text-sm text-(--store-background-text,#111827)/55">
            <Link
              href={asRoute(pathPrefix || '/')}
              prefetch={false}
              className="transition-colors hover:text-(--store-primary)"
            >
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-(--store-background-text,#111827)">
              Products
            </span>
          </nav>

          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-(--store-background-text,#111827) md:text-4xl">
                Products
              </h1>
              <p className="max-w-2xl text-sm text-(--store-background-text,#111827)/60 md:text-base">
                {description}
              </p>
            </div>

            <p className="text-sm text-(--store-background-text,#111827)/50">
              Showing {rangeStart}-{rangeEnd} of{' '}
              {currentProductIndex.totalCount} products
            </p>
          </div>

          {displayCategories.length > 0 && (
            <section className="mt-8 rounded-3xl border border-(--store-background-text,#111827)/10 bg-(--store-background,#ffffff) p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-(--store-background-text,#111827)">
                Browse Categories
              </h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {displayCategories.map((category) => (
                  <Link
                    key={category.id}
                    href={asRoute(`${pathPrefix}/${category.slug}`)}
                    prefetch={false}
                    className="rounded-full border border-(--store-background-text,#111827)/10 bg-(--store-background,#ffffff) px-4 py-2 text-sm font-medium text-(--store-background-text,#111827) transition-colors hover:border-(--store-primary) hover:text-(--store-primary)"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {currentProductIndex.products.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-(--store-background-text,#111827)/10 bg-(--store-background,#ffffff) px-6 py-16 text-center shadow-sm">
              <h2 className="text-xl font-semibold text-(--store-background-text,#111827)">
                No products available
              </h2>
              <p className="mt-2 text-sm text-(--store-background-text,#111827)/55">
                This storefront does not have any published products yet.
              </p>
            </div>
          ) : (
            <>
              {deepLinkProducts.length > 0 && (
                <section className="mt-8 rounded-3xl border border-(--store-background-text,#111827)/10 bg-(--store-background,#ffffff) p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-(--store-background-text,#111827)">
                    Popular Product Links
                  </h2>
                  <ul className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {deepLinkProducts.map((product) => {
                      const categorySlug =
                        canonicalizeCategorySlug(product.category_slug) ??
                        'products';
                      const href =
                        categorySlug === 'products'
                          ? `${pathPrefix}/products/${product.slug}`
                          : `${pathPrefix}/${categorySlug}/${product.slug}`;

                      return (
                        <li key={`deep-link-${product.id}`}>
                          <Link
                            href={asRoute(href)}
                            prefetch={false}
                            className="text-sm font-medium text-(--store-primary,#dc2626) underline-offset-4 hover:underline"
                          >
                            {product.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {currentProductIndex.products.map((product) => (
                  <ProductIndexCard
                    key={product.id}
                    formattedPrice={priceFormatter.format(product.price)}
                    pathPrefix={pathPrefix}
                    product={product}
                  />
                ))}
              </div>

              <StorefrontPagination
                ariaLabel="Products pagination"
                basePath={`${pathPrefix}/products`}
                currentPage={currentPage}
                totalPages={totalPages}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

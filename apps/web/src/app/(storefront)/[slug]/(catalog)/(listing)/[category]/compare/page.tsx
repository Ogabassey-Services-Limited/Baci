import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import type { BreadcrumbList, ItemList } from 'schema-dts';
import { JsonLd, type JsonLdData } from '@/components/seo/json-ld';
import { STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM } from '@/config/storefront-metadata-cache-bots';
import { asRoute } from '@/lib/routes';
import {
  generateBreadcrumbSchema,
  generateMetaDescription,
  getIndexableRobotsMetadata,
} from '@/lib/seo-utils';
import { buildCompareLinkGraph } from '@/lib/storefront-link-modules/compare-link-graph';
import {
  getStorefrontPathPrefix,
  resolveStorefrontPathHref,
} from '@/lib/storefront-path-prefix';
import { CompareIndexPageContent } from './compare-index-page-content';
import { loadCategoryCompareHubData } from './load-category-compare-hub-data';

interface CategoryCompareIndexPageProps {
  params: Promise<{ slug: string; category: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const COMPARE_HUB_IGNORED_SEARCH_PARAM_KEYS = new Set([
  STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM,
]);

function hasCompareHubSearchParams(searchParams: Record<string, unknown>) {
  return Object.keys(searchParams).some(
    (key) => !COMPARE_HUB_IGNORED_SEARCH_PARAM_KEYS.has(key)
  );
}

function isCanonicalCategoryCompareRequest(
  requestedCategorySlug: string,
  canonicalCategorySlug: string
) {
  return requestedCategorySlug === canonicalCategorySlug;
}

function buildCompareHubItemListSchema(input: {
  canonicalUrl: string;
  compareLinks: ReturnType<typeof buildCompareLinkGraph>;
  storeUrl: string;
}): JsonLdData<ItemList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    url: input.canonicalUrl,
    numberOfItems: input.compareLinks.length,
    itemListElement: input.compareLinks.map((link, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'WebPage',
        name: link.label,
        description: link.description,
        url: new URL(link.href, input.storeUrl).toString(),
      },
    })),
  } as JsonLdData<ItemList>;
}

function buildNoindexMetadata(input: {
  canonicalUrl?: string;
  categoryName?: string;
}): Metadata {
  const title = input.categoryName
    ? `${input.categoryName} comparisons`
    : 'Category comparisons';
  const description = input.categoryName
    ? `Compare ${input.categoryName.toLowerCase()} products by price, specs, condition, and buying fit.`
    : 'Compare products by price, specs, condition, and buying fit.';

  return {
    title,
    description,
    alternates: input.canonicalUrl
      ? {
          canonical: input.canonicalUrl,
        }
      : null,
    robots: { index: false, follow: true },
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: CategoryCompareIndexPageProps): Promise<Metadata> {
  const { slug, category } = await params;
  const resolvedSearchParams = await (searchParams ?? Promise.resolve({}));
  const data = await loadCategoryCompareHubData({
    merchantSlug: slug,
    categorySlug: category,
  });

  if (!data) {
    return buildNoindexMetadata({});
  }

  const canonicalUrl = `${data.storeUrl}/${data.categorySlug}/compare`;
  const isCanonicalCategoryPath = isCanonicalCategoryCompareRequest(
    category,
    data.categorySlug
  );
  const compareLinks = buildCompareLinkGraph({
    storeUrl: data.storeUrl,
    categorySlug: data.categorySlug,
    categoryName: data.categoryName,
    products: data.products,
    productsAreKnownActive: true,
    maxLinks: 48,
  });
  const title = `${data.categoryName} comparisons | ${data.merchant.business_name}`;
  const description = generateMetaDescription(
    `Compare ${data.categoryName.toLowerCase()} from ${data.merchant.business_name} by specs, price, condition, warranty, and buying priorities.`,
    160,
    {
      minLength: 110,
      fallback: `Compare ${data.categoryName.toLowerCase()} by specs, price, condition, warranty, and buying priorities before checkout.`,
    }
  );

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots:
      isCanonicalCategoryPath &&
      compareLinks.length > 0 &&
      !hasCompareHubSearchParams(resolvedSearchParams)
        ? getIndexableRobotsMetadata()
        : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
      siteName: data.merchant.business_name,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function CategoryCompareIndexPage({
  params,
}: CategoryCompareIndexPageProps) {
  const { slug, category } = await params;
  const data = await loadCategoryCompareHubData({
    merchantSlug: slug,
    categorySlug: category,
  });

  if (!data) {
    notFound();
  }

  const headersList = await headers();
  const pathPrefix = getStorefrontPathPrefix(headersList, data.merchant);

  if (!isCanonicalCategoryCompareRequest(category, data.categorySlug)) {
    permanentRedirect(
      asRoute(
        resolveStorefrontPathHref(pathPrefix, `/${data.categorySlug}/compare`)
      )
    );
  }

  const compareLinks = buildCompareLinkGraph({
    storeUrl: data.storeUrl,
    categorySlug: data.categorySlug,
    categoryName: data.categoryName,
    products: data.products,
    productsAreKnownActive: true,
    maxLinks: 48,
  });
  const canonicalUrl = `${data.storeUrl}/${data.categorySlug}/compare`;
  const breadcrumbSchema: JsonLdData<BreadcrumbList> = generateBreadcrumbSchema(
    [
      { name: data.merchant.business_name, url: data.storeUrl },
      { name: data.categoryName, url: `${data.storeUrl}/${data.categorySlug}` },
      { name: `${data.categoryName} comparisons`, url: canonicalUrl },
    ]
  );
  const itemListSchema = buildCompareHubItemListSchema({
    canonicalUrl,
    compareLinks,
    storeUrl: data.storeUrl,
  });

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={itemListSchema} />
      <CompareIndexPageContent
        categoryName={data.categoryName}
        categoryHref={`/${data.categorySlug}`}
        compareLinks={compareLinks}
        merchantName={data.merchant.business_name}
        pathPrefix={pathPrefix}
      />
    </>
  );
}

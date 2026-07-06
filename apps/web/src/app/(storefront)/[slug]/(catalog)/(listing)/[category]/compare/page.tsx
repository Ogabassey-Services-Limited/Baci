import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
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
const CATEGORY_COMPARE_HUB_LINK_LIMIT = 48;
const CATEGORY_COMPARE_HUB_MIN_LINKS_PER_GROUP = 6;

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

type CategoryCompareHubData = NonNullable<
  Awaited<ReturnType<typeof loadCategoryCompareHubData>>
>;

function buildCategoryCompareHubLinks(data: CategoryCompareHubData) {
  const productGroups =
    data.productGroups?.length > 0
      ? data.productGroups
      : [
          {
            categoryName: data.categoryName,
            categorySlug: data.categorySlug,
            products: data.products,
          },
        ];
  const linksPerGroup = Math.max(
    CATEGORY_COMPARE_HUB_MIN_LINKS_PER_GROUP,
    Math.ceil(CATEGORY_COMPARE_HUB_LINK_LIMIT / productGroups.length)
  );

  return productGroups
    .flatMap((group) =>
      buildCompareLinkGraph({
        storeUrl: data.storeUrl,
        categorySlug: group.categorySlug,
        categoryName: group.categoryName,
        products: group.products,
        productsAreKnownActive: true,
        maxLinks: linksPerGroup,
      })
    )
    .slice(0, CATEGORY_COMPARE_HUB_LINK_LIMIT);
}

const loadCategoryCompareHubViewData = cache(
  async (merchantSlug: string, categorySlug: string) => {
    const data = await loadCategoryCompareHubData({
      merchantSlug,
      categorySlug,
    });

    if (!data) {
      return null;
    }

    const compareLinks = buildCategoryCompareHubLinks(data);

    return {
      ...data,
      canonicalUrl: `${data.storeUrl}/${data.categorySlug}/compare`,
      compareLinks,
    };
  }
);

export async function generateMetadata({
  params,
  searchParams,
}: CategoryCompareIndexPageProps): Promise<Metadata> {
  const { slug, category } = await params;
  const resolvedSearchParams = await (searchParams ?? Promise.resolve({}));
  const data = await loadCategoryCompareHubViewData(slug, category);

  if (!data) {
    return buildNoindexMetadata({});
  }

  const isCanonicalCategoryPath = isCanonicalCategoryCompareRequest(
    category,
    data.categorySlug
  );
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
      canonical: data.canonicalUrl,
    },
    robots:
      isCanonicalCategoryPath &&
      data.compareLinks.length > 0 &&
      !hasCompareHubSearchParams(resolvedSearchParams)
        ? getIndexableRobotsMetadata()
        : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: data.canonicalUrl,
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
  const data = await loadCategoryCompareHubViewData(slug, category);

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

  const breadcrumbSchema: JsonLdData<BreadcrumbList> = generateBreadcrumbSchema(
    [
      { name: data.merchant.business_name, url: data.storeUrl },
      { name: data.categoryName, url: `${data.storeUrl}/${data.categorySlug}` },
      { name: `${data.categoryName} comparisons`, url: data.canonicalUrl },
    ]
  );
  const itemListSchema = buildCompareHubItemListSchema({
    canonicalUrl: data.canonicalUrl,
    compareLinks: data.compareLinks,
    storeUrl: data.storeUrl,
  });

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={itemListSchema} />
      <CompareIndexPageContent
        categoryName={data.categoryName}
        categoryHref={`/${data.categorySlug}`}
        compareLinks={data.compareLinks}
        merchantName={data.merchant.business_name}
        pathPrefix={pathPrefix}
      />
    </>
  );
}

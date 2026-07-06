import { cache } from 'react';
import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import {
  type CachedMerchant,
  getCachedCategoryPageData,
  getCachedProductWithDetails,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';
import { generateSlug } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { buildCommercialGuideLinks } from '@/lib/storefront-content/build-commercial-guide-links';
import type {
  InformationalGuideLink,
  SupportedClusterCategory,
} from '@/lib/storefront-content/content-cluster-types';
import { getPublishedClusterPosts } from '@/lib/storefront-content/get-published-cluster-posts';
import {
  type CompareLinkGraphEntry,
  isMaintainedCompareGraphSlug,
} from '@/lib/storefront-link-modules/compare-link-graph';
import {
  appendCountryContext,
  getCountryShoppingContext,
  getStorefrontLocale,
} from '@/lib/storefront-localization';
import { buildStorefrontMetadataTitle } from '@/lib/storefront-metadata-title';
import { evaluateStorefrontSlugSafety } from '@/lib/storefront-slug-safety';
import {
  buildProductComparisonMatrix,
  type ProductComparisonMatrix,
} from '@/lib/storefront-specs/spec-matrix';
import type { ComparableProductKeySpecs } from '@/lib/storefront-specs/spec-taxonomy';
import {
  buildBrandCompareCandidate,
  buildProductCompareCandidate,
} from './compare-eligibility';
import {
  buildCuratedCompareSlugSet,
  isCuratedCompareSlug,
} from './compare-indexability-policy';
import {
  buildRelatedCompareLinks,
  includeClickedCompareProducts,
  loadCompareGraphProducts,
} from './compare-page-link-helpers';
import { parseCompareSlug } from './compare-slugs';

interface CompareBreadcrumbItem {
  name: string;
  url: string;
}

interface CompareFAQItem {
  question: string;
  answer: string;
}

interface ComparisonRow {
  label: string;
  leftValue: string;
  rightValue: string;
}

interface ComparableCategoryProduct {
  slug: string;
  name: string;
  brand: string | null;
  price: number;
  category_slug: string;
  product_key_specs: ComparableProductKeySpecs | null;
}

interface ProductComparePageModel {
  kind: 'product';
  canonicalSlug: string;
  canonicalUrl: string;
  metaTitle: string;
  metaDescription: string;
  heading: string;
  summaryVerdict: string;
  keyDifferences: string[];
  comparisonRows: ComparisonRow[];
  comparisonMatrix: ProductComparisonMatrix;
  faqItems: CompareFAQItem[];
  breadcrumbItems: CompareBreadcrumbItem[];
  guideLinks: InformationalGuideLink[];
  relatedCompareLinks: CompareLinkGraphEntry[];
  merchant: CachedMerchant;
  isIndexable: boolean;
  isLegacyFallback: boolean;
  leftProduct: Awaited<ReturnType<typeof getCachedProductWithDetails>>;
  rightProduct: Awaited<ReturnType<typeof getCachedProductWithDetails>>;
}

interface BrandComparePageModel {
  kind: 'brand';
  canonicalSlug: string;
  canonicalUrl: string;
  metaTitle: string;
  metaDescription: string;
  heading: string;
  summaryVerdict: string;
  keyDifferences: string[];
  comparisonRows: ComparisonRow[];
  faqItems: CompareFAQItem[];
  breadcrumbItems: CompareBreadcrumbItem[];
  guideLinks: InformationalGuideLink[];
  relatedCompareLinks: CompareLinkGraphEntry[];
  merchant: CachedMerchant;
  isIndexable: boolean;
  isLegacyFallback: boolean;
  leftBrand: string;
  rightBrand: string;
}

const CURATED_COMPARE_POLICY_DOC =
  'docs/superpowers/plans/2026-06-07-ogabassey-shared-comparison-spec-matrix.md';

// Title uniqueness outranks SERP display length: Google reads the full
// <title> (SERP truncation is pixel-based display-only), while the default
// 60-char cap slices away the right-hand product's distinguishing model
// tokens and makes dozens of "X vs Y" pages share byte-identical titles.
// Cap only pathological product-name pairs.
const COMPARE_META_TITLE_MAX_LENGTH = 150;

const _comparePriceFormatterCache = new Map<string, Intl.NumberFormat>();

function getComparePriceFormatter(
  locale: string,
  currency: string
): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let formatter = _comparePriceFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    _comparePriceFormatterCache.set(key, formatter);
  }
  return formatter;
}

function isRawDbProduct(value: unknown): value is RawDbProduct {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'name' in value &&
      'price' in value
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function extractComparableKeySpecs(
  value: unknown
): ComparableProductKeySpecs | null {
  if (Array.isArray(value)) {
    const firstRecord = value.find(isRecord);
    return firstRecord ?? null;
  }

  return isRecord(value) ? value : null;
}

function buildComparisonRowsFromMatrix(
  matrix: ProductComparisonMatrix
): ComparisonRow[] {
  return matrix.flatRows
    .map((row) => ({
      label: row.label,
      leftValue: row.values[0] || '—',
      rightValue: row.values[1] || '—',
    }))
    .filter((row) => row.leftValue !== '—' || row.rightValue !== '—');
}

function buildComparableKeySpecsFromMatrix(
  matrix: ProductComparisonMatrix,
  columnIndex: number
): ComparableProductKeySpecs {
  return Object.fromEntries(
    matrix.flatRows
      .map((row) => [generateSlug(row.label), row.values[columnIndex]])
      .filter(([_key, value]) => value && value !== '—')
      .filter(([key, value]) => Boolean(key) && Boolean(value))
  );
}

function buildDifferenceSummaries(
  leftName: string,
  rightName: string,
  rows: ComparisonRow[]
) {
  const differingRows = rows.filter((row) => row.leftValue !== row.rightValue);

  if (differingRows.length === 0) {
    return [
      `${leftName} and ${rightName} overlap heavily on core specifications.`,
    ];
  }

  return differingRows
    .slice(0, 3)
    .map(
      (row) =>
        `${row.label}: ${leftName} ${row.leftValue}, ${rightName} ${row.rightValue}`
    );
}

function summarizeDifferenceLabels(keyDifferences: string[]) {
  const labels = keyDifferences
    .map((item) => item.split(':')[0]?.trim()?.toLowerCase())
    .filter((label): label is string => Boolean(label))
    .slice(0, 2);

  return labels.length > 0 ? labels.join(' and ') : 'price and specifications';
}

function formatPriceRange(
  products: ComparableCategoryProduct[],
  priceFormatter: Intl.NumberFormat
) {
  const prices = products.map((product) => product.price);

  if (prices.length === 0) {
    return '—';
  }

  return `${priceFormatter.format(Math.min(...prices))} to ${priceFormatter.format(
    Math.max(...prices)
  )}`;
}

function selectByPrice(
  products: ComparableCategoryProduct[],
  direction: 'asc' | 'desc'
) {
  return (
    products
      .slice()
      .sort((left, right) =>
        direction === 'asc'
          ? left.price - right.price
          : right.price - left.price
      )[0]?.name || '—'
  );
}

function getSupportedClusterCategory(
  categorySlug: string
): SupportedClusterCategory | null {
  return categorySlug in CONTENT_CLUSTER_SUPPORT
    ? (categorySlug as SupportedClusterCategory)
    : null;
}

function logCompareRouteMiss(details: {
  merchantSlug: string;
  categorySlug: string;
  comparisonSlug: string;
  reason: string;
  canonicalSlug?: string;
}) {
  console.warn('COMPARE_ROUTE_404', {
    ...details,
    policy: CURATED_COMPARE_POLICY_DOC,
  });
}

function logNonCuratedCompareFallback(details: {
  merchantSlug: string;
  categorySlug: string;
  comparisonSlug: string;
  canonicalSlug: string;
}) {
  console.warn('COMPARE_NON_CURATED_FALLBACK', {
    ...details,
    policy: CURATED_COMPARE_POLICY_DOC,
  });
}

function loadSupportedGuidePosts(
  merchantId: string,
  supportedClusterCategory: SupportedClusterCategory | null
) {
  return supportedClusterCategory
    ? getPublishedClusterPosts(merchantId)
    : Promise.resolve([]);
}

export function loadComparePage(args: {
  merchantSlug: string;
  categorySlug: string;
  comparisonSlug: string;
}): Promise<ProductComparePageModel | BrandComparePageModel | null> {
  return loadComparePageForRoute(
    args.merchantSlug,
    args.categorySlug,
    args.comparisonSlug
  );
}

const loadComparePageForRoute = cache(
  (merchantSlug: string, categorySlug: string, comparisonSlug: string) =>
    loadComparePageUncached({ merchantSlug, categorySlug, comparisonSlug })
);

async function loadComparePageUncached(args: {
  merchantSlug: string;
  categorySlug: string;
  comparisonSlug: string;
}): Promise<ProductComparePageModel | BrandComparePageModel | null> {
  const merchant = await getMerchantByIdentifier(args.merchantSlug);

  if (!merchant) {
    return null;
  }

  // Over-long / repeatedly-encoded bot categories can never match; bail before
  // getCachedCategoryPageData -> getCachedCategoryPageShellData
  // (`'use cache: remote'`, keyed on categorySlug) runs with an unbounded key.
  // comparisonSlug is NOT gated here: it's a composite `${left}-vs-${right}` of
  // two product slugs (each up to 200 chars), so the single-slug bound would
  // wrongly 404 legitimate long compare URLs. The parsed halves are gated after
  // parsing instead. (merchantSlug is already bounded by getMerchantByIdentifier.)
  if (!evaluateStorefrontSlugSafety(args.categorySlug).safe) {
    // Bound the logged slugs — an unsafe segment can be multi-KB and must not
    // bloat the log line (the other misses log post-gate, already-bounded slugs).
    logCompareRouteMiss({
      merchantSlug: args.merchantSlug,
      categorySlug: args.categorySlug.slice(0, 120),
      comparisonSlug: args.comparisonSlug.slice(0, 120),
      reason: 'unsafe_slug',
    });
    return null;
  }

  const parsed = parseCompareSlug(args.comparisonSlug);

  if (!parsed) {
    logCompareRouteMiss({
      ...args,
      reason: 'invalid_compare_slug',
    });
    return null;
  }

  // Gate the parsed halves (each a single product slug) before either reaches
  // getCachedProductWithDetails (`'use cache'`). A valid product slug (<=200)
  // passes; an over-long / repeatedly-encoded half from a bot `-vs-` blob does
  // not, so the unbounded value never enters the cache key.
  if (
    !evaluateStorefrontSlugSafety(parsed.leftKey).safe ||
    !evaluateStorefrontSlugSafety(parsed.rightKey).safe
  ) {
    logCompareRouteMiss({
      merchantSlug: args.merchantSlug,
      categorySlug: args.categorySlug.slice(0, 120),
      comparisonSlug: args.comparisonSlug.slice(0, 120),
      reason: 'unsafe_compare_key',
    });
    return null;
  }

  const categoryData = await getCachedCategoryPageData(
    merchant.id,
    args.categorySlug,
    args.merchantSlug
  );

  if (!categoryData || categoryData.isCollection) {
    logCompareRouteMiss({
      ...args,
      canonicalSlug: parsed.canonicalSlug,
      reason: categoryData ? 'collection_category' : 'category_not_found',
    });
    return null;
  }

  const rawProducts = ((categoryData.products ?? []) as unknown[]).filter(
    isRawDbProduct
  );
  const normalizedProducts = rawProducts.map((product) => {
    const normalizedProduct = normalizeProduct(product, {
      preferredCategorySlug: args.categorySlug,
    });

    return {
      slug: normalizedProduct.slug,
      name: normalizedProduct.name,
      brand: normalizedProduct.brand,
      price: normalizedProduct.price,
      category_slug: normalizedProduct.category_slug,
      product_key_specs: extractComparableKeySpecs(
        (product as { product_key_specs?: unknown }).product_key_specs
      ),
    };
  });

  const storeUrl = buildStoreUrl(merchant);
  const categoryName = categoryData.fallbackName || args.categorySlug;
  const canonicalUrl = `${storeUrl}/${args.categorySlug}/compare/${parsed.canonicalSlug}`;
  const supportedClusterCategory = getSupportedClusterCategory(
    args.categorySlug
  );
  const payoutCurrency = merchant.payout_currency || 'NGN';
  const priceFormatter = getComparePriceFormatter(
    getStorefrontLocale(merchant.country),
    payoutCurrency
  );
  const isCanonicalSlugRequest = args.comparisonSlug === parsed.canonicalSlug;
  const countryContext = getCountryShoppingContext(merchant.country);
  const countrySuffix = countryContext ? ` ${countryContext}` : '';
  const leftProduct = normalizedProducts.find(
    (product) => product.slug === parsed.leftKey
  );
  const rightProduct = normalizedProducts.find(
    (product) => product.slug === parsed.rightKey
  );
  const curatedCompareSlugs = buildCuratedCompareSlugSet({
    storeUrl,
    categorySlug: args.categorySlug,
    categoryName,
    products: normalizedProducts,
  });
  const isCuratedCanonicalSlug = isCuratedCompareSlug(
    parsed.canonicalSlug,
    curatedCompareSlugs
  );

  if (leftProduct && rightProduct) {
    const [leftDetails, rightDetails, guidePosts, compareGraphProducts] =
      await Promise.all([
        getCachedProductWithDetails(merchant.id, parsed.leftKey),
        getCachedProductWithDetails(merchant.id, parsed.rightKey),
        loadSupportedGuidePosts(merchant.id, supportedClusterCategory),
        loadCompareGraphProducts({
          categorySlug: args.categorySlug,
          merchantId: merchant.id,
        }),
      ]);

    if (!leftDetails || !rightDetails) {
      return null;
    }

    const comparisonMatrix = buildProductComparisonMatrix({
      products: [
        {
          ...leftDetails,
          product_key_specs: extractComparableKeySpecs(
            leftDetails.product_key_specs
          ),
        },
        {
          ...rightDetails,
          product_key_specs: extractComparableKeySpecs(
            rightDetails.product_key_specs
          ),
        },
      ],
    });
    const comparisonRows = buildComparisonRowsFromMatrix(comparisonMatrix);
    const keyDifferences = buildDifferenceSummaries(
      leftDetails.name,
      rightDetails.name,
      comparisonRows
    );
    const leftComparableKeySpecs =
      extractComparableKeySpecs(leftDetails.product_key_specs) ||
      buildComparableKeySpecsFromMatrix(comparisonMatrix, 0);
    const rightComparableKeySpecs =
      extractComparableKeySpecs(rightDetails.product_key_specs) ||
      buildComparableKeySpecsFromMatrix(comparisonMatrix, 1);
    const candidate = buildProductCompareCandidate({
      categorySlug: args.categorySlug,
      leftProduct: {
        slug: leftDetails.slug || parsed.leftKey,
        name: leftDetails.name,
        category_slug: leftProduct.category_slug,
        product_key_specs: leftComparableKeySpecs,
      },
      rightProduct: {
        slug: rightDetails.slug || parsed.rightKey,
        name: rightDetails.name,
        category_slug: rightProduct.category_slug,
        product_key_specs: rightComparableKeySpecs,
      },
    });
    const semanticCompareProducts = compareGraphProducts.products;
    const routeApprovalProducts = compareGraphProducts.failed
      ? semanticCompareProducts
      : includeClickedCompareProducts({
          products: semanticCompareProducts,
          clickedProducts: [leftProduct, rightProduct],
        });
    const isMaintainedGraphCanonicalSlug = compareGraphProducts.failed
      ? isCuratedCanonicalSlug
      : isMaintainedCompareGraphSlug({
          storeUrl,
          categorySlug: args.categorySlug,
          categoryName,
          products: routeApprovalProducts,
          productsAreKnownActive: true,
          comparisonSlug: parsed.canonicalSlug,
        });
    const isMaintainedIndexableSlug =
      isCanonicalSlugRequest && isMaintainedGraphCanonicalSlug;
    const differenceLabels = summarizeDifferenceLabels(keyDifferences);
    const breadcrumbItems = [
      { name: merchant.business_name, url: storeUrl },
      { name: categoryName, url: `${storeUrl}/${args.categorySlug}` },
      {
        name: `${leftDetails.name} vs ${rightDetails.name}`,
        url: canonicalUrl,
      },
    ];

    const compareLabel = appendCountryContext(
      `${leftDetails.name} vs ${rightDetails.name}`,
      countryContext
    );
    const relatedCompareLinks = buildRelatedCompareLinks({
      storeUrl,
      categorySlug: args.categorySlug,
      categoryName,
      products: routeApprovalProducts,
      leftProductSlug: leftDetails.slug || parsed.leftKey,
      rightProductSlug: rightDetails.slug || parsed.rightKey,
      currentComparisonSlug: parsed.canonicalSlug,
    });

    if (!isMaintainedIndexableSlug) {
      logNonCuratedCompareFallback({
        merchantSlug: args.merchantSlug,
        categorySlug: args.categorySlug,
        comparisonSlug: args.comparisonSlug,
        canonicalSlug: parsed.canonicalSlug,
      });
    }

    return {
      kind: 'product',
      canonicalSlug: parsed.canonicalSlug,
      canonicalUrl,
      // The page model stores a plain string; the route wraps it as
      // Metadata.title.absolute when composing the final Next metadata object.
      metaTitle: buildStorefrontMetadataTitle({
        title: compareLabel,
        suffix: merchant.business_name,
        fallback: categoryName,
        maxLength: COMPARE_META_TITLE_MAX_LENGTH,
      }).title,
      metaDescription: `Compare ${leftDetails.name} vs ${rightDetails.name}${countrySuffix} by price, specs, condition, warranty, delivery, and buying priorities on ${merchant.business_name}.`,
      heading: compareLabel,
      summaryVerdict: `${leftDetails.name} and ${rightDetails.name} both target ${categoryName.toLowerCase()} buyers${countrySuffix}, but the deciding factors are ${differenceLabels}.`,
      keyDifferences,
      comparisonRows,
      comparisonMatrix,
      faqItems: [
        {
          question: `Which is better${countrySuffix}, ${leftDetails.name} or ${rightDetails.name}?`,
          answer: `Use the comparison table to choose based on the price, condition, and specs that matter most to you, especially ${differenceLabels}.`,
        },
        {
          question: `Which has better value for the price${countrySuffix}?`,
          answer: `${leftDetails.name} is the better fit if its advantages in ${differenceLabels.split(' and ')[0] || 'key specifications'} matter more than the savings on ${rightDetails.name}; otherwise compare current prices and availability before buying.`,
        },
      ],
      breadcrumbItems,
      guideLinks: supportedClusterCategory
        ? buildCommercialGuideLinks({
            storeUrl,
            posts: guidePosts,
            context: {
              pageKind: 'compare',
              categorySlug: supportedClusterCategory,
              productSlugs: [
                leftDetails.slug || parsed.leftKey,
                rightDetails.slug || parsed.rightKey,
              ],
            },
          })
        : [],
      relatedCompareLinks,
      merchant,
      isIndexable: candidate.isIndexable && isMaintainedIndexableSlug,
      isLegacyFallback: !isMaintainedIndexableSlug,
      leftProduct: leftDetails,
      rightProduct: rightDetails,
    };
  }

  const brandCandidate = buildBrandCompareCandidate({
    categorySlug: args.categorySlug,
    products: normalizedProducts,
  });

  if (
    !brandCandidate ||
    brandCandidate.canonicalSlug !== parsed.canonicalSlug
  ) {
    logCompareRouteMiss({
      merchantSlug: args.merchantSlug,
      categorySlug: args.categorySlug,
      comparisonSlug: args.comparisonSlug,
      canonicalSlug: parsed.canonicalSlug,
      reason: !brandCandidate
        ? 'brand_candidate_not_found'
        : 'brand_candidate_mismatch',
    });
    return null;
  }

  const guidePosts = await loadSupportedGuidePosts(
    merchant.id,
    supportedClusterCategory
  );
  const leftBrandKey = generateSlug(brandCandidate.leftBrand);
  const rightBrandKey = generateSlug(brandCandidate.rightBrand);
  const leftBrandProducts = normalizedProducts.filter(
    (product) => generateSlug(product.brand || '') === leftBrandKey
  );
  const rightBrandProducts = normalizedProducts.filter(
    (product) => generateSlug(product.brand || '') === rightBrandKey
  );
  const comparisonRows: ComparisonRow[] = [
    {
      label: 'Active models',
      leftValue: String(leftBrandProducts.length),
      rightValue: String(rightBrandProducts.length),
    },
    {
      label: 'Price range',
      leftValue: formatPriceRange(leftBrandProducts, priceFormatter),
      rightValue: formatPriceRange(rightBrandProducts, priceFormatter),
    },
    {
      label: 'Cheapest model',
      leftValue: selectByPrice(leftBrandProducts, 'asc'),
      rightValue: selectByPrice(rightBrandProducts, 'asc'),
    },
    {
      label: 'Premium model',
      leftValue: selectByPrice(leftBrandProducts, 'desc'),
      rightValue: selectByPrice(rightBrandProducts, 'desc'),
    },
  ];
  const keyDifferences = [
    `${brandCandidate.leftBrand} has ${brandCandidate.leftBrandActiveCount} active models in this category.`,
    `${brandCandidate.rightBrand} has ${brandCandidate.rightBrandActiveCount} active models in this category.`,
    `${brandCandidate.leftBrand} ranges from ${comparisonRows[1].leftValue}, while ${brandCandidate.rightBrand} ranges from ${comparisonRows[1].rightValue}.`,
  ];
  const heading = appendCountryContext(
    `${brandCandidate.leftBrand} vs ${brandCandidate.rightBrand} ${categoryName}`,
    countryContext
  );
  const breadcrumbItems = [
    { name: merchant.business_name, url: storeUrl },
    { name: categoryName, url: `${storeUrl}/${args.categorySlug}` },
    { name: heading, url: canonicalUrl },
  ];

  const isCuratedIndexableSlug =
    isCanonicalSlugRequest && isCuratedCanonicalSlug;

  if (!isCuratedIndexableSlug) {
    logNonCuratedCompareFallback({
      merchantSlug: args.merchantSlug,
      categorySlug: args.categorySlug,
      comparisonSlug: args.comparisonSlug,
      canonicalSlug: parsed.canonicalSlug,
    });
  }

  return {
    kind: 'brand',
    canonicalSlug: parsed.canonicalSlug,
    canonicalUrl,
    // The page model stores a plain string; the route wraps it as
    // Metadata.title.absolute when composing the final Next metadata object.
    // Same higher cap as the product path: a short default cap can slice a
    // long shared categoryName prefix and collapse distinct brand-vs-brand
    // pages into duplicate titles.
    metaTitle: buildStorefrontMetadataTitle({
      title: heading,
      suffix: merchant.business_name,
      fallback: categoryName,
      maxLength: COMPARE_META_TITLE_MAX_LENGTH,
    }).title,
    metaDescription: `Compare ${brandCandidate.leftBrand} and ${brandCandidate.rightBrand} ${categoryName.toLowerCase()}${countrySuffix} by live model count, price range, warranty, delivery, and buying fit on ${merchant.business_name}.`,
    heading,
    summaryVerdict: `${brandCandidate.leftBrand} and ${brandCandidate.rightBrand} both matter for ${categoryName.toLowerCase()} shoppers${countrySuffix}, but their active model counts and price positioning differ.`,
    keyDifferences,
    comparisonRows,
    faqItems: [
      {
        question: `Which brand is better for ${categoryName.toLowerCase()}${countrySuffix}, ${brandCandidate.leftBrand} or ${brandCandidate.rightBrand}?`,
        answer: `Use the comparison table to decide whether ${brandCandidate.leftBrand}'s catalog depth or ${brandCandidate.rightBrand}'s price spread is the better fit for your budget and availability needs.`,
      },
      {
        question: `Does ${brandCandidate.leftBrand} have more options than ${brandCandidate.rightBrand}${countrySuffix}?`,
        answer: `${brandCandidate.leftBrand} currently has ${brandCandidate.leftBrandActiveCount} active models in this category, while ${brandCandidate.rightBrand} has ${brandCandidate.rightBrandActiveCount}.`,
      },
    ],
    breadcrumbItems,
    guideLinks: supportedClusterCategory
      ? buildCommercialGuideLinks({
          storeUrl,
          posts: guidePosts,
          context: {
            pageKind: 'compare',
            categorySlug: supportedClusterCategory,
            brands: [brandCandidate.leftBrand, brandCandidate.rightBrand],
          },
        })
      : [],
    relatedCompareLinks: [],
    merchant,
    isIndexable: brandCandidate.isIndexable && isCuratedIndexableSlug,
    isLegacyFallback: !isCuratedIndexableSlug,
    leftBrand: brandCandidate.leftBrand,
    rightBrand: brandCandidate.rightBrand,
  };
}

import { buildOgabasseyProductSpecData } from '@/components/storefront/ogabassey/product-spec-data';
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
  buildBrandCompareCandidate,
  buildProductCompareCandidate,
} from './compare-eligibility';
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
  faqItems: CompareFAQItem[];
  breadcrumbItems: CompareBreadcrumbItem[];
  guideLinks: InformationalGuideLink[];
  merchant: CachedMerchant;
  isIndexable: boolean;
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
  merchant: CachedMerchant;
  isIndexable: boolean;
  leftBrand: string;
  rightBrand: string;
  leftBrandProducts: ComparableCategoryProduct[];
  rightBrandProducts: ComparableCategoryProduct[];
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

function normalizeComparableKeySpecs(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function extractComparableKeySpecs(
  value: unknown
): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const firstRecord = value.find(isRecord);
    return firstRecord ?? null;
  }

  return isRecord(value) ? value : null;
}

function buildComparisonRows(
  leftSpecs: ReturnType<typeof buildOgabasseyProductSpecData>['specs'],
  rightSpecs: ReturnType<typeof buildOgabasseyProductSpecData>['specs']
) {
  return Array.from(
    new Set([
      ...leftSpecs.map((item) => item.label),
      ...rightSpecs.map((item) => item.label),
    ])
  )
    .map((label) => ({
      label,
      leftValue:
        leftSpecs.find((candidate) => candidate.label === label)?.value || '—',
      rightValue:
        rightSpecs.find((candidate) => candidate.label === label)?.value || '—',
    }))
    .filter((row) => row.leftValue !== '—' || row.rightValue !== '—');
}

function buildComparableKeySpecsFromSpecRows(
  specs: ReturnType<typeof buildOgabasseyProductSpecData>['specs']
) {
  return Object.fromEntries(
    specs
      .filter((spec) => spec.label && spec.value)
      .map((spec) => [generateSlug(spec.label), spec.value])
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

export async function loadComparePage(args: {
  merchantSlug: string;
  categorySlug: string;
  comparisonSlug: string;
}): Promise<ProductComparePageModel | BrandComparePageModel | null> {
  const merchant = await getMerchantByIdentifier(args.merchantSlug);

  if (!merchant) {
    return null;
  }

  const parsed = parseCompareSlug(args.comparisonSlug);

  if (!parsed) {
    return null;
  }

  const categoryData = await getCachedCategoryPageData(
    merchant.id,
    args.categorySlug,
    args.merchantSlug
  );

  if (!categoryData || categoryData.isCollection) {
    return null;
  }

  const rawProducts = ((categoryData.products ?? []) as unknown[]).filter(
    isRawDbProduct
  );
  const normalizedProducts = rawProducts
    .map((product) =>
      normalizeProduct(product, { preferredCategorySlug: args.categorySlug })
    )
    .map((product) => ({
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: product.price,
      category_slug: product.category_slug,
    }));

  const storeUrl = buildStoreUrl(merchant);
  const categoryName = categoryData.fallbackName || args.categorySlug;
  const canonicalUrl = `${storeUrl}/${args.categorySlug}/compare/${parsed.canonicalSlug}`;
  const guidePosts = await getPublishedClusterPosts(merchant.id);
  const supportedClusterCategory = getSupportedClusterCategory(
    args.categorySlug
  );
  const payoutCurrency = merchant.payout_currency || 'NGN';
  const priceFormatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: payoutCurrency,
    maximumFractionDigits: 0,
  });

  const leftProduct = normalizedProducts.find(
    (product) => product.slug === parsed.leftKey
  );
  const rightProduct = normalizedProducts.find(
    (product) => product.slug === parsed.rightKey
  );

  if (leftProduct && rightProduct) {
    const leftDetails = await getCachedProductWithDetails(
      merchant.id,
      parsed.leftKey
    );
    const rightDetails = await getCachedProductWithDetails(
      merchant.id,
      parsed.rightKey
    );

    if (!leftDetails || !rightDetails) {
      return null;
    }

    const leftSpecData = buildOgabasseyProductSpecData({
      ...leftDetails,
      product_key_specs: normalizeComparableKeySpecs(
        leftDetails.product_key_specs
      ),
    });
    const rightSpecData = buildOgabasseyProductSpecData({
      ...rightDetails,
      product_key_specs: normalizeComparableKeySpecs(
        rightDetails.product_key_specs
      ),
    });
    const comparisonRows = buildComparisonRows(
      leftSpecData.specs,
      rightSpecData.specs
    );
    const keyDifferences = buildDifferenceSummaries(
      leftDetails.name,
      rightDetails.name,
      comparisonRows
    );
    const leftComparableKeySpecs =
      extractComparableKeySpecs(leftDetails.product_key_specs) ||
      buildComparableKeySpecsFromSpecRows(leftSpecData.specs);
    const rightComparableKeySpecs =
      extractComparableKeySpecs(rightDetails.product_key_specs) ||
      buildComparableKeySpecsFromSpecRows(rightSpecData.specs);
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
    const differenceLabels = summarizeDifferenceLabels(keyDifferences);
    const breadcrumbItems = [
      { name: merchant.business_name, url: storeUrl },
      { name: categoryName, url: `${storeUrl}/${args.categorySlug}` },
      {
        name: `${leftDetails.name} vs ${rightDetails.name}`,
        url: canonicalUrl,
      },
    ];

    return {
      kind: 'product',
      canonicalSlug: parsed.canonicalSlug,
      canonicalUrl,
      metaTitle: `${leftDetails.name} vs ${rightDetails.name} | ${merchant.business_name}`,
      metaDescription: `Compare ${leftDetails.name} and ${rightDetails.name} across price, specs, and buying priorities on ${merchant.business_name}.`,
      heading: `${leftDetails.name} vs ${rightDetails.name}`,
      summaryVerdict: `${leftDetails.name} and ${rightDetails.name} both target ${categoryName.toLowerCase()} buyers, but the deciding factors are ${differenceLabels}.`,
      keyDifferences,
      comparisonRows,
      faqItems: [
        {
          question: `Which is better, ${leftDetails.name} or ${rightDetails.name}?`,
          answer: `Use the comparison table to choose based on the specs that matter most to you, especially ${differenceLabels}.`,
        },
        {
          question: `Is ${leftDetails.name} worth the price difference?`,
          answer: `${leftDetails.name} is the better fit if its advantages in ${differenceLabels.split(' and ')[0] || 'key specifications'} matter more than the savings on ${rightDetails.name}.`,
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
      merchant,
      isIndexable: candidate.isIndexable,
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
    return null;
  }

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
  const heading = `${brandCandidate.leftBrand} vs ${brandCandidate.rightBrand} ${categoryName}`;
  const breadcrumbItems = [
    { name: merchant.business_name, url: storeUrl },
    { name: categoryName, url: `${storeUrl}/${args.categorySlug}` },
    { name: heading, url: canonicalUrl },
  ];

  return {
    kind: 'brand',
    canonicalSlug: parsed.canonicalSlug,
    canonicalUrl,
    metaTitle: `${heading} | ${merchant.business_name}`,
    metaDescription: `Compare ${brandCandidate.leftBrand} and ${brandCandidate.rightBrand} ${categoryName.toLowerCase()} by live model count, pricing, and buying fit on ${merchant.business_name}.`,
    heading,
    summaryVerdict: `${brandCandidate.leftBrand} and ${brandCandidate.rightBrand} both matter for ${categoryName.toLowerCase()} shoppers, but their active model counts and price positioning differ.`,
    keyDifferences,
    comparisonRows,
    faqItems: [
      {
        question: `Which brand is better for ${categoryName.toLowerCase()}, ${brandCandidate.leftBrand} or ${brandCandidate.rightBrand}?`,
        answer: `Use the comparison table to decide whether ${brandCandidate.leftBrand}'s catalog depth or ${brandCandidate.rightBrand}'s price spread is the better fit.`,
      },
      {
        question: `Does ${brandCandidate.leftBrand} have more options than ${brandCandidate.rightBrand}?`,
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
    merchant,
    isIndexable: brandCandidate.isIndexable,
    leftBrand: brandCandidate.leftBrand,
    rightBrand: brandCandidate.rightBrand,
    leftBrandProducts,
    rightBrandProducts,
  };
}

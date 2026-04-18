import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import {
  getCachedCategoryPageData,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import {
  normalizeProduct,
  type ProductKeySpecsRecord,
  type RawDbProduct,
} from '@/lib/normalize-product';
import { buildStoreUrl } from '@/lib/store-url';
import { buildCommercialGuideLinks } from '@/lib/storefront-content/build-commercial-guide-links';
import type { SupportedClusterCategory } from '@/lib/storefront-content/content-cluster-types';
import { getPublishedClusterPosts } from '@/lib/storefront-content/get-published-cluster-posts';
import { isDomainIdentifier } from '@/lib/validation';
import { buildPriceBandCandidate } from './compare-eligibility';
import { getCuratedPriceBands } from './price-band-taxonomy';

interface PriceBandPageProduct {
  id: string;
  name: string;
  slug: string;
  category: string;
  category_slug: string;
  brand: string | null;
  price: number;
  condition: string;
  stock: number;
  availability: 'InStock' | 'OutOfStock';
  has_condition_offers: boolean;
  product_key_specs?: ProductKeySpecsRecord | null;
  image: string;
  description: string;
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

function isWithinBand(
  price: number,
  floor: number | undefined,
  ceiling: number
) {
  return price <= ceiling && (floor ? price > floor : true);
}

function getStorefrontPathPrefix(
  routeIdentifier: string,
  merchantSlug: string
) {
  return isDomainIdentifier(routeIdentifier) ? '' : `/${merchantSlug}`;
}

function getSupportedClusterCategory(
  categorySlug: string
): SupportedClusterCategory | null {
  return categorySlug in CONTENT_CLUSTER_SUPPORT
    ? (categorySlug as SupportedClusterCategory)
    : null;
}

export async function loadPriceBandPage(args: {
  merchantSlug: string;
  categorySlug: string;
  priceBandSlug: string;
}) {
  const merchant = await getMerchantByIdentifier(args.merchantSlug);

  if (!merchant) {
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

  const band = getCuratedPriceBands(args.categorySlug).find(
    (candidate) => candidate.slug === args.priceBandSlug
  );

  if (!band) {
    return null;
  }

  const rawProducts = ((categoryData.products ?? []) as unknown[]).filter(
    isRawDbProduct
  );
  const normalizedProducts = rawProducts.map((product) =>
    normalizeProduct(product, { preferredCategorySlug: args.categorySlug })
  );

  const bandCandidate = buildPriceBandCandidate({
    categorySlug: args.categorySlug,
    band,
    products: normalizedProducts.map((product) => ({
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: product.price,
    })),
  });

  const products: PriceBandPageProduct[] = normalizedProducts
    .filter((product) => isWithinBand(product.price, band.floor, band.ceiling))
    .map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: product.category,
      category_slug: product.category_slug,
      brand: product.brand,
      price: product.price,
      condition: product.condition,
      stock: product.stock,
      availability: product.availability,
      has_condition_offers: product.has_condition_offers ?? false,
      product_key_specs: product.product_key_specs,
      image: product.image,
      description: product.description,
    }));

  const storeUrl = buildStoreUrl(merchant);
  const guidePosts = await getPublishedClusterPosts(merchant.id);
  const categoryName = categoryData.fallbackName || args.categorySlug;
  const canonicalUrl = `${storeUrl}/${args.categorySlug}/best-under/${band.slug}`;
  const labelWithoutBest = band.label.replace(/^Best\s+/i, '');
  const supportedClusterCategory = getSupportedClusterCategory(
    args.categorySlug
  );

  return {
    merchant,
    canonicalUrl,
    metaTitle: `${band.label} | ${merchant.business_name}`,
    metaDescription: `Compare the best ${categoryName.toLowerCase()} under ${labelWithoutBest} from ${merchant.business_name}.`,
    heading: band.label,
    intro: `These are the strongest ${categoryName.toLowerCase()} options below the ${labelWithoutBest.toLowerCase()} price band.`,
    breadcrumbItems: [
      { name: merchant.business_name, url: storeUrl },
      { name: categoryName, url: `${storeUrl}/${args.categorySlug}` },
      { name: band.label, url: canonicalUrl },
    ],
    products,
    guideLinks: supportedClusterCategory
      ? buildCommercialGuideLinks({
          storeUrl,
          posts: guidePosts,
          context: {
            pageKind: 'price-band',
            categorySlug: supportedClusterCategory,
            priceBandSlug: band.slug,
          },
        })
      : [],
    isIndexable: bandCandidate.isIndexable,
    pathPrefix: getStorefrontPathPrefix(args.merchantSlug, merchant.slug),
    payoutCurrency: merchant.payout_currency || 'NGN',
  };
}

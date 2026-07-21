import { headers } from 'next/headers';
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
import { generateSlug } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { brandAuthorityTaxonomy } from '@/lib/storefront-category/brand-authority-taxonomy';
import { buildCommercialGuideLinks } from '@/lib/storefront-content/build-commercial-guide-links';
import type { SupportedClusterCategory } from '@/lib/storefront-content/content-cluster-types';
import { loadPublishedClusterPostsSafely } from '@/lib/storefront-content/load-published-cluster-posts-safely';
import { getCountryShoppingContext } from '@/lib/storefront-localization';
import { buildStorefrontMetadataTitle } from '@/lib/storefront-metadata-title';
import { evaluateStorefrontSlugSafety } from '@/lib/storefront-slug-safety';
import { isDomainIdentifier } from '@/lib/validation';

interface BrandAuthorityPageProduct {
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

async function getBrandAuthorityStorefrontPathPrefix(
  routeIdentifier: string,
  merchantSlug: string
) {
  const headersList = await headers();

  return headersList.has('x-custom-domain') ||
    headersList.has('x-merchant-slug') ||
    isDomainIdentifier(routeIdentifier)
    ? ''
    : `/${merchantSlug}`;
}

async function loadBrandAuthorityPage(
  args: {
    merchantSlug: string;
    categorySlug: string;
    brandSlug: string;
  },
  options: { includeRequestPathPrefix?: boolean } = {}
) {
  const merchant = await getMerchantByIdentifier(args.merchantSlug);
  if (!merchant) {
    return null;
  }

  if (
    !evaluateStorefrontSlugSafety(args.categorySlug).safe ||
    !evaluateStorefrontSlugSafety(args.brandSlug).safe
  ) {
    return null;
  }

  const authorityEntry = brandAuthorityTaxonomy.getEntry(
    args.categorySlug,
    args.brandSlug
  );
  if (!authorityEntry) {
    return null;
  }

  const categoryData = await getCachedCategoryPageData(
    merchant.id,
    args.categorySlug,
    args.merchantSlug
  );
  if (
    categoryData.isCollection ||
    categoryData.isInactiveCategory ||
    categoryData.productsQueryFailed
  ) {
    return null;
  }

  const normalizedProducts = ((categoryData.products ?? []) as unknown[])
    .filter(isRawDbProduct)
    .map((product) =>
      normalizeProduct(product, { preferredCategorySlug: args.categorySlug })
    )
    .filter(
      (product) => generateSlug(product.brand ?? '') === authorityEntry.brandKey
    );
  const isIndexable =
    normalizedProducts.length >= authorityEntry.minimumProducts;
  if (!isIndexable) {
    return null;
  }

  const products: BrandAuthorityPageProduct[] = normalizedProducts.map(
    (product) => ({
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
    })
  );
  const storeUrl = buildStoreUrl(merchant);
  const categoryName = categoryData.fallbackName || args.categorySlug;
  const canonicalUrl = `${storeUrl}/${args.categorySlug}/brands/${authorityEntry.brandKey}`;
  const countryContext = getCountryShoppingContext(merchant.country);
  const countrySuffix = countryContext ? ` ${countryContext}` : '';
  const heading = `${authorityEntry.displayName} Phones and Prices${countrySuffix}`;
  const supportedCategory =
    args.categorySlug in CONTENT_CLUSTER_SUPPORT
      ? (args.categorySlug as SupportedClusterCategory)
      : null;
  const guidePosts = supportedCategory
    ? await loadPublishedClusterPostsSafely(merchant.id, {
        pageKind: 'category',
        categorySlug: supportedCategory,
        brands: [authorityEntry.displayName, authorityEntry.brandKey],
      })
    : [];

  return {
    merchant,
    canonicalUrl,
    metaTitle: buildStorefrontMetadataTitle({
      title: heading,
      suffix: merchant.business_name,
      fallback: authorityEntry.displayName,
    }).title,
    metaDescription: `Compare ${products.length} active ${authorityEntry.displayName} phones, current prices, key specs, condition, and availability from ${merchant.business_name}${countrySuffix}.`,
    heading,
    intro: `Explore ${products.length} active ${authorityEntry.displayName} phones from ${merchant.business_name}. Compare current prices, specifications, condition, and availability before choosing a model.`,
    categoryName,
    brand: authorityEntry,
    products,
    guideLinks: supportedCategory
      ? buildCommercialGuideLinks({
          storeUrl,
          posts: guidePosts,
          context: {
            pageKind: 'category',
            categorySlug: supportedCategory,
            brands: [authorityEntry.displayName, authorityEntry.brandKey],
          },
        })
      : [],
    breadcrumbItems: [
      { name: merchant.business_name, url: storeUrl },
      { name: categoryName, url: `${storeUrl}/${args.categorySlug}` },
      { name: authorityEntry.displayName, url: canonicalUrl },
    ],
    categoryUrl: `${storeUrl}/${args.categorySlug}`,
    pathPrefix:
      options.includeRequestPathPrefix === false
        ? ''
        : await getBrandAuthorityStorefrontPathPrefix(
            args.merchantSlug,
            merchant.slug
          ),
  };
}

export const brandAuthorityPageLoader = {
  getStorefrontPathPrefix: getBrandAuthorityStorefrontPathPrefix,
  load: loadBrandAuthorityPage,
};

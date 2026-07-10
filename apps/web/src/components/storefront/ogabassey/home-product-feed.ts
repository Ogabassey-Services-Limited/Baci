import { deriveProductImageData } from '@baci/shared/lib';
import { prioritizeSmartphoneProducts } from '@baci/shared/storefront';
import type { Product as StorefrontProduct } from '@/lib/products';
import {
  COMPACT_OPTIONS,
  type CurrencyConfig,
  formatCurrencyWithConfig,
} from '@/lib/currency';
import { OGABASSEY_HOME_PRODUCT_FEED_LIMIT } from './config/products';
import type { Product as OgabasseyProduct } from './types';

type ConditionLabel = 'New' | 'Used' | 'Open Box' | 'New & Used';

const CONDITION_LABELS: Record<string, ConditionLabel> = {
  open_box: 'Open Box',
  new: 'New',
  used: 'Used',
};

/**
 * Platform-default currency for the home product feed — Baci's home market
 * (NGN) — used whenever a caller doesn't have a merchant-resolved currency to
 * hand (e.g. template preview mocks). Multi-tenant callers should pass the
 * merchant's resolved `CurrencyConfig` from `resolveMerchantCurrencyConfig`
 * instead of relying on this fallback.
 */
const DEFAULT_HOME_FEED_CURRENCY: CurrencyConfig = {
  code: 'NGN',
  symbol: '₦',
  locale: 'en-NG',
};

const mapCondition = (condition?: string): ConditionLabel => {
  return CONDITION_LABELS[condition || ''] || 'New';
};

export function mapStorefrontProductsToOgabasseyProducts(
  storefrontProducts: StorefrontProduct[],
  currency: CurrencyConfig = DEFAULT_HOME_FEED_CURRENCY
): OgabasseyProduct[] {
  return storefrontProducts.map((product) => {
    const {
      image,
      imageAlt,
      imagePayloads,
      images,
    } = deriveProductImageData({
      image: product.image,
      images: product.images ?? [],
    });

    const category =
      Array.isArray(product.categories) ? product.categories[0] : product.categories;
    const condition: ConditionLabel = product.has_condition_offers
      ? 'New & Used'
      : mapCondition(product.condition);

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: formatCurrencyWithConfig(product.price, currency, COMPACT_OPTIONS),
      rawPrice: product.price,
      image,
      ...(imageAlt ? { image_alt: imageAlt } : {}),
      ...(imagePayloads.length > 0 ? { image_payloads: imagePayloads } : {}),
      description: product.description,
      rating: product.rating ?? 4.5,
      category: category?.name || product.category || 'General',
      category_id: product.category_id,
      categories: category
        ? {
            id: category.id || product.category_id || `${product.id}-category`,
            name: category.name || product.category || 'General',
            slug: category.slug || product.category_slug,
            parent_id: category.parent_id,
          }
        : undefined,
      categorySlug: category?.slug || product.category_slug,
      condition,
      brand: product.brand,
      colors: product.colors,
      storage: product.storage_options?.[0],
      images,
      has_condition_offers: product.has_condition_offers,
    };
  });
}

export function createOgabasseyHomeProductFeed(
  storefrontProducts: StorefrontProduct[],
  currency: CurrencyConfig = DEFAULT_HOME_FEED_CURRENCY
): OgabasseyProduct[] {
  return mapStorefrontProductsToOgabasseyProducts(
    prioritizeSmartphoneProducts(storefrontProducts).slice(
      0,
      OGABASSEY_HOME_PRODUCT_FEED_LIMIT
    ),
    currency
  );
}

/**
 * Google Merchant Center feed XML builder.
 *
 * This module is a pure function: it takes products, merchant data, and a
 * prevalidated image manifest, and returns XML. It performs ZERO network calls.
 * All image URLs come exclusively from the `product_feed_images` manifest.
 */

import {
  normalizeCanonicalProductCondition,
  type ProductWithDefaultVariantLike,
  resolveDefaultVariantSelection,
  toGoogleListingCondition,
} from '@baci/shared/lib';
import type { FeedImageManifestEntry } from '@/lib/gmc-feed-images';
import {
  resolveGmcAdditionalImages,
  resolveGmcPrimaryImage,
} from '@/lib/gmc-feed-images';
import { getEffectiveStock } from '@/lib/product-stock';
import { stripHtmlTags } from '@/lib/sanitize-core';
import { getProductUrl } from '@/lib/seo-utils';

export interface FeedProduct {
  id: string;
  name: string;
  description: string;
  slug?: string;
  price: number;
  compare_at_price?: number;
  brand?: string;
  gtin?: string;
  mpn?: string;
  sku?: string;
  stock: number;
  stock_quantity?: number;
  manage_stock?: boolean;
  condition?: 'new' | 'used' | 'refurbished' | 'open_box' | 'uk_used';
  condition_detail?: string;
  variant_model?: 'legacy' | 'sku_matrix';
  google_product_category?: string;
  category?: string;
  category_slug?: string;
  categories?: {
    name?: string;
    slug?: string;
  } | null;
  weight_value?: number;
  weight_unit?: 'kg' | 'lb' | 'g' | 'oz';
  updated_at?: string;
  has_condition_offers?: boolean;
  offers?: FeedOffer[];
  variants?: FeedVariant[];
}

export interface FeedOffer {
  id: string;
  condition: 'new' | 'used' | 'refurbished' | 'open_box' | 'uk_used';
  price: number;
  stock_quantity: number;
}

export interface FeedVariant {
  id: string;
  attributes?: Record<string, string> | null;
  condition?: 'new' | 'used' | 'refurbished' | 'open_box' | 'uk_used' | null;
  compare_at_price?: number | null;
  price?: number | null;
  price_override?: number | null;
  sku?: string | null;
  stock_quantity?: number | null;
}

export interface FeedMerchant {
  id: string;
  business_name: string;
  country?: string;
  gmc_variants_enabled?: boolean;
  payout_currency?: string;
  slug: string;
}

/** Map of product_id → manifest entries for that product */
export type ImageManifestMap = Record<string, FeedImageManifestEntry[]>;

const UNLIMITED_STOCK_QUANTITY = 9999;
const FEED_VARIANT_TITLE_AXIS_ORDER = [
  'color',
  'storage',
  'size',
  'screen_size',
  'connectivity',
  'sim_type',
  'platform',
  'ram',
] as const;
const VALID_GMC_CONDITIONS = new Set(['new', 'used', 'refurbished'] as const);

function isValidForGmc(product: FeedProduct): boolean {
  if (!product.price || product.price <= 0) return false;
  if (!product.name || product.name.trim() === '') return false;
  return true;
}

function isValidGmcUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getFeedStockCount(product: FeedProduct): number {
  if (product.manage_stock === false) {
    return UNLIMITED_STOCK_QUANTITY;
  }

  return getEffectiveStock(product);
}

function getVariantStockCount(
  manageStock: boolean | undefined,
  variant: FeedVariant
): number {
  if (manageStock === false) {
    return UNLIMITED_STOCK_QUANTITY;
  }

  return typeof variant.stock_quantity === 'number'
    ? Math.max(0, variant.stock_quantity)
    : 0;
}

function normalizeCondition(condition?: string | null) {
  return normalizeCanonicalProductCondition(condition) || 'new';
}

function toGmcCondition(condition?: string | null) {
  const gmcCondition = toGoogleListingCondition(condition);
  return gmcCondition && VALID_GMC_CONDITIONS.has(gmcCondition)
    ? gmcCondition
    : 'new';
}

function formatConditionTitle(condition?: string | null) {
  const normalizedCondition = normalizeCondition(condition);
  switch (normalizedCondition) {
    case 'used':
      return 'Used';
    case 'open_box':
      return 'Open Box';
    default:
      return 'New';
  }
}

function buildVariantUrl(productUrl: string, variant: FeedVariant) {
  const params = new URLSearchParams();
  params.set('variantId', variant.id);

  if (variant.condition) {
    params.set('condition', normalizeCondition(variant.condition));
  }

  for (const axis of Object.keys(variant.attributes || {}).sort()) {
    const value = variant.attributes?.[axis];
    if (value) {
      params.set(axis, value);
    }
  }

  return `${productUrl}?${params.toString()}`;
}

function buildVariantTitle(product: FeedProduct, variant: FeedVariant) {
  const attributes = variant.attributes || {};
  const prioritizedAxes = FEED_VARIANT_TITLE_AXIS_ORDER.filter(
    (axis) => typeof attributes[axis] === 'string' && attributes[axis]?.trim()
  );
  const remainingAxes = Object.keys(attributes)
    .filter((axis) => !prioritizedAxes.includes(axis as never))
    .sort();
  const titleParts = [
    ...prioritizedAxes.map((axis) => attributes[axis].trim()),
    ...remainingAxes
      .map((axis) => attributes[axis]?.trim())
      .filter((value): value is string => Boolean(value)),
    formatConditionTitle(variant.condition),
  ].filter(Boolean);

  return titleParts.length > 0
    ? `${product.name} - ${titleParts.join(' - ')}`
    : product.name;
}

function getConditionedVariants(product: FeedProduct) {
  return (product.variants || []).filter((variant) =>
    Boolean(variant.condition)
  );
}

function resolveSkuMatrixFallback(product: FeedProduct) {
  const conditionedVariants = getConditionedVariants(product).filter(
    (variant) => (variant.price_override ?? product.price) > 0
  );
  if (conditionedVariants.length === 0) {
    return null;
  }

  const defaultSelection = resolveDefaultVariantSelection({
    price: product.price,
    compare_at_price: product.compare_at_price,
    condition: product.condition,
    manage_stock: product.manage_stock,
    variants: conditionedVariants.map((variant) => ({
      id: variant.id,
      attributes: variant.attributes,
      condition: variant.condition,
      price_override: variant.price_override,
      stock_quantity: variant.stock_quantity,
    })),
  } satisfies ProductWithDefaultVariantLike<FeedVariant>);

  return defaultSelection
    ? {
        availability:
          getVariantStockCount(product.manage_stock, defaultSelection.variant) >
          0
            ? 'in_stock'
            : 'out_of_stock',
        condition: toGmcCondition(defaultSelection.condition),
        price: defaultSelection.price,
        stockCount: getVariantStockCount(
          product.manage_stock,
          defaultSelection.variant
        ),
      }
    : null;
}

function buildBaseItemXml(args: {
  additionalImagesXml: string;
  availability: string;
  brandName: string;
  compareAtPrice?: number;
  condition: string;
  currency: string;
  description: string;
  googleProductCategory?: string;
  id: string;
  imageUrl: string;
  price: number;
  productType?: string;
  shippingWeight: string;
  stockCount: number;
  title: string;
  url: string;
  gtin?: string;
  mpn?: string;
}) {
  const formattedPrice = args.price.toFixed(2);
  const priceLines =
    typeof args.compareAtPrice === 'number' && args.compareAtPrice > args.price
      ? [
          `        <g:sale_price>${formattedPrice} ${args.currency}</g:sale_price>`,
          `        <g:price>${args.compareAtPrice.toFixed(2)} ${args.currency}</g:price>`,
        ]
      : [`        <g:price>${formattedPrice} ${args.currency}</g:price>`];
  const lines = [
    `        <g:id>${escapeXml(args.id)}</g:id>`,
    `        <g:title>${escapeXml(args.title)}</g:title>`,
    `        <g:description>${escapeXml(args.description)}</g:description>`,
    `        <g:link>${escapeXml(args.url)}</g:link>`,
    `        <g:image_link>${escapeXml(args.imageUrl)}</g:image_link>`,
    args.additionalImagesXml,
    `        <g:availability>${args.availability}</g:availability>`,
    `        <g:quantity>${args.stockCount}</g:quantity>`,
    ...priceLines,
    `        <g:brand>${escapeXml(args.brandName)}</g:brand>`,
    `        <g:condition>${args.condition}</g:condition>`,
    args.gtin ? `        <g:gtin>${escapeXml(args.gtin)}</g:gtin>` : '',
    args.mpn ? `        <g:mpn>${escapeXml(args.mpn)}</g:mpn>` : '',
    args.gtin || (args.mpn && args.brandName)
      ? '        <g:identifier_exists>yes</g:identifier_exists>'
      : '        <g:identifier_exists>no</g:identifier_exists>',
    args.googleProductCategory
      ? `        <g:google_product_category>${escapeXml(args.googleProductCategory)}</g:google_product_category>`
      : '',
    args.productType
      ? `        <g:product_type>${escapeXml(args.productType)}</g:product_type>`
      : '',
    args.shippingWeight,
  ].filter(Boolean);

  return `    <item>\n${lines.join('\n')}\n    </item>`;
}

function buildPriceLines(args: {
  compareAtPrice?: number | null;
  currency: string;
  price: number;
}) {
  const formattedPrice = args.price.toFixed(2);

  if (
    typeof args.compareAtPrice === 'number' &&
    args.compareAtPrice > args.price
  ) {
    return [
      `        <g:sale_price>${formattedPrice} ${args.currency}</g:sale_price>`,
      `        <g:price>${args.compareAtPrice.toFixed(2)} ${args.currency}</g:price>`,
    ];
  }

  return [`        <g:price>${formattedPrice} ${args.currency}</g:price>`];
}

/**
 * Generate Google Merchant Center XML feed.
 *
 * Images are resolved exclusively from the prevalidated manifest.
 * Products without a verified primary image are excluded entirely.
 * This function performs zero network calls.
 */
export function generateGoogleMerchantFeed(
  products: FeedProduct[],
  merchant: FeedMerchant,
  baseUrl: string,
  imageManifest: ImageManifestMap
): string {
  const currency = merchant.payout_currency || 'USD';
  const brandName = merchant.business_name;
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  const validProducts = products.filter(isValidForGmc);

  const items = validProducts
    .map((product) => {
      const productUrl = `${normalizedBaseUrl}${getProductUrl(product)}`;
      if (!isValidGmcUrl(productUrl)) return null;

      // Resolve images from prevalidated manifest only
      const manifestEntries = imageManifest[product.id] || [];
      const primaryImageUrl = resolveGmcPrimaryImage(manifestEntries);

      // Skip products without a verified primary image — never emit blank g:image_link
      if (!primaryImageUrl) return null;

      const additionalImageUrls = resolveGmcAdditionalImages(manifestEntries);
      const additionalImagesXml = additionalImageUrls
        .map(
          (url) =>
            `        <g:additional_image_link>${escapeXml(url)}</g:additional_image_link>`
        )
        .join('\n');
      const description = stripHtmlTags(product.description).trim();
      const shippingWeight =
        product.weight_value && product.weight_unit
          ? `        <g:shipping_weight>${product.weight_value} ${product.weight_unit}</g:shipping_weight>`
          : '';
      const effectiveBrand = product.brand || brandName;
      const conditionedVariants = getConditionedVariants(product);
      const shouldEmitVariantRows =
        merchant.gmc_variants_enabled === true &&
        product.variant_model === 'sku_matrix' &&
        conditionedVariants.length > 0;

      if (shouldEmitVariantRows) {
        const eligibleVariants = conditionedVariants.filter((variant) => {
          const effectivePrice = variant.price_override ?? product.price;
          return Boolean(variant.id) && effectivePrice > 0;
        });

        if (eligibleVariants.length > 0) {
          return eligibleVariants
            .map((variant) => {
              const effectivePrice =
                variant.price_override ?? variant.price ?? product.price;
              const effectiveCompareAtPrice =
                variant.compare_at_price ?? product.compare_at_price;
              const stockCount = getVariantStockCount(
                product.manage_stock,
                variant
              );
              const availability = stockCount > 0 ? 'in_stock' : 'out_of_stock';
              const lines = [
                `        <g:id>${escapeXml(variant.id)}</g:id>`,
                `        <g:item_group_id>${escapeXml(product.id)}</g:item_group_id>`,
                `        <g:title>${escapeXml(buildVariantTitle(product, variant))}</g:title>`,
                `        <g:description>${escapeXml(description)}</g:description>`,
                `        <g:link>${escapeXml(buildVariantUrl(productUrl, variant))}</g:link>`,
                `        <g:canonical_link>${escapeXml(productUrl)}</g:canonical_link>`,
                `        <g:image_link>${escapeXml(primaryImageUrl)}</g:image_link>`,
                additionalImagesXml,
                `        <g:availability>${availability}</g:availability>`,
                `        <g:quantity>${stockCount}</g:quantity>`,
                ...buildPriceLines({
                  compareAtPrice: effectiveCompareAtPrice,
                  currency,
                  price: effectivePrice,
                }),
                `        <g:brand>${escapeXml(effectiveBrand)}</g:brand>`,
                `        <g:condition>${toGmcCondition(variant.condition)}</g:condition>`,
                product.gtin
                  ? `        <g:gtin>${escapeXml(product.gtin)}</g:gtin>`
                  : '',
                product.mpn
                  ? `        <g:mpn>${escapeXml(product.mpn)}</g:mpn>`
                  : '',
                product.gtin || (product.mpn && effectiveBrand)
                  ? '        <g:identifier_exists>yes</g:identifier_exists>'
                  : '        <g:identifier_exists>no</g:identifier_exists>',
                product.google_product_category
                  ? `        <g:google_product_category>${escapeXml(product.google_product_category)}</g:google_product_category>`
                  : '',
                product.category
                  ? `        <g:product_type>${escapeXml(product.category)}</g:product_type>`
                  : '',
                shippingWeight,
              ].filter(Boolean);

              return `    <item>\n${lines.join('\n')}\n    </item>`;
            })
            .join('\n');
        }
      }

      const skuMatrixFallback =
        product.variant_model === 'sku_matrix'
          ? resolveSkuMatrixFallback(product)
          : null;
      if (skuMatrixFallback) {
        return buildBaseItemXml({
          additionalImagesXml,
          availability: skuMatrixFallback.availability,
          brandName: effectiveBrand,
          compareAtPrice: product.compare_at_price,
          condition: skuMatrixFallback.condition,
          currency,
          description,
          googleProductCategory: product.google_product_category,
          gtin: product.gtin,
          id: product.id,
          imageUrl: primaryImageUrl,
          mpn: product.mpn,
          price: skuMatrixFallback.price,
          productType: product.category,
          shippingWeight,
          stockCount: skuMatrixFallback.stockCount,
          title: product.name,
          url: productUrl,
        });
      }

      const baseItem = buildBaseItemXml({
        additionalImagesXml,
        availability:
          getFeedStockCount(product) > 0 ? 'in_stock' : 'out_of_stock',
        brandName: effectiveBrand,
        compareAtPrice: product.compare_at_price,
        condition: toGmcCondition(product.condition),
        currency,
        description,
        googleProductCategory: product.google_product_category,
        gtin: product.gtin,
        id: product.id,
        imageUrl: primaryImageUrl,
        mpn: product.mpn,
        price: product.price,
        productType: product.category,
        shippingWeight,
        stockCount: getFeedStockCount(product),
        title: product.name,
        url: productUrl,
      });

      if (
        product.variant_model === 'sku_matrix' ||
        !product.offers ||
        product.offers.length === 0
      ) {
        return baseItem;
      }

      const offerItems = product.offers
        .filter((offer) => offer.id && offer.price > 0)
        .map((offer) => {
          const offerStock =
            offer.stock_quantity > 0 ? offer.stock_quantity : 0;
          const offerAvailability =
            offerStock > 0 ? 'in_stock' : 'out_of_stock';

          const offerLines = [
            `        <g:id>${escapeXml(offer.id)}</g:id>`,
            `        <g:item_group_id>${escapeXml(product.id)}</g:item_group_id>`,
            `        <g:title>${escapeXml(product.name)}</g:title>`,
            `        <g:description>${escapeXml(description)}</g:description>`,
            `        <g:link>${escapeXml(`${productUrl}?condition=${offer.condition}`)}</g:link>`,
            `        <g:canonical_link>${escapeXml(productUrl)}</g:canonical_link>`,
            `        <g:image_link>${escapeXml(primaryImageUrl)}</g:image_link>`,
            additionalImagesXml,
            `        <g:availability>${offerAvailability}</g:availability>`,
            `        <g:quantity>${offerStock}</g:quantity>`,
            `        <g:price>${offer.price.toFixed(2)} ${currency}</g:price>`,
            `        <g:brand>${escapeXml(effectiveBrand)}</g:brand>`,
            `        <g:condition>${toGmcCondition(offer.condition)}</g:condition>`,
            product.gtin
              ? `        <g:gtin>${escapeXml(product.gtin)}</g:gtin>`
              : '',
            product.mpn
              ? `        <g:mpn>${escapeXml(product.mpn)}</g:mpn>`
              : '',
            product.gtin || (product.mpn && effectiveBrand)
              ? '        <g:identifier_exists>yes</g:identifier_exists>'
              : '        <g:identifier_exists>no</g:identifier_exists>',
            product.google_product_category
              ? `        <g:google_product_category>${escapeXml(product.google_product_category)}</g:google_product_category>`
              : '',
            product.category
              ? `        <g:product_type>${escapeXml(product.category)}</g:product_type>`
              : '',
            shippingWeight,
          ].filter(Boolean);

          return `    <item>\n${offerLines.join('\n')}\n    </item>`;
        });

      return [baseItem, ...offerItems].join('\n');
    })
    .filter(Boolean)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(brandName)} - Product Feed</title>
    <link>${escapeXml(normalizedBaseUrl)}</link>
    <description>Product feed for ${escapeXml(brandName)}</description>
${items}
  </channel>
</rss>`;
}

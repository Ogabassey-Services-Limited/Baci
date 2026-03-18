/**
 * Google Merchant Center feed XML builder.
 *
 * This module is a pure function: it takes products, merchant data, and a
 * prevalidated image manifest, and returns XML. It performs ZERO network calls.
 * All image URLs come exclusively from the `product_feed_images` manifest.
 */

import type { FeedImageManifestEntry } from '@/lib/gmc-feed-images';
import {
  resolveGmcAdditionalImages,
  resolveGmcPrimaryImage,
} from '@/lib/gmc-feed-images';
import { stripHtmlTags } from '@/lib/sanitize-core';
import { buildProductUrl } from '@/lib/seo-utils';
import {
  buildProductDetailXml,
  type FeedKeySpecs,
  hasGmcVariantAxis,
  mapVariantToGmcAttributes,
} from './variant-mapping';

export interface FeedVariant {
  id: string;
  sku?: string;
  attributes: Record<string, string>;
  price_override?: number;
  stock_quantity: number;
}

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
  condition?: 'new' | 'used' | 'refurbished';
  google_product_category?: string;
  category?: string;
  categories?: { name?: string; slug?: string } | null;
  weight_value?: number;
  weight_unit?: 'kg' | 'lb' | 'g' | 'oz';
  updated_at?: string;
  variants?: FeedVariant[];
  key_specs?: FeedKeySpecs;
}

export interface FeedMerchant {
  id: string;
  business_name: string;
  country?: string;
  payout_currency?: string;
  slug: string;
}

/** Map of product_id → manifest entries for that product */
export type ImageManifestMap = Record<string, FeedImageManifestEntry[]>;

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

/**
 * Build the canonical product URL path using the category slug.
 * Uses buildProductUrl from seo-utils which handles FK join slug → legacy text fallback.
 */
function buildProductLink(
  normalizedBaseUrl: string,
  product: FeedProduct
): string {
  const productPath = buildProductUrl(
    product.slug || product.id,
    product.categories || product.category || null,
    null
  );
  return `${normalizedBaseUrl}${productPath}`;
}

/**
 * Build shared XML lines that are common between standalone items and variant items.
 */
function buildSharedItemLines(
  product: FeedProduct,
  primaryImageUrl: string,
  additionalImagesXml: string,
  effectiveBrand: string,
  currency: string,
  shippingWeight: string,
  overrides?: {
    id?: string;
    title?: string;
    link?: string;
    price?: number;
    stock?: number;
    itemGroupId?: string;
    color?: string;
    size?: string;
    canonicalLink?: string;
    productDetailXml?: string;
    mpn?: string;
  }
): string[] {
  const id = overrides?.id ?? product.id;
  const title = overrides?.title ?? product.name;
  const link = overrides?.link ?? '';
  const price = overrides?.price ?? product.price;
  const stock =
    overrides?.stock ?? (typeof product.stock === 'number' ? product.stock : 0);
  const availability = stock > 0 ? 'in_stock' : 'out_of_stock';
  const condition = product.condition || 'new';
  const formattedPrice = price.toFixed(2);

  const salePrice =
    product.compare_at_price && product.compare_at_price > price
      ? `        <g:sale_price>${formattedPrice} ${currency}</g:sale_price>\n        <g:price>${product.compare_at_price.toFixed(2)} ${currency}</g:price>`
      : `        <g:price>${formattedPrice} ${currency}</g:price>`;

  const lines = [
    `        <g:id>${escapeXml(id)}</g:id>`,
    overrides?.itemGroupId
      ? `        <g:item_group_id>${escapeXml(overrides.itemGroupId)}</g:item_group_id>`
      : '',
    `        <g:title>${escapeXml(title)}</g:title>`,
    `        <g:description>${escapeXml(stripHtmlTags(product.description).trim())}</g:description>`,
    `        <g:link>${escapeXml(link)}</g:link>`,
    overrides?.canonicalLink
      ? `        <g:canonical_link>${escapeXml(overrides.canonicalLink)}</g:canonical_link>`
      : '',
    `        <g:image_link>${escapeXml(primaryImageUrl)}</g:image_link>`,
    additionalImagesXml,
    `        <g:availability>${availability}</g:availability>`,
    `        <g:quantity>${stock}</g:quantity>`,
    salePrice,
    `        <g:brand>${escapeXml(effectiveBrand)}</g:brand>`,
    `        <g:condition>${condition}</g:condition>`,
    overrides?.color
      ? `        <g:color>${escapeXml(overrides.color)}</g:color>`
      : '',
    overrides?.size
      ? `        <g:size>${escapeXml(overrides.size)}</g:size>`
      : '',
    product.gtin ? `        <g:gtin>${escapeXml(product.gtin)}</g:gtin>` : '',
    overrides?.mpn
      ? `        <g:mpn>${escapeXml(overrides.mpn)}</g:mpn>`
      : product.mpn
        ? `        <g:mpn>${escapeXml(product.mpn)}</g:mpn>`
        : '',
    product.gtin || ((overrides?.mpn || product.mpn) && effectiveBrand)
      ? '        <g:identifier_exists>yes</g:identifier_exists>'
      : '        <g:identifier_exists>no</g:identifier_exists>',
    product.google_product_category
      ? `        <g:google_product_category>${escapeXml(product.google_product_category)}</g:google_product_category>`
      : '',
    product.category
      ? `        <g:product_type>${escapeXml(product.category)}</g:product_type>`
      : '',
    shippingWeight,
    overrides?.productDetailXml ?? '',
  ];

  return lines.filter(Boolean);
}

/**
 * Build a variant title with differentiators appended.
 * e.g., "iPhone 16 - Blue - 128GB"
 */
function buildVariantTitle(
  baseName: string,
  gmcAttrs: { color?: string; size?: string }
): string {
  const parts = [baseName];
  if (gmcAttrs.color) parts.push(gmcAttrs.color);
  if (gmcAttrs.size) parts.push(gmcAttrs.size);
  return parts.join(' - ');
}

/**
 * Generate Google Merchant Center XML feed.
 *
 * Images are resolved exclusively from the prevalidated manifest.
 * Products without a verified primary image are excluded entirely.
 * This function performs zero network calls.
 *
 * When a product has variants with at least one mappable GMC axis (color/size),
 * one <item> is emitted per variant with item_group_id grouping. Products
 * without mappable variants emit a single item (Phase 1 behavior).
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

  const itemXmls: string[] = [];

  for (const product of validProducts) {
    const productUrl = buildProductLink(normalizedBaseUrl, product);
    if (!isValidGmcUrl(productUrl)) continue;

    // Resolve images from prevalidated manifest only
    const manifestEntries = imageManifest[product.id] || [];
    const primaryImageUrl = resolveGmcPrimaryImage(manifestEntries);

    // Skip products without a verified primary image — never emit blank g:image_link
    if (!primaryImageUrl) continue;

    const additionalImageUrls = resolveGmcAdditionalImages(manifestEntries);
    const additionalImagesXml = additionalImageUrls
      .map(
        (url) =>
          `        <g:additional_image_link>${escapeXml(url)}</g:additional_image_link>`
      )
      .join('\n');

    const effectiveBrand = product.brand || brandName;
    const shippingWeight =
      product.weight_value && product.weight_unit
        ? `        <g:shipping_weight>${product.weight_value} ${product.weight_unit}</g:shipping_weight>`
        : '';

    const productDetailXml = product.key_specs
      ? buildProductDetailXml(product.key_specs)
      : '';

    // Check if product has variants with at least one mappable GMC axis
    const variants = product.variants || [];
    const mappableVariants = variants.filter((v) =>
      hasGmcVariantAxis(v.attributes)
    );

    if (mappableVariants.length > 0) {
      // Emit one <item> per variant — suppress standalone product item
      const seenVariantIds = new Set<string>();

      for (const variant of mappableVariants) {
        if (seenVariantIds.has(variant.id)) continue;
        seenVariantIds.add(variant.id);

        const gmcAttrs = mapVariantToGmcAttributes(variant.attributes);
        const variantUrl = `${productUrl}?variant=${encodeURIComponent(variant.id)}`;
        const variantPrice =
          typeof variant.price_override === 'number' &&
          Number.isFinite(variant.price_override) &&
          variant.price_override > 0
            ? variant.price_override
            : product.price;
        const variantStock =
          typeof variant.stock_quantity === 'number' &&
          Number.isFinite(variant.stock_quantity) &&
          variant.stock_quantity > 0
            ? variant.stock_quantity
            : 0;

        const lines = buildSharedItemLines(
          product,
          primaryImageUrl,
          additionalImagesXml,
          effectiveBrand,
          currency,
          shippingWeight,
          {
            id: variant.id,
            itemGroupId: product.id,
            title: buildVariantTitle(product.name, gmcAttrs),
            link: variantUrl,
            canonicalLink: productUrl,
            price: variantPrice,
            stock: variantStock,
            color: gmcAttrs.color,
            size: gmcAttrs.size,
            productDetailXml,
            mpn: variant.sku,
          }
        );

        itemXmls.push(`    <item>\n${lines.join('\n')}\n    </item>`);
      }
    } else {
      // No mappable variants → single item (Phase 1 behavior)
      const lines = buildSharedItemLines(
        product,
        primaryImageUrl,
        additionalImagesXml,
        effectiveBrand,
        currency,
        shippingWeight,
        {
          link: productUrl,
          productDetailXml,
        }
      );

      itemXmls.push(`    <item>\n${lines.join('\n')}\n    </item>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(brandName)} - Product Feed</title>
    <link>${escapeXml(normalizedBaseUrl)}</link>
    <description>Product feed for ${escapeXml(brandName)}</description>
${itemXmls.join('\n')}
  </channel>
</rss>`;
}

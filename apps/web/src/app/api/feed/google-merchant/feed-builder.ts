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
  condition?: 'new' | 'used' | 'refurbished';
  google_product_category?: string;
  category?: string;
  weight_value?: number;
  weight_unit?: 'kg' | 'lb' | 'g' | 'oz';
  updated_at?: string;
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

  const validProducts = products.filter(isValidForGmc);

  const items = validProducts
    .map((product) => {
      const productUrl = `${baseUrl}/products/${product.slug || product.id}`;
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

      const stockCount = typeof product.stock === 'number' ? product.stock : 0;
      const availability = stockCount > 0 ? 'in_stock' : 'out_of_stock';
      const condition = product.condition || 'new';
      const formattedPrice = product.price.toFixed(2);

      const salePrice =
        product.compare_at_price && product.compare_at_price > product.price
          ? `        <g:sale_price>${formattedPrice} ${currency}</g:sale_price>\n        <g:price>${product.compare_at_price.toFixed(2)} ${currency}</g:price>`
          : `        <g:price>${formattedPrice} ${currency}</g:price>`;

      const shippingWeight =
        product.weight_value && product.weight_unit
          ? `        <g:shipping_weight>${product.weight_value} ${product.weight_unit}</g:shipping_weight>`
          : '';

      return `    <item>
        <g:id>${escapeXml(product.id)}</g:id>
        <g:title>${escapeXml(product.name)}</g:title>
        <g:description>${escapeXml(stripHtmlTags(product.description).trim())}</g:description>
        <g:link>${escapeXml(productUrl)}</g:link>
        <g:image_link>${escapeXml(primaryImageUrl)}</g:image_link>
${additionalImagesXml}
        <g:availability>${availability}</g:availability>
        <g:quantity>${stockCount}</g:quantity>
${salePrice}
        <g:brand>${escapeXml(product.brand || brandName)}</g:brand>
        <g:condition>${condition}</g:condition>
${product.gtin ? `        <g:gtin>${escapeXml(product.gtin)}</g:gtin>` : ''}
${product.mpn ? `        <g:mpn>${escapeXml(product.mpn)}</g:mpn>` : ''}
${product.gtin || product.mpn || product.brand ? '        <g:identifier_exists>yes</g:identifier_exists>' : '        <g:identifier_exists>no</g:identifier_exists>'}
${product.google_product_category ? `        <g:google_product_category>${escapeXml(product.google_product_category)}</g:google_product_category>` : ''}
${product.category ? `        <g:product_type>${escapeXml(product.category)}</g:product_type>` : ''}
${shippingWeight}
    </item>`;
    })
    .filter(Boolean)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(brandName)} - Product Feed</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Product feed for ${escapeXml(brandName)}</description>
${items}
  </channel>
</rss>`;
}

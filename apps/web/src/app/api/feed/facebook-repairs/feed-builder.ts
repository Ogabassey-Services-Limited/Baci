import type { RepairFeedItem } from '@/lib/storefront-repairs/repairs-feed-data';
import { escapeXml } from '@/lib/xml-utils';

export interface RepairsFeedMerchant {
  business_name: string;
  payout_currency?: string | null;
  logo_url?: string | null;
}

const REPAIRS_FEED_UTM_QUERY =
  'utm_source=facebook&utm_medium=feed&utm_campaign=repairs_catalog';
// Placeholder Google product taxonomy path for repair services. Meta treats
// service-as-product listings as policy-gray — validate this feed in a Meta
// Commerce Manager test catalog before pointing a live page at it.
const REPAIRS_GOOGLE_PRODUCT_CATEGORY =
  'Service > Repair & Installation Service';

function buildDeviceLink(baseUrl: string, deviceSlug: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  return `${normalizedBaseUrl}/repairs/${deviceSlug}?${REPAIRS_FEED_UTM_QUERY}`;
}

function buildItemTitle(item: RepairFeedItem): string {
  return `${item.deviceBrand} ${item.deviceModel} ${item.serviceTypeName}`.trim();
}

function buildItemDescription(
  item: RepairFeedItem,
  merchantName: string
): string {
  return (
    item.description ||
    `${buildItemTitle(item)} repair service from ${merchantName}. Transparent, upfront pricing.`
  );
}

function resolveItemImage(
  item: RepairFeedItem,
  fallbackImageUrl: string | null
): string | null {
  return item.productImageUrl || item.deviceImageUrl || fallbackImageUrl;
}

function buildItemXml(args: {
  currency: string;
  imageUrl: string;
  item: RepairFeedItem;
  link: string;
  merchantName: string;
}): string {
  const { currency, imageUrl, item, link, merchantName } = args;

  const lines = [
    `        <g:id>${escapeXml(item.quoteId)}</g:id>`,
    `        <g:title>${escapeXml(buildItemTitle(item))}</g:title>`,
    `        <g:description>${escapeXml(buildItemDescription(item, merchantName))}</g:description>`,
    // Repair slots are always bookable — there is no inventory concept for a
    // service quote, unlike physical product stock.
    '        <g:availability>in stock</g:availability>',
    `        <g:price>${item.price.toFixed(2)} ${currency}</g:price>`,
    `        <g:link>${escapeXml(link)}</g:link>`,
    `        <g:image_link>${escapeXml(imageUrl)}</g:image_link>`,
    `        <g:brand>${escapeXml(merchantName)}</g:brand>`,
    '        <g:condition>new</g:condition>',
    `        <g:google_product_category>${escapeXml(REPAIRS_GOOGLE_PRODUCT_CATEGORY)}</g:google_product_category>`,
  ];

  return `    <item>\n${lines.join('\n')}\n    </item>`;
}

/**
 * Builds a Meta (Facebook/Instagram) Commerce Manager-compatible RSS/XML
 * catalog feed, one `<item>` per active repair quote. Mirrors
 * `generateFacebookCatalogFeed` (the product feed) structurally.
 */
export function generateRepairsFacebookFeed(
  items: RepairFeedItem[],
  merchant: RepairsFeedMerchant,
  baseUrl: string
): string {
  const currency = merchant.payout_currency || 'NGN';
  const brandName = merchant.business_name;
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const fallbackImageUrl = merchant.logo_url || null;

  const xmlItems = items
    .map((item) => {
      const imageUrl = resolveItemImage(item, fallbackImageUrl);
      if (!imageUrl) {
        return null;
      }

      return buildItemXml({
        currency,
        imageUrl,
        item,
        link: buildDeviceLink(normalizedBaseUrl, item.deviceSlug),
        merchantName: brandName,
      });
    })
    .filter(Boolean)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(brandName)} - Repairs Catalog Feed</title>
    <link>${escapeXml(normalizedBaseUrl)}</link>
    <description>Device repair services catalog for ${escapeXml(brandName)}</description>
${xmlItems}
  </channel>
</rss>`;
}

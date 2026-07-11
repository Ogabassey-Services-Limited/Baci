import type { RepairFeedItem } from './repairs-feed-data';

export interface AgentRepairsFeedMerchant {
  business_name: string;
  payout_currency?: string | null;
  logo_url?: string | null;
}

export interface AgentRepairsFeedEntry {
  id: string;
  type: 'repair_service';
  title: string;
  service_type: string;
  device: string;
  device_brand: string;
  device_model: string;
  price: number;
  price_currency: string;
  is_from_price: boolean;
  availability: 'in_stock';
  link: string;
  image_link?: string;
  description?: string;
  merchant_name: string;
  related_product_id?: string;
}

const REPAIRS_FEED_UTM_QUERY =
  'utm_source=agent&utm_medium=feed&utm_campaign=repairs_catalog';

function buildDeviceLink(baseUrl: string, deviceSlug: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  return `${normalizedBaseUrl}/repairs/${deviceSlug}?${REPAIRS_FEED_UTM_QUERY}`;
}

function buildTitle(item: RepairFeedItem): string {
  return `${item.deviceBrand} ${item.deviceModel} ${item.serviceTypeName}`.trim();
}

function buildEntry(
  item: RepairFeedItem,
  merchant: AgentRepairsFeedMerchant,
  baseUrl: string
): AgentRepairsFeedEntry {
  const currency = merchant.payout_currency || 'NGN';
  const imageLink =
    item.productImageUrl || item.deviceImageUrl || merchant.logo_url || null;

  return {
    id: item.quoteId,
    type: 'repair_service',
    title: buildTitle(item),
    service_type: item.serviceTypeName,
    device: `${item.deviceBrand} ${item.deviceModel}`.trim(),
    device_brand: item.deviceBrand,
    device_model: item.deviceModel,
    price: item.price,
    price_currency: currency,
    is_from_price: item.isFromPrice,
    availability: 'in_stock',
    link: buildDeviceLink(baseUrl, item.deviceSlug),
    ...(imageLink ? { image_link: imageLink } : {}),
    ...(item.description ? { description: item.description } : {}),
    merchant_name: merchant.business_name,
    ...(item.productId ? { related_product_id: item.productId } : {}),
  };
}

/**
 * Builds the agent-repairs JSONL feed: one line per active repair quote.
 * Services are modelled separately from products (`type: 'repair_service'`)
 * so AI agents never conflate a bookable repair with a purchasable product.
 */
export function generateAgentRepairsFeed(
  items: RepairFeedItem[],
  merchant: AgentRepairsFeedMerchant,
  baseUrl: string
): string[] {
  return items.map((item) =>
    JSON.stringify(buildEntry(item, merchant, baseUrl))
  );
}

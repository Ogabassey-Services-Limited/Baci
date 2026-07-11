import { cacheLife, cacheTag } from 'next/cache';
import { createAnonClient } from '@/lib/supabase/anon';

/** Cache tag shared by every repairs-feed cache entry. */
export const REPAIRS_FEED_CACHE_TAG = 'repairs-catalog-feed';

/** Per-merchant cache tag, invalidated by catalog CRUD mutations. */
export function getRepairsFeedMerchantCacheTag(merchantId: string): string {
  return `repairs-feed-${merchantId}`;
}

export interface RepairFeedItem {
  quoteId: string;
  price: number;
  isFromPrice: boolean;
  description: string | null;
  serviceTypeName: string;
  deviceId: string;
  deviceSlug: string;
  deviceBrand: string;
  deviceModel: string;
  deviceImageUrl: string | null;
  productId: string | null;
  productImageUrl: string | null;
}

export interface RepairsFeedData {
  items: RepairFeedItem[];
}

type Row = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface RepairFeedDevice {
  id: string;
  brand: string;
  model: string;
  slug: string;
  imageUrl: string | null;
  productId: string | null;
}

function mapDevice(row: Row): RepairFeedDevice {
  return {
    id: asString(row.id),
    brand: asString(row.brand),
    model: asString(row.model),
    slug: asString(row.slug),
    imageUrl: asNullableString(row.image_url),
    productId: asNullableString(row.product_id),
  };
}

async function fetchProductImagesByProductId(
  supabase: ReturnType<typeof createAnonClient>,
  merchantId: string,
  productIds: string[]
): Promise<Map<string, string>> {
  const imageByProductId = new Map<string, string>();
  if (productIds.length === 0) {
    return imageByProductId;
  }

  const { data, error } = await supabase
    .from('product_feed_images')
    .select('product_id, verified_url')
    .eq('merchant_id', merchantId)
    .eq('status', 'verified')
    .eq('is_primary', true)
    .in('product_id', productIds);

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as Row[]) {
    const productId = asString(row.product_id);
    const verifiedUrl = asNullableString(row.verified_url);
    if (productId && verifiedUrl) {
      imageByProductId.set(productId, verifiedUrl);
    }
  }

  return imageByProductId;
}

/**
 * Loads every active repair quote for a merchant, joined to its device and
 * service type name, plus the linked product's verified feed image when the
 * device carries a `product_id`. Consumed by both the Facebook repairs XML
 * feed and the agent-repairs JSONL feed so the two surfaces stay in sync.
 */
export async function getRepairsFeedData(
  merchantId: string
): Promise<RepairsFeedData> {
  const supabase = createAnonClient();

  const { data: deviceRows, error: deviceError } = await supabase
    .from('repair_devices')
    .select('id, brand, model, slug, image_url, product_id')
    .eq('merchant_id', merchantId)
    .eq('is_active', true);

  if (deviceError) {
    throw deviceError;
  }

  const devices = ((deviceRows ?? []) as Row[]).map(mapDevice);
  if (devices.length === 0) {
    return { items: [] };
  }

  const deviceIds = devices.map((device) => device.id);
  const [
    { data: quoteRows, error: quoteError },
    { data: typeRows, error: typeError },
  ] = await Promise.all([
    supabase
      .from('repair_quotes')
      .select(
        'id, device_id, service_type_id, price, is_from_price, description'
      )
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .in('device_id', deviceIds),
    supabase
      .from('repair_service_types')
      .select('id, name')
      .eq('merchant_id', merchantId)
      .eq('is_active', true),
  ]);

  if (quoteError) {
    throw quoteError;
  }
  if (typeError) {
    throw typeError;
  }

  const deviceById = new Map(devices.map((device) => [device.id, device]));
  const typeNameById = new Map<string, string>();
  for (const typeRow of (typeRows ?? []) as Row[]) {
    typeNameById.set(asString(typeRow.id), asString(typeRow.name));
  }

  const productIds = Array.from(
    new Set(
      devices
        .map((device) => device.productId)
        .filter((productId): productId is string => Boolean(productId))
    )
  );
  const productImageByProductId = await fetchProductImagesByProductId(
    supabase,
    merchantId,
    productIds
  );

  const items: RepairFeedItem[] = [];
  for (const quoteRow of (quoteRows ?? []) as Row[]) {
    const device = deviceById.get(asString(quoteRow.device_id));
    const serviceTypeName = typeNameById.get(
      asString(quoteRow.service_type_id)
    );
    if (!device || !serviceTypeName) {
      continue;
    }

    items.push({
      quoteId: asString(quoteRow.id),
      price: asNumber(quoteRow.price),
      isFromPrice: quoteRow.is_from_price !== false,
      description: asNullableString(quoteRow.description),
      serviceTypeName,
      deviceId: device.id,
      deviceSlug: device.slug,
      deviceBrand: device.brand,
      deviceModel: device.model,
      deviceImageUrl: device.imageUrl,
      productId: device.productId,
      productImageUrl: device.productId
        ? (productImageByProductId.get(device.productId) ?? null)
        : null,
    });
  }

  return { items };
}

/**
 * Cached wrapper for {@link getRepairsFeedData}. Uses `'use cache'` with the
 * `products` profile, matching the OpenAI/Google Merchant feed data
 * fetchers. Busted by `revalidateRepairsCatalog` on any catalog mutation.
 */
export async function getCachedRepairsFeedData(
  merchantId: string
): Promise<RepairsFeedData> {
  'use cache';
  cacheLife('products');
  cacheTag(REPAIRS_FEED_CACHE_TAG, getRepairsFeedMerchantCacheTag(merchantId));

  return await getRepairsFeedData(merchantId);
}

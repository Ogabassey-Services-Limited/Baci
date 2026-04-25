import { randomBytes } from 'node:crypto';

export const JUMIA_EXTERNAL_SOURCE = 'jumia';

const DEFAULT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const SYNC_OVERLAP_MS = 10 * 60 * 1000;

function sanitizeText(value, maxLength) {
  return Array.from(String(value ?? ''))
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? ' ' : character;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getItemPrice(item) {
  const paidPrice = safeNumber(item.paidPrice, Number.NaN);
  return Number.isFinite(paidPrice) ? paidPrice : safeNumber(item.itemPrice);
}

function sanitizeShippingAddress(address = {}) {
  return {
    firstName: sanitizeText(address.firstName, 120),
    lastName: sanitizeText(address.lastName, 120),
    address: sanitizeText(address.address, 500),
    city: sanitizeText(address.city, 160),
    postalCode: sanitizeText(address.postalCode, 40),
    ward: sanitizeText(address.ward, 160),
    region: sanitizeText(address.region, 160),
    countryName: sanitizeText(address.countryName, 160),
  };
}

function sanitizeHttpsUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function buildTrackingToken() {
  return randomBytes(24).toString('base64url');
}

export function readOrderSyncEnabled(syncConfig) {
  if (!syncConfig || typeof syncConfig !== 'object') return true;
  return syncConfig.orders !== false;
}

export function getJumiaSyncLowerBound(lastSyncAt) {
  if (!lastSyncAt) {
    return new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString();
  }

  const parsed = new Date(lastSyncAt).getTime();
  if (!Number.isFinite(parsed)) {
    return new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString();
  }

  return new Date(Math.max(0, parsed - SYNC_OVERLAP_MS)).toISOString();
}

export function getCustomerName(order) {
  const address = order.shippingAddress ?? {};
  const name = `${address.firstName || ''} ${address.lastName || ''}`.trim();
  return sanitizeText(name || 'Jumia Customer', 200);
}

export function buildJumiaOrderNumber(orderNumber) {
  const normalized = sanitizeText(orderNumber, 120).trim();
  return normalized.toUpperCase().startsWith('JUMIA-')
    ? `JUMIA-${normalized.slice(6)}`
    : `JUMIA-${normalized}`;
}

function mapJumiaShippingStatus(status) {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized.includes('cancel') || normalized.includes('fail')) {
    return 'cancelled';
  }
  if (normalized.includes('return')) return 'returned';
  if (normalized.includes('delivered')) return 'delivered';
  if (normalized.includes('shipped') || normalized.includes('ready')) {
    return 'shipped';
  }
  if (normalized.includes('pack') || normalized.includes('process')) {
    return 'processing';
  }
  return 'pending';
}

function buildMarketplaceEmail(orderId) {
  const safeId = String(orderId ?? '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .toLowerCase();
  return `jumia-${safeId}@marketplace.usebaci.local`;
}

export function buildCanonicalJumiaOrderPayload(
  integration,
  order,
  trackingToken
) {
  const total = safeNumber(order.totalAmount?.value);
  const currency = order.totalAmount?.currency || 'NGN';
  const shippingAddress = sanitizeShippingAddress(order.shippingAddress);
  const orderNumber = sanitizeText(order.number, 120);
  const jumiaStatus = sanitizeText(order.status, 80);

  return {
    merchant_id: integration.merchant_id,
    order_number: buildJumiaOrderNumber(order.number),
    customer_name: getCustomerName(order),
    customer_email: buildMarketplaceEmail(order.id),
    customer_phone: '',
    shipping_status: mapJumiaShippingStatus(jumiaStatus),
    payment_status: 'paid',
    total,
    subtotal: total,
    shipping_fee: 0,
    tax_amount: 0,
    discount_amount: 0,
    currency,
    original_currency: currency,
    original_total: total,
    source: JUMIA_EXTERNAL_SOURCE,
    payment_method: 'jumia',
    notes: `Imported from Jumia order ${orderNumber}`,
    shipping_address: {
      address: shippingAddress.address,
      address_line1: shippingAddress.address,
      city: shippingAddress.city,
      state: shippingAddress.region,
      postal_code: shippingAddress.postalCode,
      country: shippingAddress.countryName,
    },
    tracking_token: trackingToken,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    external_source: JUMIA_EXTERNAL_SOURCE,
    external_id: order.id,
    imported_at: new Date().toISOString(),
    import_metadata: {
      platform: JUMIA_EXTERNAL_SOURCE,
      shopId: integration.shop_id || 'oauth',
      jumiaOrderId: order.id,
      jumiaOrderNumber: orderNumber,
      jumiaStatus,
      jumiaUpdatedAt: order.updatedAt,
    },
  };
}

export function buildJumiaCacheRow(
  integration,
  order,
  items,
  existing,
  baciOrderId
) {
  return {
    merchant_id: integration.merchant_id,
    jumia_order_id: order.id,
    jumia_order_number: sanitizeText(order.number, 120),
    jumia_shop_id: integration.shop_id || 'oauth',
    status: sanitizeText(order.status, 80),
    customer_name: getCustomerName(order),
    customer_phone: '',
    shipping_address: sanitizeShippingAddress(order.shippingAddress),
    items: items
      ? items.map((item) => ({
          id: item.id,
          product: {
            name: sanitizeText(item.product?.name, 300),
            sellerSku: sanitizeText(item.product?.sellerSku, 120),
            imageUrl: sanitizeHttpsUrl(item.product?.imageUrl),
          },
          status: item.status,
          itemPrice: item.itemPrice,
          paidPrice: item.paidPrice,
        }))
      : undefined,
    total_amount: safeNumber(order.totalAmount?.value),
    currency: order.totalAmount?.currency || 'NGN',
    created_at_jumia: order.createdAt,
    baci_order_id: baciOrderId,
    notification_sent: existing?.notification_sent ?? false,
  };
}

export function buildOrderItems(orderId, items) {
  return items.map((item, index) => ({
    order_id: orderId,
    product_id: null,
    name: sanitizeText(item.product?.name, 300),
    price: getItemPrice(item),
    quantity: 1,
    image_url: sanitizeHttpsUrl(item.product?.imageUrl),
    line_id: index + 1,
    line_extension_amount: getItemPrice(item),
    item_description: sanitizeText(item.product?.name, 300),
    sellers_item_id: sanitizeText(item.product?.sellerSku, 120),
    fulfillment_data: {
      source_platform: JUMIA_EXTERNAL_SOURCE,
      jumia_order_item_id: item.id,
      seller_sku: sanitizeText(item.product?.sellerSku, 120),
      status: item.status,
    },
    created_at: new Date().toISOString(),
  }));
}

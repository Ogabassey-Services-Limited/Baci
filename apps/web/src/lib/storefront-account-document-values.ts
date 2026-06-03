import { normalizeReceiptFulfillmentDetails } from '@baci/shared';
import type { CustomerInfo } from '@/lib/invoice-generator';
import type { StorefrontAccountDocumentItemRow } from '@/lib/storefront-account-document-bundle.types';
import type { StorefrontOrderItem } from '@/types/storefront-order';

type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

export function asNumber(value: unknown): number {
  return typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value) || 0
      : 0;
}

export function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function normalizeShippingAddress(value: unknown) {
  if (typeof value === 'string') {
    return value ? { address_line1: value } : null;
  }

  const record = asRecord(value);
  if (!record) return null;

  return {
    address_line1: asString(
      record.address_line1 || record.address || record.street
    ),
    address_line2: asString(record.address_line2),
    city: asString(record.city),
    state: asString(record.state),
    postal_code: asString(record.postal_code),
    country: asString(record.country),
  };
}

export function buildCustomerAddress(
  shippingAddress: ReturnType<typeof normalizeShippingAddress>
): CustomerInfo['address'] {
  if (!shippingAddress) return undefined;

  return {
    street: [shippingAddress.address_line1, shippingAddress.address_line2]
      .filter(Boolean)
      .join(', '),
    city: shippingAddress.city || undefined,
    state: shippingAddress.state || undefined,
    postal_code: shippingAddress.postal_code || undefined,
    country: shippingAddress.country || undefined,
  };
}

export function buildOrderItems(
  itemRows: StorefrontAccountDocumentItemRow[]
): StorefrontOrderItem[] {
  return itemRows.map((item) => {
    if (item.quantity == null || !Number.isFinite(item.quantity)) {
      throw new Error(`Invalid order item quantity for item ${item.id}`);
    }

    const price =
      typeof item.price === 'number'
        ? item.price
        : typeof item.price === 'string' && item.price.trim()
          ? Number(item.price)
          : Number.NaN;

    if (!Number.isFinite(price)) {
      throw new Error(`Invalid order item price for item ${item.id}`);
    }

    return {
      id: item.id,
      product_id: item.product_id || '',
      variant_id: item.variant_id || undefined,
      variant_name: item.variant_name || undefined,
      name: item.name,
      product_name: item.name,
      quantity: item.quantity,
      price,
      fulfillment_details:
        normalizeReceiptFulfillmentDetails(item.fulfillment_details) ??
        normalizeReceiptFulfillmentDetails(item.fulfillment_data),
    };
  });
}

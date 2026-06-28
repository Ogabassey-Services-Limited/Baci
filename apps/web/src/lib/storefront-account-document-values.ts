import {
  formatCanonicalProductConditionLabel,
  normalizeReceiptFulfillmentDetails,
} from '@baci/shared';
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

function normalizeReceiptVariantDescriptor(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesReceiptVariantDescriptor(
  value: string | null | undefined,
  descriptor: string
) {
  const normalizedValue = normalizeReceiptVariantDescriptor(value || '');
  const normalizedDescriptor = normalizeReceiptVariantDescriptor(descriptor);

  if (!normalizedValue || !normalizedDescriptor) {
    return false;
  }

  return new RegExp(`(^|\\s)${escapeRegExp(normalizedDescriptor)}(\\s|$)`).test(
    normalizedValue
  );
}

function buildReceiptVariantName(item: StorefrontAccountDocumentItemRow) {
  const variantName = item.variant_name?.trim();
  const conditionLabel = formatCanonicalProductConditionLabel(item.condition);

  if (!conditionLabel) {
    return variantName || undefined;
  }

  if (
    includesReceiptVariantDescriptor(item.name, conditionLabel) ||
    includesReceiptVariantDescriptor(variantName, conditionLabel)
  ) {
    return variantName || undefined;
  }

  return variantName ? `${variantName}, ${conditionLabel}` : conditionLabel;
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

    const fulfillmentDetails =
      normalizeReceiptFulfillmentDetails(item.fulfillment_details) ??
      normalizeReceiptFulfillmentDetails(item.fulfillment_data);

    return {
      id: item.id,
      product_id: item.product_id || '',
      variant_id: item.variant_id || undefined,
      condition: item.condition || undefined,
      variant_name: buildReceiptVariantName(item),
      name: item.name,
      product_name: item.name,
      quantity: item.quantity,
      price,
      line_extension_amount:
        item.line_extension_amount == null
          ? undefined
          : asNumber(item.line_extension_amount),
      unit_code: item.unit_code || undefined,
      vat_category_code: item.vat_category_code || undefined,
      vat_rate: item.vat_rate == null ? undefined : asNumber(item.vat_rate),
      vat_amount:
        item.vat_amount == null ? undefined : asNumber(item.vat_amount),
      sellers_item_id: item.sellers_item_id || undefined,
      ...(fulfillmentDetails
        ? { fulfillment_details: fulfillmentDetails }
        : {}),
    };
  });
}

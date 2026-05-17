import {
  ucpCheckoutCreateRequestSchema,
  ucpCheckoutUpdateRequestSchema,
} from '@/schemas/ucp-checkout-request';

type JsonRecord = Record<string, unknown>;

export function adaptUcpCheckoutCreateRequestBody(body: unknown): unknown {
  if (hasLegacyItems(body)) return body;

  const parsed = ucpCheckoutCreateRequestSchema.safeParse(body);
  if (!parsed.success) return body;

  const adapted: JsonRecord = {
    items: parsed.data.line_items.map(toAgenticCheckoutItem),
  };

  if (parsed.data.currency) adapted.currency = parsed.data.currency;
  copyOwnField({ from: body, key: 'shipping_address', to: adapted });

  return adapted;
}

export function adaptUcpCheckoutUpdateRequestBody(body: unknown): unknown {
  if (hasLegacyItems(body)) return body;

  const parsed = ucpCheckoutUpdateRequestSchema.safeParse(body);
  if (!parsed.success) return {};

  const adapted: JsonRecord = {
    fulfillment_option_id: getOwnFieldOrNull(body, 'fulfillment_option_id'),
    items: parsed.data.line_items.map(toAgenticCheckoutItem),
    shipping_address: getOwnFieldOrNull(body, 'shipping_address'),
  };

  return adapted;
}

function toAgenticCheckoutItem(lineItem: {
  item: { id: string };
  quantity: number;
}) {
  return {
    id: lineItem.item.id,
    quantity: lineItem.quantity,
  };
}

function hasLegacyItems(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.items);
}

function copyOwnField({
  from,
  key,
  to,
}: {
  from: unknown;
  key: string;
  to: JsonRecord;
}) {
  if (isRecord(from) && Object.hasOwn(from, key)) {
    to[key] = from[key];
  }
}

function getOwnFieldOrNull(value: unknown, key: string) {
  return isRecord(value) && Object.hasOwn(value, key) ? value[key] : null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

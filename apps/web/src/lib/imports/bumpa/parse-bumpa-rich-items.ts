import { sanitizePrice, sanitizeText } from '@/lib/sanitize-core';

export interface ParsedBumpaRichItem {
  productName: string;
  sku: string | null;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  fulfillmentText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstRecordText(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (
      typeof value !== 'string' &&
      !(typeof value === 'number' && Number.isFinite(value))
    ) {
      continue;
    }

    const text = sanitizeText(String(value)).replace(/\s+/g, ' ');
    if (text) return text;
  }

  return null;
}

function normalizeMoneyText(value: string) {
  return value
    .replace(/\b(?:NGN|USD|GBP|EUR)\b/gi, '')
    .replace(/[₦$£€,_\s]/g, '');
}

function parseNumberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const text = sanitizeText(value);
  if (!text) return null;

  const normalizedText = normalizeMoneyText(text);
  if (!/^-?\d+(?:\.\d+)?$/.test(normalizedText)) return null;

  return sanitizePrice(Number(normalizedText));
}

function parseQuantityValue(value: unknown) {
  const numberValue = parseNumberValue(value);
  if (numberValue === null) return null;

  return Math.max(1, Math.trunc(numberValue) || 1);
}

function parseItemsJson(value: string) {
  if (!value.trim()) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

export function parseBumpaRichItems(value: string): ParsedBumpaRichItem[] {
  return parseItemsJson(value).map((item) => {
    const productName =
      firstRecordText(item, 'name', 'product_name', 'title') || '';
    const sku = firstRecordText(item, 'sku', 'product_sku', 'variant_sku');
    const quantity = parseQuantityValue(item.quantity ?? item.qty);
    const unitPrice = parseNumberValue(
      item.price ?? item.unit_price ?? item.unitPrice
    );
    const lineTotal = parseNumberValue(
      item.total ?? item.line_total ?? item.lineTotal ?? item.amount
    );
    const fulfillmentText = firstRecordText(item, 'description', 'note');

    return {
      productName,
      sku,
      quantity,
      unitPrice,
      lineTotal,
      fulfillmentText,
    };
  });
}

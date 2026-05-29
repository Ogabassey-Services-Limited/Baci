import type {
  TransactionReviewProductRow,
  TransactionReviewVariantRow,
} from './transaction-review-types';

const SUPPLIER_METADATA_KEYS = [
  'supplier_name',
  'supplier',
  'vendor_name',
  'vendor',
] as const;

export const IMEI_KEYS = new Set(['imei', 'imei_number', 'imeiNumber']);
export const SERIAL_KEYS = new Set([
  'serial',
  'serial_number',
  'serialNumber',
  's/n',
]);

export function getJoinedProduct(
  value: TransactionReviewProductRow | TransactionReviewProductRow[] | null
) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function getJoinedVariant(
  value:
    | TransactionReviewVariantRow
    | TransactionReviewVariantRow[]
    | null
    | undefined
) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export function getTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function toFiniteNumberOrNull(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function collectStrings(
  value: unknown,
  keyMatcher?: (key: string) => boolean
) {
  const strings: string[] = [];

  function visit(node: unknown, parentKey?: string) {
    if (typeof node === 'string' || typeof node === 'number') {
      const normalized = String(node).trim();
      if (normalized && (!keyMatcher || (parentKey && keyMatcher(parentKey)))) {
        strings.push(normalized);
      }
      return;
    }

    if (!node || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item, parentKey);
      }
      return;
    }

    for (const [key, child] of Object.entries(
      node as Record<string, unknown>
    )) {
      visit(child, key);
    }
  }

  visit(value);
  return Array.from(new Set(strings));
}

export function collectDetailValues(values: unknown[], keys: Set<string>) {
  return Array.from(
    new Set(
      values.flatMap((value) =>
        collectStrings(value, (key) => keys.has(key)).map((item) => item.trim())
      )
    )
  ).filter(Boolean);
}

export function buildSearchText(tokens: unknown[]) {
  return tokens
    .flatMap((token) => {
      if (token == null) {
        return [];
      }
      if (Array.isArray(token)) {
        return token;
      }
      return [token];
    })
    .map((token) => String(token).trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

export function getSupplierNameFromMetadata(
  metadata: Record<string, unknown> | null | undefined
) {
  if (!metadata) {
    return '';
  }

  for (const key of SUPPLIER_METADATA_KEYS) {
    const value = getTrimmedString(metadata[key]);
    if (value) {
      return value;
    }
  }

  return '';
}

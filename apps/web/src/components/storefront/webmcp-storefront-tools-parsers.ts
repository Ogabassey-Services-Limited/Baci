import {
  WEBMCP_CATALOG_LIMIT,
  WEBMCP_CATALOG_SORT_VALUES,
  type WebMcpCatalogSearchInput,
  type WebMcpCatalogSort,
} from '@/schemas/webmcp-storefront-tools-contract';

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isCatalogSort(value: unknown): value is WebMcpCatalogSort {
  return (
    typeof value === 'string' &&
    WEBMCP_CATALOG_SORT_VALUES.includes(value as WebMcpCatalogSort)
  );
}

function normalizeCatalogLimit(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= WEBMCP_CATALOG_LIMIT
    ? value
    : undefined;
}

export function parseCatalogSearchInput(
  input: unknown
): WebMcpCatalogSearchInput {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const record = input as Record<string, unknown>;
  return {
    brand: normalizeOptionalString(record.brand),
    category: normalizeOptionalString(record.category),
    limit: normalizeCatalogLimit(record.limit),
    query: normalizeOptionalString(record.query),
    sort: isCatalogSort(record.sort) ? record.sort : undefined,
  };
}

export function parseProductIdInput(input: unknown):
  | {
      ok: true;
      productId: string;
    }
  | {
      ok: false;
      error: string;
    } {
  const hasProductId =
    input !== null && typeof input === 'object' && 'product_id' in input;

  if (!hasProductId) {
    return { ok: false, error: 'product_id is required' };
  }

  const productId = normalizeOptionalString(
    (input as Record<string, unknown>).product_id
  );
  return productId
    ? { ok: true, productId }
    : { ok: false, error: 'Invalid product_id' };
}

export function isStorePoliciesInputValid(input: unknown): boolean {
  return (
    input === undefined ||
    (input !== null && typeof input === 'object' && !Array.isArray(input))
  );
}

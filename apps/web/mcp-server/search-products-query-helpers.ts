import { normalizeCanonicalProductCondition } from '@baci/shared/lib';
import { storefrontProductFilters } from '../src/lib/storefront-product-filters';

export type McpSearchProductRow = {
  id: string;
  available_conditions?: unknown;
  brand?: string | null;
  category?: string | null;
  compare_at_price?: number | null;
  condition?: string | null;
  condition_detail?: string | null;
  created_at?: string | null;
  has_condition_offers?: boolean | null;
  has_variants?: boolean | null;
  images?: unknown;
  manage_stock?: boolean | null;
  name?: string | null;
  price?: number | null;
  slug?: string | null;
  stock_quantity?: number | null;
  updated_at?: string | null;
};

export type RankedSearchProductRow = {
  product_id?: unknown;
  total_count?: unknown;
};

export function getConditionPrefilterClauses(condition: string) {
  const normalized = normalizeCanonicalProductCondition(condition);

  if (!normalized) {
    return [];
  }

  const rawConditions =
    normalized === 'open_box'
      ? ['open_box', 'refurbished']
      : normalized === 'used'
        ? ['used', 'uk_used']
        : ['new'];
  return rawConditions.map((rawCondition) => `condition.eq.${rawCondition}`);
}

export function matchesConditionFamily(
  product: Record<string, unknown>,
  condition: string | undefined
) {
  if (!condition) {
    return true;
  }

  return storefrontProductFilters.matchesStorefrontConditionFilter(
    {
      condition:
        typeof product.condition === 'string' ? product.condition : null,
    },
    condition
  );
}

export function extractRankedProductIds(rows: RankedSearchProductRow[]) {
  return rows
    .map((row) =>
      typeof row.product_id === 'string' ? row.product_id : null
    )
    .filter((id): id is string => Boolean(id));
}

export function getRankedProductTotal(rows: RankedSearchProductRow[]) {
  const rawCount = rows[0]?.total_count;

  if (typeof rawCount === 'number') {
    return rawCount;
  }

  if (typeof rawCount === 'string') {
    return Number.parseInt(rawCount, 10) || 0;
  }

  return rows.length;
}

export function toRankedSearchProductRows(
  data: unknown
): RankedSearchProductRow[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter((row): row is RankedSearchProductRow => {
    if (!row || typeof row !== 'object' || !('product_id' in row)) {
      return false;
    }

    const { product_id: productId, total_count: totalCount } =
      row as RankedSearchProductRow;

    return (
      typeof productId === 'string' &&
      (totalCount === undefined ||
        totalCount === null ||
        typeof totalCount === 'number' ||
        typeof totalCount === 'string')
    );
  });
}

export function toMcpSearchProductRows(data: unknown): McpSearchProductRow[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(
    (row): row is McpSearchProductRow =>
      Boolean(row) &&
      typeof row === 'object' &&
      'id' in row &&
      typeof row.id === 'string'
  );
}

export function matchesMcpPostHydrationFilters(
  product: McpSearchProductRow,
  filters: {
    brand?: string;
    category?: string;
    condition?: string;
  }
) {
  if (
    filters.category &&
    !String(product.category ?? '')
      .toLowerCase()
      .includes(filters.category.toLowerCase())
  ) {
    return false;
  }

  if (
    filters.brand &&
    !String(product.brand ?? '')
      .toLowerCase()
      .includes(filters.brand.toLowerCase())
  ) {
    return false;
  }

  return matchesConditionFamily(product, filters.condition);
}

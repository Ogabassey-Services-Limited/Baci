const PRODUCT_SEARCH_REPLACEMENTS: [RegExp, string][] = [
  [/\bpro[\s-]*max\b/gi, 'pro max'],
  [/\bwi[\s-]*fi\b/gi, 'wifi'],
  [/\be[\s-]*sim\b/gi, 'esim'],
  [/\bdual[\s-]*sim\b/gi, 'dual sim'],
];

export interface ProductSearchQuery {
  compact: string;
  normalized: string;
  tokens: string[];
}

export interface ProductSearchResult {
  product_id: string;
  relevance: number;
  total_count: number | string;
}

function applyProductSearchReplacements(value: string): string {
  return PRODUCT_SEARCH_REPLACEMENTS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    value
  );
}

export function normalizeProductSearchText(value: string): string {
  if (!value) {
    return '';
  }

  const withBoundaries = value
    .toLowerCase()
    .trim()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2');

  return applyProductSearchReplacements(withBoundaries)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildProductSearchQuery(value: string): ProductSearchQuery {
  const normalized = normalizeProductSearchText(value);
  const tokens = normalized.split(' ').filter(Boolean);

  return {
    compact: tokens.join(''),
    normalized,
    tokens,
  };
}

export function extractProductSearchIds(
  results: readonly ProductSearchResult[]
): string[] {
  return results.map((result) => result.product_id);
}

export function getProductSearchTotalCount(
  results: readonly ProductSearchResult[]
): number {
  const count = results[0]?.total_count;
  if (typeof count === 'string') {
    return Number.parseInt(count, 10) || 0;
  }
  return count ?? 0;
}

export function orderRecordsByIds<T extends { id: string }>(
  records: readonly T[],
  ids: readonly string[]
): T[] {
  const recordsById = new Map(records.map((record) => [record.id, record]));

  return ids
    .map((id) => recordsById.get(id))
    .filter((record): record is T => Boolean(record));
}

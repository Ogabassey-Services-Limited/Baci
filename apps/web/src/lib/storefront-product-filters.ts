export type StorefrontConditionBadgeLabel =
  | 'New'
  | 'Open Box'
  | 'Used'
  | 'New & Used'
  | 'Multiple Conditions';

import {
  type CanonicalProductCondition,
  normalizeCanonicalProductCondition,
} from '@baci/shared/lib';

const CONDITION_LABELS = {
  new: 'New',
  open_box: 'Open Box',
  used: 'Used',
} as const satisfies Record<
  CanonicalProductCondition,
  Exclude<StorefrontConditionBadgeLabel, 'New & Used' | 'Multiple Conditions'>
>;

interface ConditionSource {
  available_conditions?: unknown;
  condition?: string | null;
  has_condition_offers?: boolean | null;
}

interface CategorySource {
  categories?:
    | { name?: string | null; slug?: string | null }
    | Array<{ name?: string | null; slug?: string | null }>
    | null;
  category?: string | null;
  category_slug?: string | null;
}

interface BrandSource {
  brand?: string | null;
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function slugifyToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toComparableTokens(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return [];
  }

  const normalized = normalizeToken(value);

  if (!normalized) {
    return [];
  }

  const slug = slugifyToken(value);
  return slug && slug !== normalized ? [normalized, slug] : [normalized];
}

export function getNormalizedStorefrontConditions(source: ConditionSource) {
  const normalizedConditions = new Set<CanonicalProductCondition>();

  if (Array.isArray(source.available_conditions)) {
    for (const condition of source.available_conditions) {
      if (typeof condition !== 'string') {
        continue;
      }

      const normalized = normalizeCanonicalProductCondition(condition);
      if (normalized) {
        normalizedConditions.add(normalized);
      }
    }
  }

  if (normalizedConditions.size === 0 && source.has_condition_offers) {
    normalizedConditions.add('new');
    normalizedConditions.add('used');
  }

  if (normalizedConditions.size === 0 && typeof source.condition === 'string') {
    const normalized = normalizeCanonicalProductCondition(source.condition);
    if (normalized) {
      normalizedConditions.add(normalized);
    }
  }

  return Array.from(normalizedConditions);
}

export function getStorefrontConditionBadgeLabel(
  source: ConditionSource
): StorefrontConditionBadgeLabel | undefined {
  const normalizedConditions = getNormalizedStorefrontConditions(source);

  if (normalizedConditions.length === 0) {
    return undefined;
  }

  if (normalizedConditions.length === 1) {
    return CONDITION_LABELS[normalizedConditions[0]];
  }

  return normalizedConditions.length === 2 &&
    normalizedConditions.includes('new') &&
    normalizedConditions.includes('used')
    ? 'New & Used'
    : 'Multiple Conditions';
}

export function matchesStorefrontConditionFilter(
  source: ConditionSource,
  selectedCondition: string
) {
  if (!selectedCondition || selectedCondition === 'All') {
    return true;
  }

  const normalizedFilter =
    normalizeCanonicalProductCondition(selectedCondition) || undefined;

  if (!normalizedFilter) {
    return false;
  }

  return getNormalizedStorefrontConditions(source).includes(normalizedFilter);
}

export function matchesStorefrontBrandFilter(
  source: BrandSource,
  selectedBrand: string
) {
  if (!selectedBrand || selectedBrand === 'All') {
    return true;
  }

  return normalizeToken(source.brand || '') === normalizeToken(selectedBrand);
}

export function matchesStorefrontCategoryFilter(
  source: CategorySource,
  selectedCategory: string
) {
  if (!selectedCategory || selectedCategory === 'All') {
    return true;
  }

  const categoryTokens = new Set([
    ...toComparableTokens(source.category),
    ...toComparableTokens(source.category_slug),
  ]);

  const categoryRelations = Array.isArray(source.categories)
    ? source.categories
    : source.categories
      ? [source.categories]
      : [];

  for (const category of categoryRelations) {
    for (const token of toComparableTokens(category?.name)) {
      categoryTokens.add(token);
    }
    for (const token of toComparableTokens(category?.slug)) {
      categoryTokens.add(token);
    }
  }

  return toComparableTokens(selectedCategory).some((token) =>
    categoryTokens.has(token)
  );
}

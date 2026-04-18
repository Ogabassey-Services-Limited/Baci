import {
  type CanonicalProductCondition,
  normalizeCanonicalProductCondition,
} from '@baci/shared/lib';

export type StorefrontConditionBadgeLabel =
  | 'New'
  | 'Open Box'
  | 'Used'
  | 'New & Used'
  | 'New & Open Box'
  | 'Used & Open Box'
  | 'Multiple Conditions';

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

function isAllFilter(value: string | null | undefined) {
  return typeof value === 'string' && normalizeToken(value) === 'all';
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

function getNormalizedStorefrontConditions(source: ConditionSource) {
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

  if (normalizedConditions.size > 0) {
    return Array.from(normalizedConditions);
  }

  if (source.has_condition_offers) {
    // Legacy offer families imply both new and used availability even when the
    // parent product row still carries a single explicit condition value.
    normalizedConditions.add('new');
    normalizedConditions.add('used');
  }

  if (typeof source.condition === 'string') {
    const normalized = normalizeCanonicalProductCondition(source.condition);
    if (normalized) {
      normalizedConditions.add(normalized);
    }
  }

  return Array.from(normalizedConditions);
}

function getStorefrontConditionBadgeLabel(
  source: ConditionSource
): StorefrontConditionBadgeLabel | undefined {
  const normalizedConditions = getNormalizedStorefrontConditions(source);

  if (normalizedConditions.length === 0) {
    return undefined;
  }

  if (normalizedConditions.length === 1) {
    return CONDITION_LABELS[normalizedConditions[0]];
  }

  if (normalizedConditions.length === 2) {
    if (
      normalizedConditions.includes('new') &&
      normalizedConditions.includes('used')
    ) {
      return 'New & Used';
    }

    if (
      normalizedConditions.includes('new') &&
      normalizedConditions.includes('open_box')
    ) {
      return 'New & Open Box';
    }

    if (
      normalizedConditions.includes('used') &&
      normalizedConditions.includes('open_box')
    ) {
      return 'Used & Open Box';
    }
  }

  return 'Multiple Conditions';
}

function matchesStorefrontConditionFilter(
  source: ConditionSource,
  selectedCondition: string
) {
  if (!selectedCondition || isAllFilter(selectedCondition)) {
    return true;
  }

  const normalizedFilter =
    normalizeCanonicalProductCondition(selectedCondition) || undefined;

  if (!normalizedFilter) {
    return false;
  }

  return getNormalizedStorefrontConditions(source).includes(normalizedFilter);
}

function matchesStorefrontBrandFilter(
  source: BrandSource,
  selectedBrand: string
) {
  const selectedBrandTokens = toComparableTokens(selectedBrand);

  if (
    !selectedBrand ||
    isAllFilter(selectedBrand) ||
    selectedBrandTokens.length === 0
  ) {
    return true;
  }

  const brandTokens = new Set(toComparableTokens(source.brand || ''));

  return selectedBrandTokens.some((token) => brandTokens.has(token));
}

function matchesStorefrontCategoryFilter(
  source: CategorySource,
  selectedCategory: string
) {
  if (!selectedCategory || isAllFilter(selectedCategory)) {
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

export const storefrontProductFilters = {
  getNormalizedStorefrontConditions,
  getStorefrontConditionBadgeLabel,
  matchesStorefrontConditionFilter,
  matchesStorefrontBrandFilter,
  matchesStorefrontCategoryFilter,
  isAllFilter,
} as const;

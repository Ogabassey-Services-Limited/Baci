const CONDITION_LABELS = {
  new: 'New',
  open_box: 'Open Box',
  used: 'Used',
} as const;

type CanonicalCondition = keyof typeof CONDITION_LABELS;

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

export function normalizeStorefrontConditionValue(
  value: string | null | undefined
): '' | CanonicalCondition {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  switch (normalized) {
    case 'new':
      return 'new';
    case 'used':
    case 'uk_used':
      return 'used';
    case 'open_box':
    case 'refurbished':
      return 'open_box';
    default:
      return '';
  }
}

export function getNormalizedStorefrontConditions(source: ConditionSource) {
  const normalizedConditions = new Set<CanonicalCondition>();

  if (Array.isArray(source.available_conditions)) {
    for (const condition of source.available_conditions) {
      if (typeof condition !== 'string') {
        continue;
      }

      const normalized = normalizeStorefrontConditionValue(condition);
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
    const normalized = normalizeStorefrontConditionValue(source.condition);
    if (normalized) {
      normalizedConditions.add(normalized);
    }
  }

  return Array.from(normalizedConditions);
}

export function getStorefrontConditionBadgeLabel(source: ConditionSource) {
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
    normalizeStorefrontConditionValue(selectedCondition) || undefined;

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

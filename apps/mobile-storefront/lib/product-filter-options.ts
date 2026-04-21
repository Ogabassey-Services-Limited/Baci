import { normalizeCanonicalProductCondition } from '@baci/shared/lib';
import type { ProductCondition } from '@/types/product';

interface NamedCategory {
  id: string;
  name: string;
  slug: string;
}

export const ALL_PRODUCT_FILTER_CATEGORY_SLUG = 'all';

function normalizeCategoryToken(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeSelectedCategorySlug(
  selectedCategorySlugOrName: string,
  categories: NamedCategory[]
) {
  const normalizedSelection = normalizeCategoryToken(
    selectedCategorySlugOrName
  );

  if (
    selectedCategorySlugOrName === 'All' ||
    normalizedSelection === ALL_PRODUCT_FILTER_CATEGORY_SLUG
  ) {
    return ALL_PRODUCT_FILTER_CATEGORY_SLUG;
  }

  const category = categories.find(
    (candidate) =>
      normalizeCategoryToken(candidate.slug) === normalizedSelection ||
      normalizeCategoryToken(candidate.name) === normalizedSelection ||
      normalizeCategoryToken(candidate.id) === normalizedSelection
  );

  return category ? normalizeCategoryToken(category.slug) : normalizedSelection;
}

export function resolveSelectedCategoryId(
  selectedCategorySlugOrName: string,
  categories: NamedCategory[]
) {
  const normalizedSelection = normalizeCategoryToken(
    selectedCategorySlugOrName
  );

  if (
    selectedCategorySlugOrName === 'All' ||
    normalizedSelection === ALL_PRODUCT_FILTER_CATEGORY_SLUG
  ) {
    return undefined;
  }

  const category = categories.find(
    (candidate) =>
      normalizeCategoryToken(candidate.slug) === normalizedSelection ||
      normalizeCategoryToken(candidate.id) === normalizedSelection ||
      normalizeCategoryToken(candidate.name) === normalizedSelection
  );

  return category?.id;
}

export function normalizeProductConditionFilterValue(
  condition: string | null | undefined
): ProductCondition | undefined {
  if (!condition || condition === 'All') {
    return undefined;
  }

  return (normalizeCanonicalProductCondition(condition) || undefined) as
    | ProductCondition
    | undefined;
}

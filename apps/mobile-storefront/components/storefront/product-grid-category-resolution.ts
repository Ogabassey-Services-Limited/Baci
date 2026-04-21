import {
  ALL_PRODUCT_FILTER_CATEGORY_SLUG,
  resolveSelectedCategoryId,
} from '@/lib/product-filter-options';

// IDs beginning with this prefix are unstored UI-only selections that must not be persisted as real category filters
const UNSAVED_CATEGORY_ID_PREFIX = 'u-';

interface NamedCategory {
  id: string;
  name: string;
  slug: string;
}

interface ResolveProductGridCategoryIdOptions {
  categories: NamedCategory[];
  parentSelectedCategoryId: string | null;
  selectedCategorySlug: string;
}

export function resolveProductGridCategoryId({
  categories,
  parentSelectedCategoryId,
  selectedCategorySlug,
}: ResolveProductGridCategoryIdOptions): string | undefined {
  const selectedCategoryIdFromFilter = resolveSelectedCategoryId(
    selectedCategorySlug,
    categories
  );

  if (selectedCategorySlug !== ALL_PRODUCT_FILTER_CATEGORY_SLUG) {
    return selectedCategoryIdFromFilter;
  }

  if (
    parentSelectedCategoryId &&
    !parentSelectedCategoryId.startsWith(UNSAVED_CATEGORY_ID_PREFIX)
  ) {
    return parentSelectedCategoryId;
  }

  return undefined;
}

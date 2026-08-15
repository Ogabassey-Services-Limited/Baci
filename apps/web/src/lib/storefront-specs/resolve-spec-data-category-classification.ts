import {
  resolveStorefrontProductCategoryName,
  resolveStorefrontProductCategorySlug,
  resolveSupportedStorefrontProductCategoryRelation,
} from '@/lib/storefront-product-category-name';
import { isUnsupportedSpecValue } from './is-unsupported-spec-value';
import { getProductSpecFamily } from './spec-taxonomy';

interface SpecDataCategorySource {
  categories?:
    | { name?: string | null; slug?: string | null }
    | Array<{ name?: string | null; slug?: string | null }>
    | null;
  category?: string | null;
  category_slug?: string | null;
}

export function resolveSpecDataCategoryClassification(
  source: SpecDataCategorySource
) {
  const relation = Array.isArray(source.categories)
    ? resolveSupportedStorefrontProductCategoryRelation(source.categories)
    : source.categories;
  const name = resolveStorefrontProductCategoryName({
    categories: relation,
    category: source.category,
    category_slug: source.category_slug,
  });
  const slug = resolveStorefrontProductCategorySlug({
    categories: relation,
    category: source.category,
    category_slug: source.category_slug,
  });

  const categoryName = name && !isUnsupportedSpecValue(name) ? name : undefined;
  const slugClassificationName = slug?.replace(/-/g, ' ');
  const classificationName =
    slugClassificationName &&
    getProductSpecFamily(slugClassificationName) !== 'general'
      ? slugClassificationName
      : categoryName;

  return {
    hasCategory: Boolean(categoryName),
    name: categoryName ?? 'General',
    classificationName: classificationName ?? categoryName ?? 'General',
  };
}

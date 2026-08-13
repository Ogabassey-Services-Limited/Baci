import { getAccessoryKeySpecCategoryProjection } from './accessory-key-spec-category-projection';
import { getKeySpecCategoryProjection } from './spec-category-family-projections';
import {
  isAccessoryLikeCategory,
  type ProductSpecFamily,
  type SpecCategory,
} from './spec-taxonomy';

export function getKeySpecCategoriesForFamily(
  family: ProductSpecFamily,
  categoryName?: string
): SpecCategory[] {
  const normalizedCategoryName = categoryName?.trim();

  if (family === 'general') {
    if (!normalizedCategoryName) {
      return [];
    }

    if (isAccessoryLikeCategory(normalizedCategoryName.toLowerCase())) {
      return getAccessoryKeySpecCategoryProjection();
    }

    return getKeySpecCategoryProjection('general-supported');
  }

  return getKeySpecCategoryProjection(family);
}

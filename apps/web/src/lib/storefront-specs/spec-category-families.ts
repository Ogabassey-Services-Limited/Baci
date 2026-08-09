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
  if (
    family === 'general' &&
    (!categoryName?.trim() ||
      isAccessoryLikeCategory(categoryName.trim().toLowerCase()))
  ) {
    return [];
  }

  return getKeySpecCategoryProjection(
    family === 'general' ? 'general-supported' : family
  );
}

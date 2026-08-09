import { getCameraKeySpecCategoryProjection } from './camera-key-spec-category-projection';
import { getComputerKeySpecCategoryProjection } from './computer-key-spec-category-projection';
import { getGeneralKeySpecCategoryProjection } from './general-key-spec-category-projection';
import {
  KEY_SPEC_CATEGORIES,
  type ProductSpecFamily,
  type SpecCategory,
} from './spec-taxonomy';

export function getKeySpecCategoryProjection(
  family: Exclude<ProductSpecFamily, 'general'> | 'general-supported'
): SpecCategory[] {
  if (family === 'camera') {
    return getCameraKeySpecCategoryProjection();
  }

  if (family === 'computer') {
    return getComputerKeySpecCategoryProjection();
  }

  if (family === 'mobile') {
    return KEY_SPEC_CATEGORIES;
  }

  return getGeneralKeySpecCategoryProjection();
}

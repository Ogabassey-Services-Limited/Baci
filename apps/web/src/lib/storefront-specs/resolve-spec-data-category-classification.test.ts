import { describe, expect, it } from 'vitest';
import { resolveSpecDataCategoryClassification } from './resolve-spec-data-category-classification';

describe('resolveSpecDataCategoryClassification', () => {
  it('uses joined category slug for family classification when display name is non-taxonomy', () => {
    expect(
      resolveSpecDataCategoryClassification({
        categories: { name: '相机', slug: 'action-cameras' },
      })
    ).toEqual({
      hasCategory: true,
      name: '相机',
      classificationName: 'action cameras',
    });
  });
});

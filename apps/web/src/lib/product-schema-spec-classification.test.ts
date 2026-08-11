import { describe, expect, it } from 'vitest';
import { classifyProductSchemaCategories } from './product-schema-spec-classification';

describe('classifyProductSchemaCategories', () => {
  it('prefers relation-backed category metadata over stale legacy category text', () => {
    expect(
      classifyProductSchemaCategories({
        categories: { slug: 'action-cameras' },
        category: 'Smartphones',
      })
    ).toMatchObject({
      categoryNames: ['action cameras'],
      hasCameraCategory: true,
      isMobileCategory: false,
      productFamily: 'camera',
    });
  });

  it('recognizes Google Pixel category slugs as mobile while excluding accessories', () => {
    expect(
      classifyProductSchemaCategories({ category: 'google-pixel' })
        .isMobileCategory
    ).toBe(true);
    expect(
      classifyProductSchemaCategories({ category: 'phone accessories' })
        .isMobileCategory
    ).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { buildPublicProjectionCategoryScopes } from './build-public-projection-category-scopes';

describe('buildPublicProjectionCategoryScopes', () => {
  it('indexes direct active-child product membership without including grandchildren or inactive children', () => {
    const categories = [
      { id: 'parent', slug: 'phones' },
      { id: 'child', parentId: 'parent', slug: 'android' },
      {
        id: 'inactive',
        parentId: 'parent',
        slug: 'retired',
        status: 'inactive',
      },
      { id: 'grandchild', parentId: 'child', slug: 'foldables' },
    ];

    const scopes = buildPublicProjectionCategoryScopes(categories, [
      { categoryIds: ['child'] },
      { categoryIds: ['grandchild'] },
    ]);

    expect(scopes.get('parent')).toEqual({
      categoryIds: new Set(['parent', 'child']),
      hasProducts: true,
    });
    expect(scopes.get('inactive')).toEqual({
      categoryIds: new Set(['inactive']),
      hasProducts: false,
    });
  });
});

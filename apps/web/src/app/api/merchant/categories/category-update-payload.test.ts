import { describe, expect, it } from 'vitest';
import { buildCategoryUpdatePayload } from './category-update-payload';

const NOW = '2026-07-25T00:00:00.000Z';

describe('buildCategoryUpdatePayload', () => {
  it('always stamps updated_at', () => {
    expect(buildCategoryUpdatePayload({ name: 'Phones' }, NOW)).toMatchObject({
      updated_at: NOW,
    });
  });

  it('maps camelCase input to the database columns', () => {
    const payload = buildCategoryUpdatePayload(
      {
        name: 'Phones',
        slug: 'phones',
        imageUrl: 'https://cdn.test/a.png',
        parentId: '11111111-1111-4111-8111-111111111111',
        displayOrder: 3,
        isActive: false,
      },
      NOW
    );

    expect(payload).toEqual({
      updated_at: NOW,
      name: 'Phones',
      slug: 'phones',
      image_url: 'https://cdn.test/a.png',
      parent_id: '11111111-1111-4111-8111-111111111111',
      display_order: 3,
      is_active: false,
    });
  });

  describe('a partial update must not blank untouched columns', () => {
    it('omits every field the caller did not send', () => {
      const payload = buildCategoryUpdatePayload({ slug: 'phones' }, NOW);

      expect(Object.keys(payload).sort()).toEqual(['slug', 'updated_at']);
    });

    it('distinguishes an explicit null from an absent field', () => {
      // `parentId: null` detaches; omitting it must leave the parent alone.
      expect(buildCategoryUpdatePayload({ parentId: null }, NOW)).toMatchObject(
        { parent_id: null }
      );
      expect(buildCategoryUpdatePayload({ name: 'X' }, NOW)).not.toHaveProperty(
        'parent_id'
      );
    });
  });

  it('normalises an empty description to null rather than an empty string', () => {
    expect(buildCategoryUpdatePayload({ description: '' }, NOW)).toMatchObject({
      description: null,
    });
  });

  it('keeps isActive false, which is the deactivation signal', () => {
    // A truthiness check here would silently drop the retire operation.
    expect(buildCategoryUpdatePayload({ isActive: false }, NOW)).toMatchObject({
      is_active: false,
    });
  });

  it('preserves SEO on an active-to-active edit that repeats isActive true', () => {
    const payload = buildCategoryUpdatePayload({ isActive: true }, NOW);

    expect(payload).toEqual({ is_active: true, updated_at: NOW });
    expect(
      Object.keys(payload).filter((key) => key.startsWith('seo_'))
    ).toEqual([]);
  });
});

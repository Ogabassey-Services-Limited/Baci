import { describe, expect, it } from 'vitest';
import { RECENT_PENDING_SOURCES } from './recent-pending-sources.test-fixture';

describe('recent pending sources fixture', () => {
  it('contains the pending migration source set used by replay tests', () => {
    expect(RECENT_PENDING_SOURCES.length).toBeGreaterThan(0);
  });

  it('binds the atomic blog product-link migration as a pending source', () => {
    expect(RECENT_PENDING_SOURCES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repositoryPath:
            'supabase/migrations/20260731190000_atomic_blog_post_product_links.sql',
        }),
      ])
    );
  });
});

import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { validateUpdatedBlogPostSlug } from './validate-updated-blog-post-slug';

const merchantId = 'merchant-1';
const postId = 'post-1';

function createSupabase(result: { data: unknown; error: unknown }) {
  const query = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    neq: vi.fn(),
    select: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  return {
    query,
    supabase: {
      from: vi.fn().mockReturnValue(query),
    } as unknown as SupabaseClient,
  };
}

describe('validateUpdatedBlogPostSlug', () => {
  it('skips the collision lookup when the submitted slug is unchanged', async () => {
    const { supabase } = createSupabase({
      data: { id: 'other-post' },
      error: null,
    });

    await expect(
      validateUpdatedBlogPostSlug({
        currentSlug: 'existing-slug',
        merchantId,
        postId,
        slug: 'existing-slug',
        supabase,
      })
    ).resolves.toBe('available');
  });

  it('reports a collision only when another post in the same merchant owns the new slug', async () => {
    const { query, supabase } = createSupabase({
      data: { id: 'other-post' },
      error: null,
    });

    await expect(
      validateUpdatedBlogPostSlug({
        currentSlug: 'old-slug',
        merchantId,
        postId,
        slug: 'new-slug',
        supabase,
      })
    ).resolves.toBe('conflict');

    expect(query.eq).toHaveBeenCalledWith('merchant_id', merchantId);
    expect(query.eq).toHaveBeenCalledWith('slug', 'new-slug');
    expect(query.neq).toHaveBeenCalledWith('id', postId);
  });
});

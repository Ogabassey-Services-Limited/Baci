import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { loadBlogPostForUpdate } from './load-blog-post-for-update';

function createSupabase(result: { data: unknown; error: unknown }) {
  const query = {
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return {
    query,
    supabase: {
      from: vi.fn().mockReturnValue(query),
    } as unknown as SupabaseClient,
  };
}

describe('loadBlogPostForUpdate', () => {
  it('returns not-found when the post does not belong to the selected merchant', async () => {
    const { query, supabase } = createSupabase({
      data: null,
      error: { code: 'PGRST116' },
    });

    await expect(
      loadBlogPostForUpdate({
        merchantId: 'merchant-1',
        postId: 'post-1',
        supabase,
      })
    ).resolves.toEqual({ kind: 'not-found' });

    expect(query.eq).toHaveBeenCalledWith('id', 'post-1');
    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
  });

  it('returns the post data for an editable merchant-owned post', async () => {
    const post = {
      category: null,
      content: '<p>Post</p>',
      excerpt: null,
      featured_image_height: null,
      featured_image_url: null,
      featured_image_variants: {},
      featured_image_width: null,
      id: 'post-1',
      published_at: null,
      slug: 'post',
      status: 'draft',
      title: 'Post',
    };
    const { supabase } = createSupabase({ data: post, error: null });

    await expect(
      loadBlogPostForUpdate({
        merchantId: 'merchant-1',
        postId: 'post-1',
        supabase,
      })
    ).resolves.toEqual({ kind: 'found', post });
  });
});

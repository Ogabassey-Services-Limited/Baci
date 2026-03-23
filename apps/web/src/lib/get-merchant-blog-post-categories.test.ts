import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantBlogPostCategories } from '@/lib/get-merchant-blog-post-categories';

function createSupabaseMock(options: {
  posts?: Array<{ category: string | null }> | null;
  postsError?: { message: string } | null;
}) {
  const postsEq = vi.fn().mockResolvedValue({
    data: options.posts ?? null,
    error: options.postsError ?? null,
  });
  const postsSelect = vi.fn().mockReturnValue({
    eq: postsEq,
  });
  const from = vi.fn((table: string) => {
    if (table === 'blog_posts') {
      return { select: postsSelect };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from } as unknown as SupabaseClient,
    postsEq,
  };
}

describe('getMerchantBlogPostCategories', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns unique normalized categories', async () => {
    const supabase = createSupabaseMock({
      posts: [
        { category: 'Reviews' },
        { category: 'reviews' },
        { category: '   ' },
        { category: null },
      ],
    });

    await expect(
      getMerchantBlogPostCategories(supabase.client, 'merchant-8')
    ).resolves.toEqual(['reviews']);
    expect(supabase.postsEq).toHaveBeenCalledWith('merchant_id', 'merchant-8');
  });

  it('throws when the categories lookup fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const supabase = createSupabaseMock({
      postsError: { message: 'categories query failed' },
    });

    await expect(
      getMerchantBlogPostCategories(supabase.client, 'merchant-9')
    ).rejects.toEqual({ message: 'categories query failed' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch merchant blog post categories:',
      expect.objectContaining({
        merchantId: 'merchant-9',
        error: { message: 'categories query failed' },
      })
    );
  });
});

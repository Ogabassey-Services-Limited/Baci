import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantBlogPostSlugs } from '@/lib/get-merchant-blog-post-slugs';

function createSupabaseMock(options: {
  posts?: Array<{ slug: string | null }> | null;
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

describe('getMerchantBlogPostSlugs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns unique normalized post slugs', async () => {
    const supabase = createSupabaseMock({
      posts: [
        { slug: 'apple-studio-display-review' },
        { slug: 'Apple-Studio-Display-Review' },
        { slug: '   ' },
        { slug: null },
      ],
    });

    await expect(
      getMerchantBlogPostSlugs(supabase.client, 'merchant-6')
    ).resolves.toEqual(['apple-studio-display-review']);
    expect(supabase.postsEq).toHaveBeenCalledWith('merchant_id', 'merchant-6');
  });

  it('throws when the posts lookup fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const supabase = createSupabaseMock({
      postsError: { message: 'posts query failed' },
    });

    await expect(
      getMerchantBlogPostSlugs(supabase.client, 'merchant-7')
    ).rejects.toEqual({ message: 'posts query failed' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch merchant blog post slugs:',
      expect.objectContaining({
        merchantId: 'merchant-7',
        error: { message: 'posts query failed' },
      })
    );
  });
});

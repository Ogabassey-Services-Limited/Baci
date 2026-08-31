import { describe, expect, it, vi } from 'vitest';
import { getPublishedBlogPostSlugsForProducts } from './get-published-blog-post-slugs-for-products';

function makeSupabase(result: { data: unknown; error: unknown }) {
  const inSpy = vi.fn();
  const builder = {
    eq: vi.fn(() => builder),
    in: vi.fn((column: string, values: string[]) => {
      inSpy(column, values);
      return Promise.resolve(result);
    }),
  };
  const supabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => builder),
    })),
  };
  return { inSpy, supabase };
}

describe('getPublishedBlogPostSlugsForProducts', () => {
  it('returns unique published post slugs for the changed product ids', async () => {
    const { inSpy, supabase } = makeSupabase({
      data: [
        {
          blog_posts: {
            slug: 'phone-guide',
            status: 'published',
            published_at: '2026-08-01',
          },
        },
        {
          blog_posts: [
            {
              slug: 'phone-guide',
              status: 'published',
              published_at: '2026-08-01',
            },
          ],
        },
        {
          blog_posts: {
            slug: 'draft-guide',
            status: 'draft',
            published_at: null,
          },
        },
        {
          blog_posts: {
            slug: 'unpublished-guide',
            status: 'published',
            published_at: null,
          },
        },
      ],
      error: null,
    });

    const result = await getPublishedBlogPostSlugsForProducts(
      supabase as never,
      ' merchant-1 ',
      ['product-1', 'product-1', ' product-2 ']
    );

    expect(result).toEqual(['phone-guide']);
    expect(inSpy).toHaveBeenCalledWith('product_id', [
      'product-1',
      'product-2',
    ]);
  });

  it('returns an empty list without querying for missing ids', async () => {
    const { supabase } = makeSupabase({ data: [], error: null });

    await expect(
      getPublishedBlogPostSlugsForProducts(supabase as never, 'merchant-1', [
        ' ',
      ])
    ).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('fails open when the relationship lookup errors', async () => {
    const error = { message: 'timeout' };
    const { supabase } = makeSupabase({ data: null, error });
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await expect(
        getPublishedBlogPostSlugsForProducts(supabase as never, 'merchant-1', [
          'product-1',
        ])
      ).resolves.toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

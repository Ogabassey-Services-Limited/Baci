import { describe, expect, it, vi } from 'vitest';
import { getPublishedBlogPostSlugsForProducts } from './get-published-blog-post-slugs-for-products';

function makeSupabase(
  result: { data: unknown; error: unknown },
  categoryResult: { data: unknown; error: unknown } = { data: [], error: null }
) {
  const inSpy = vi.fn();
  const categoryInSpy = vi.fn();
  const categoryLimitSpy = vi.fn();
  const productBuilder = {
    eq: vi.fn(() => productBuilder),
    in: vi.fn((column: string, values: string[]) => {
      inSpy(column, values);
      return Promise.resolve(result);
    }),
  };
  const categoryBuilder = {
    eq: vi.fn(() => categoryBuilder),
    in: vi.fn((column: string, values: string[]) => {
      categoryInSpy(column, values);
      return categoryBuilder;
    }),
    limit: vi.fn((value: number) => {
      categoryLimitSpy(value);
      return Promise.resolve(categoryResult);
    }),
    order: vi.fn(() => categoryBuilder),
  };
  const supabase = {
    from: vi.fn((table: string) => ({
      select: vi.fn(() =>
        table === 'blog_posts' ? categoryBuilder : productBuilder
      ),
    })),
  };
  return { categoryInSpy, categoryLimitSpy, inSpy, supabase };
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
      [
        '123e4567-e89b-12d3-a456-426614174000',
        '123e4567-e89b-12d3-a456-426614174000',
        ' 123e4567-e89b-12d3-a456-426614174001 ',
        'sku-2',
      ]
    );

    expect(result).toEqual(['phone-guide']);
    expect(inSpy).toHaveBeenCalledWith('product_id', [
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-12d3-a456-426614174001',
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
          '123e4567-e89b-12d3-a456-426614174000',
        ])
      ).resolves.toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('includes published category-fallback posts and deduplicates linked slugs', async () => {
    const { categoryInSpy, categoryLimitSpy, inSpy, supabase } = makeSupabase(
      {
        data: [
          {
            blog_posts: {
              slug: 'linked-guide',
              status: 'published',
              published_at: '2026-08-01',
            },
          },
        ],
        error: null,
      },
      {
        data: [
          {
            slug: 'linked-guide',
            status: 'published',
            published_at: '2026-08-01',
            category: 'Smartphones',
          },
          {
            slug: 'fallback-guide',
            status: 'published',
            published_at: '2026-08-02',
            category: 'smartphones',
          },
          {
            slug: 'draft-fallback',
            status: 'draft',
            published_at: null,
            category: 'smartphones',
          },
        ],
        error: null,
      }
    );

    const result = await getPublishedBlogPostSlugsForProducts(
      supabase as never,
      'merchant-1',
      ['123e4567-e89b-12d3-a456-426614174000'],
      ['smartphones']
    );

    expect(result).toEqual(['linked-guide', 'fallback-guide']);
    expect(inSpy).toHaveBeenCalledWith('product_id', [
      '123e4567-e89b-12d3-a456-426614174000',
    ]);
    expect(categoryInSpy).toHaveBeenCalledWith('category', [
      'smartphones',
      'Smartphones',
    ]);
    expect(categoryLimitSpy).toHaveBeenCalledWith(256);
  });
});

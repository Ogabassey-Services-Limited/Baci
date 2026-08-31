import { describe, expect, it, vi } from 'vitest';
import { getPublishedBlogPostSlugsForProducts } from './get-published-blog-post-slugs-for-products';

function makeSupabase(
  result: { data: unknown; error: unknown },
  categoryResult: { data: unknown; error: unknown } = { data: [], error: null },
  canonicalCategoryResult: { data: unknown; error: unknown } = categoryResult
) {
  const inSpy = vi.fn();
  const categoryInSpy = vi.fn();
  const categoryOrSpy = vi.fn();
  const categoryRangeSpy = vi.fn();
  let categoryQuery: 'exact' | 'canonical' = 'exact';
  const categoryPages = {
    exact: [] as Array<{ data: unknown; error: unknown }>,
    canonical: [] as Array<{ data: unknown; error: unknown }>,
  };
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
      categoryQuery = 'exact';
      return categoryBuilder;
    }),
    or: vi.fn((filter: string) => {
      categoryOrSpy(filter);
      categoryQuery = 'canonical';
      return categoryBuilder;
    }),
    range: vi.fn((from: number, to: number) => {
      categoryRangeSpy(from, to);
      const page = Math.floor(from / 256);
      const configuredPages = categoryPages[categoryQuery];
      return Promise.resolve(
        configuredPages[page] ??
          (page === 0
            ? categoryQuery === 'canonical'
              ? canonicalCategoryResult
              : categoryResult
            : { data: [], error: null })
      );
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
  return {
    categoryInSpy,
    categoryPages,
    categoryRangeSpy,
    categoryOrSpy,
    inSpy,
    supabase,
  };
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
    const { categoryInSpy, categoryRangeSpy, inSpy, supabase } = makeSupabase(
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
    expect(categoryRangeSpy).toHaveBeenCalledWith(0, 255);
  });

  it('preserves apostrophes when building category fallback candidates', async () => {
    const { categoryInSpy, supabase } = makeSupabase(
      { data: [], error: null },
      { data: [], error: null }
    );

    await expect(
      getPublishedBlogPostSlugsForProducts(
        supabase as never,
        'merchant-1',
        [],
        ["women's-fashion"]
      )
    ).resolves.toEqual([]);

    expect(categoryInSpy).toHaveBeenCalledWith('category', [
      "women's-fashion",
      "women's fashion",
      "Women's Fashion",
    ]);
  });

  it('matches punctuation-bearing categories through canonical normalization', async () => {
    const { categoryOrSpy, supabase } = makeSupabase(
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [
          {
            slug: 'product-news-guide',
            status: 'published',
            published_at: '2026-08-03',
            category: 'Product & News!',
          },
        ],
        error: null,
      }
    );

    const result = await getPublishedBlogPostSlugsForProducts(
      supabase as never,
      'merchant-1',
      [],
      ['product-news']
    );

    expect(result).toEqual(['product-news-guide']);
    expect(categoryOrSpy).toHaveBeenCalledWith('category.ilike.*product*news*');
  });

  it('paginates category fallback posts beyond one page', async () => {
    const firstPage = Array.from({ length: 256 }, (_, index) => ({
      slug: index === 0 ? 'newest-fallback' : `fallback-${index}`,
      status: 'published',
      published_at: `2026-08-${String(31 - (index % 28)).padStart(2, '0')}`,
      category: 'smartphones',
    }));
    const { categoryPages, categoryRangeSpy, supabase } = makeSupabase(
      { data: [], error: null },
      { data: firstPage, error: null },
      { data: [], error: null }
    );
    categoryPages.exact[1] = {
      data: [
        {
          slug: 'oldest-fallback',
          status: 'published',
          published_at: '2025-01-01',
          category: 'smartphones',
        },
      ],
      error: null,
    };

    const result = await getPublishedBlogPostSlugsForProducts(
      supabase as never,
      'merchant-1',
      [],
      ['smartphones']
    );

    expect(result).toContain('newest-fallback');
    expect(result).toContain('oldest-fallback');
    expect(categoryRangeSpy).toHaveBeenCalledWith(256, 511);
  });
});

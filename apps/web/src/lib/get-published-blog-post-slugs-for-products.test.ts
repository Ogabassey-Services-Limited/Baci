import { describe, expect, it } from 'vitest';
import { getPublishedBlogPostSlugsForProducts } from './get-published-blog-post-slugs-for-products';
import { makeSupabase } from './get-published-blog-post-slugs-for-products.test-support';

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
    expect(categoryOrSpy.mock.calls[0]?.[0]).toContain(
      'category.ilike.*product*news*'
    );
  });

  it('matches canonical categories when the stored label contains an apostrophe', async () => {
    const { categoryOrSpy, supabase } = makeSupabase(
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [
          {
            slug: 'womens-fashion-guide',
            status: 'published',
            published_at: '2026-08-04',
            category: "Women's Fashion",
          },
        ],
        error: null,
      }
    );

    const result = await getPublishedBlogPostSlugsForProducts(
      supabase as never,
      'merchant-1',
      [],
      ['womens-fashion']
    );

    expect(result).toEqual(['womens-fashion-guide']);
    expect(categoryOrSpy.mock.calls[0]?.[0]).toContain(
      'category.ilike.*women*s*fashion*'
    );
  });
});

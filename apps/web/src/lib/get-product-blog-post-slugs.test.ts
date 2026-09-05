import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { getProductBlogPostSlugs } from './get-product-blog-post-slugs';

describe('getProductBlogPostSlugs', () => {
  it('returns unique published linked post slugs for the changed products', async () => {
    // Arrange
    const inSpy = vi.fn(() =>
      Promise.resolve({
        data: [
          { blog_posts: { slug: 'iphone-guide' } },
          { blog_posts: [{ slug: 'iphone-guide' }] },
          { blog_posts: { slug: 'compare-phones' } },
        ],
        error: null,
      })
    );
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ in: inSpy })),
        })),
      })),
    } as unknown as SupabaseClient;

    // Act
    const slugs = await getProductBlogPostSlugs(supabase, 'merchant-1', [
      'product-1',
      'product-1',
      ' ',
    ]);

    // Assert
    expect(slugs).toEqual(['iphone-guide', 'compare-phones']);
    expect(inSpy).toHaveBeenCalledWith('product_id', ['product-1']);
  });

  it('returns no slugs without querying when no product IDs are supplied', async () => {
    // Arrange
    const from = vi.fn();
    const supabase = { from } as unknown as SupabaseClient;

    // Act
    const slugs = await getProductBlogPostSlugs(supabase, 'merchant-1', []);

    // Assert
    expect(slugs).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});

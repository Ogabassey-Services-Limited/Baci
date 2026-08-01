import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { getOrderedBlogPostProductLinks } from '@/lib/ordered-blog-post-product-links';

describe('getOrderedBlogPostProductLinks', () => {
  it('orders a post’s embedded product links by the author-selected position', () => {
    const query = {
      eq: vi.fn(),
      order: vi.fn(),
    };
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    const select = vi.fn(() => query);
    const from = vi.fn(() => ({ select }));

    getOrderedBlogPostProductLinks(
      { from } as unknown as SupabaseClient,
      'merchant-1',
      'post-1'
    );

    expect(from).toHaveBeenCalledWith('blog_post_products');
    expect(select).toHaveBeenCalledWith(
      'relationship, product:products!blog_post_products_product_id_fkey(id, name, slug, status, categories:category_id(slug))'
    );
    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(query.eq).toHaveBeenCalledWith('blog_post_id', 'post-1');
    expect(query.order).toHaveBeenCalledWith('position', { ascending: true });
  });
});

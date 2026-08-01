import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  hasPermission: vi.fn(),
  resolveAccess: vi.fn(),
}));

vi.mock('@/app/api/merchant/features/resolve-selected-merchant-access', () => ({
  resolveSelectedMerchantAccess: mocks.resolveAccess,
}));
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticate,
  hasPermission: mocks.hasPermission,
}));

import { getBlogPost } from './get-blog-post';

describe('getBlogPost', () => {
  it('returns only the selected merchant post with its ordered embedded products', async () => {
    const postQuery = {
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'post-1', slug: 'summer', title: 'Summer' },
        error: null,
      }),
    };
    postQuery.select.mockReturnValue(postQuery);
    postQuery.eq.mockReturnValue(postQuery);
    const productQuery = {
      eq: vi.fn(),
      order: vi.fn().mockResolvedValue({
        data: [{ product_id: 'product-1' }, { product_id: 'product-2' }],
        error: null,
      }),
      select: vi.fn(),
    };
    productQuery.select.mockReturnValue(productQuery);
    productQuery.eq.mockReturnValue(productQuery);
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(postQuery)
        .mockReturnValueOnce(productQuery),
    };
    mocks.authenticate.mockResolvedValue({
      supabase,
      user: { id: 'user-1' },
    });
    mocks.resolveAccess.mockResolvedValue({
      access: { merchantId: 'merchant-1', role: 'owner' },
      invalidMerchantId: false,
    });
    mocks.hasPermission.mockReturnValue(true);

    const response = await getBlogPost(
      new NextRequest(
        'http://localhost/api/merchant/blog/posts/post-1?merchantId=merchant-1'
      ),
      { params: Promise.resolve({ id: 'post-1' }) }
    );

    expect(await response.json()).toEqual({
      embedded_products: ['product-1', 'product-2'],
      id: 'post-1',
      slug: 'summer',
      title: 'Summer',
    });
    expect(postQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(productQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(productQuery.eq).toHaveBeenCalledWith('blog_post_id', 'post-1');
  });
});

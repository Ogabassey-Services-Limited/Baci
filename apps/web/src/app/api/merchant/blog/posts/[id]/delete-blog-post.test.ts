import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  checkCsrf: vi.fn(),
  getRevalidationContext: vi.fn(),
  hasPermission: vi.fn(),
  revalidate: vi.fn(),
  resolveAccess: vi.fn(),
}));

vi.mock('@/app/api/merchant/features/resolve-selected-merchant-access', () => ({
  resolveSelectedMerchantAccess: mocks.resolveAccess,
}));
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticate,
  hasPermission: mocks.hasPermission,
}));
vi.mock('@/lib/cache-revalidation', () => ({
  revalidateBlogPosts: mocks.revalidate,
}));
vi.mock('@/lib/csrf', () => ({ checkCsrfProtection: mocks.checkCsrf }));
vi.mock('@/lib/get-merchant-blog-cache-identifiers', () => ({
  getMerchantBlogRevalidationContext: mocks.getRevalidationContext,
}));

import { deleteBlogPost } from './delete-blog-post';

describe('deleteBlogPost', () => {
  it('deletes a merchant-owned post and revalidates its affected listing category', async () => {
    const lookupQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { category: 'fashion', slug: 'summer-look' },
        error: null,
      }),
      select: vi.fn(),
    };
    lookupQuery.select.mockReturnValue(lookupQuery);
    lookupQuery.eq.mockReturnValue(lookupQuery);
    const deleteQuery = { eq: vi.fn() };
    deleteQuery.eq
      .mockReturnValueOnce(deleteQuery)
      .mockResolvedValueOnce({ error: null });
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(lookupQuery)
        .mockReturnValueOnce({
          delete: vi.fn().mockReturnValue(deleteQuery),
        }),
    };
    mocks.authenticate.mockResolvedValue({ supabase, user: { id: 'user-1' } });
    mocks.checkCsrf.mockResolvedValue({ response: null, valid: true });
    mocks.resolveAccess.mockResolvedValue({
      access: { merchantId: 'merchant-1', role: 'owner' },
      invalidMerchantId: false,
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.getRevalidationContext.mockResolvedValue({
      canonicalMerchantSlug: 'store',
      identifiers: ['store'],
    });

    const response = await deleteBlogPost(
      new NextRequest(
        'http://localhost/api/merchant/blog/posts/post-1?merchantId=merchant-1',
        { method: 'DELETE' }
      ),
      { params: Promise.resolve({ id: 'post-1' }) }
    );

    expect(await response.json()).toEqual({ success: true });
    expect(deleteQuery.eq).toHaveBeenNthCalledWith(1, 'id', 'post-1');
    expect(deleteQuery.eq).toHaveBeenNthCalledWith(
      2,
      'merchant_id',
      'merchant-1'
    );
    expect(mocks.revalidate).toHaveBeenCalledWith({
      canonicalMerchantSlug: 'store',
      identifiers: ['store'],
      listingCategories: ['fashion'],
      merchantId: 'merchant-1',
      postSlugs: ['summer-look'],
    });
  });
});

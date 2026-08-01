import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  checkCsrf: vi.fn(),
  hasPermission: vi.fn(),
  loadPost: vi.fn(),
  resolveAccess: vi.fn(),
}));

vi.mock('@/app/api/merchant/features/resolve-selected-merchant-access', () => ({
  resolveSelectedMerchantAccess: mocks.resolveAccess,
}));
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticate,
  hasPermission: mocks.hasPermission,
}));
vi.mock('@/lib/csrf', () => ({ checkCsrfProtection: mocks.checkCsrf }));
vi.mock('./load-blog-post-for-update', () => ({
  loadBlogPostForUpdate: mocks.loadPost,
}));

import { updateBlogPost } from './update-blog-post';

describe('updateBlogPost', () => {
  it('does not disclose or update a post outside the selected merchant', async () => {
    const supabase = { from: vi.fn() };
    mocks.authenticate.mockResolvedValue({ supabase, user: { id: 'user-1' } });
    mocks.checkCsrf.mockResolvedValue({ response: null, valid: true });
    mocks.resolveAccess.mockResolvedValue({
      access: { merchantId: 'merchant-1', role: 'owner' },
      invalidMerchantId: false,
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.loadPost.mockResolvedValue({ kind: 'not-found' });

    const response = await updateBlogPost(
      new NextRequest(
        'http://localhost/api/merchant/blog/posts/foreign-post?merchantId=merchant-1',
        { body: JSON.stringify({ title: 'Attempted update' }), method: 'PATCH' }
      ),
      { params: Promise.resolve({ id: 'foreign-post' }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Post not found' });
    expect(mocks.loadPost).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      postId: 'foreign-post',
      supabase,
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

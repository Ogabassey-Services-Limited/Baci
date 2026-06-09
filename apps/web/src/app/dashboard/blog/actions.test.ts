import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensurePermission: vi.fn(),
  getBlogPreviewSecret: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@/env', () => ({
  getBlogPreviewSecret: mocks.getBlogPreviewSecret,
}));

vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: (...args: unknown[]) => mocks.ensurePermission(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
  })),
}));

const { getPreviewUrl } = await import('./actions');

describe('getPreviewUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.ensurePermission.mockResolvedValue({
      merchant: { id: 'merchant-1', slug: 'store slug' },
      staffAccess: { isOwner: true },
    });
    mocks.getBlogPreviewSecret.mockReturnValue('secret+/=');
  });

  it('requires an authenticated dashboard caller before returning preview secret URL', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(getPreviewUrl('store', 'draft-post')).rejects.toThrow(
      'Unauthorized'
    );

    expect(mocks.ensurePermission).not.toHaveBeenCalled();
    expect(mocks.getBlogPreviewSecret).not.toHaveBeenCalled();
  });

  it('returns an encoded preview URL after marketing view authorization', async () => {
    const url = await getPreviewUrl('store slug', 'draft/post');

    expect(mocks.ensurePermission).toHaveBeenCalledWith('marketing', 'view');
    expect(url).toBe(
      '/api/blog/preview?secret=secret%2B%2F%3D&slug=draft%2Fpost&merchantSlug=store%20slug'
    );
  });

  it('rejects preview URL generation for a different merchant slug', async () => {
    await expect(getPreviewUrl('other-store', 'draft-post')).rejects.toThrow(
      'Merchant not found or access denied'
    );

    expect(mocks.getBlogPreviewSecret).not.toHaveBeenCalled();
  });
});

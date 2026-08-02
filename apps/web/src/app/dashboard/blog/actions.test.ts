import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMerchantForApiRequest: vi.fn(),
  getBlogPreviewSecret: vi.fn(),
  getUser: vi.fn(),
}));

const mockSupabase = vi.hoisted(() => ({
  auth: {
    getUser: mocks.getUser,
  },
}));

vi.mock('@/env', () => ({
  getBlogPreviewSecret: mocks.getBlogPreviewSecret,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mocks.getMerchantForApiRequest(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

const { getPreviewUrl } = await import('./actions');
const getPreviewUrlFromUntrustedInput = getPreviewUrl as unknown as (
  merchantId: unknown,
  merchantSlug: string,
  postSlug: string
) => Promise<string>;

const selectedMerchantId = '22222222-2222-4222-8222-222222222222';

describe('getPreviewUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.getMerchantForApiRequest.mockResolvedValue({
      merchantId: selectedMerchantId,
      merchantSlug: 'store slug',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: { full_access: { all: true } },
        role: null,
      },
    });
    mocks.getBlogPreviewSecret.mockReturnValue('secret+/=');
  });

  it('requires an authenticated dashboard caller before returning preview secret URL', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(
      getPreviewUrl(selectedMerchantId, 'store', 'draft-post')
    ).rejects.toThrow('Unauthorized');

    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(mocks.getBlogPreviewSecret).not.toHaveBeenCalled();
  });

  it('returns an encoded preview URL after authorizing the explicitly selected merchant', async () => {
    const url = await getPreviewUrl(
      selectedMerchantId,
      'store slug',
      'draft/post'
    );

    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      mockSupabase,
      'user-1',
      { requestedMerchantId: selectedMerchantId }
    );
    expect(url).toBe(
      '/api/blog/preview?secret=secret%2B%2F%3D&slug=draft%2Fpost&merchantSlug=store%20slug'
    );
  });

  it('rejects a malformed merchant ID before resolving merchant access', async () => {
    await expect(
      getPreviewUrl('not-a-uuid', 'store slug', 'draft-post')
    ).rejects.toThrow('Merchant not found or access denied');

    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(mocks.getBlogPreviewSecret).not.toHaveBeenCalled();
  });

  it.each([
    null,
    42,
    { id: selectedMerchantId },
  ])('rejects a non-string merchant ID (%p) through the controlled denial path', async (merchantId) => {
    await expect(
      getPreviewUrlFromUntrustedInput(merchantId, 'store slug', 'draft-post')
    ).rejects.toThrow('Merchant not found or access denied');

    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(mocks.getBlogPreviewSecret).not.toHaveBeenCalled();
  });

  it('rejects preview URL generation for a different merchant slug', async () => {
    await expect(
      getPreviewUrl(selectedMerchantId, 'other-store', 'draft-post')
    ).rejects.toThrow('Merchant not found or access denied');

    expect(mocks.getBlogPreviewSecret).not.toHaveBeenCalled();
  });

  it('rejects a selected merchant without marketing view permission', async () => {
    mocks.getMerchantForApiRequest.mockResolvedValueOnce({
      merchantId: selectedMerchantId,
      merchantSlug: 'store slug',
      staffAccess: {
        isOwner: false,
        isStaff: true,
        permissions: { marketing: { view: false } },
        role: 'viewer',
      },
    });

    await expect(
      getPreviewUrl(selectedMerchantId, 'store slug', 'draft-post')
    ).rejects.toThrow('Merchant not found or access denied');

    expect(mocks.getBlogPreviewSecret).not.toHaveBeenCalled();
  });
});

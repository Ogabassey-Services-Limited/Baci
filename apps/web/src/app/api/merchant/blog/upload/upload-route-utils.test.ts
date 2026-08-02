import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const mockToUserAccess = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: (...args: unknown[]) => mockToUserAccess(...args),
}));

const { resolveMerchantAccess, resolveUploadPurpose } = await import(
  './upload-route-utils'
);

const merchantId = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
const access = {
  merchantId,
  isOwner: true,
  isStaff: false,
  role: 'owner',
  permissions: { '*': { '*': true } },
};

describe('resolveUploadPurpose', () => {
  it('normalizes a supported featured purpose and falls back safely for unsupported input', () => {
    expect(resolveUploadPurpose(' FEATURED ')).toBe('featured');
    expect(resolveUploadPurpose('avatar')).toBe('inline');
    expect(resolveUploadPurpose(null)).toBe('inline');
  });
});

describe('resolveMerchantAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMerchantForApiRequest.mockResolvedValue({ merchantId });
    mockToUserAccess.mockReturnValue(access);
    mockHasPermission.mockReturnValue(true);
  });

  function resolve(headers = new Headers()) {
    return resolveMerchantAccess({
      headers,
      supabase: {} as never,
      userId: 'user-1',
    });
  }

  it('rejects an invalid selected merchant identifier before resolving access', async () => {
    const result = await resolve(
      new Headers({ 'x-baci-merchant-id': 'not-a-uuid' })
    );

    expect(result.access).toBeNull();
    expect(result.response?.status).toBe(400);
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('returns a not-found response when no accessible merchant exists', async () => {
    mockGetMerchantForApiRequest.mockResolvedValue(null);

    const result = await resolve();

    expect(result.access).toBeNull();
    expect(result.response?.status).toBe(404);
  });

  it('returns a permission response when marketing edits are not allowed', async () => {
    mockHasPermission.mockReturnValue(false);

    const result = await resolve();

    expect(result.access).toBeNull();
    expect(result.response?.status).toBe(403);
  });
});

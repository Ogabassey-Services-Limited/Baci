import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveCategoryOwnerAccess = vi.hoisted(() => vi.fn());
vi.mock('./resolve-category-owner-access', () => ({
  resolveCategoryOwnerAccess,
}));

import { resolveCategoryRouteContext } from './resolve-category-route-context';

const AUTH = { userId: 'user-1', supabase: {} } as Parameters<
  typeof resolveCategoryRouteContext
>[0];

describe('resolveCategoryRouteContext', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the selected merchant for its owner', async () => {
    resolveCategoryOwnerAccess.mockResolvedValue({
      kind: 'owner',
      canonicalMerchantSlug: 'merchant-one',
      merchantId: 'merchant-1',
    });

    const result = await resolveCategoryRouteContext(AUTH, 'merchant-1');

    expect(result).toMatchObject({
      ok: true,
      context: {
        canonicalMerchantSlug: 'merchant-one',
        merchantId: 'merchant-1',
      },
    });
    expect(resolveCategoryOwnerAccess).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'merchant-1'
    );
  });

  it.each([
    ['lookup-failed', 500],
    ['absent', 404],
    ['staff', 403],
  ] as const)('maps %s access to %i', async (kind, status) => {
    resolveCategoryOwnerAccess.mockResolvedValue({ kind });

    const result = await resolveCategoryRouteContext(AUTH);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(status);
  });

  it('returns the stable owner-only error code for staff', async () => {
    resolveCategoryOwnerAccess.mockResolvedValue({ kind: 'staff' });
    const result = await resolveCategoryRouteContext(AUTH);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      await expect(result.response.json()).resolves.toMatchObject({
        code: 'CATEGORY_OWNER_ONLY',
      });
    }
  });
});

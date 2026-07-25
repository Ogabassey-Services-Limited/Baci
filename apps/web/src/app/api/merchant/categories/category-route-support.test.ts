import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchantForApiRequest,
  toUserAccess: (ctx: { staffAccess: { isOwner?: boolean } }) => ({
    isOwner: ctx.staffAccess.isOwner,
  }),
}));

import { resolveCategoryRouteContext } from './category-route-support';

const MERCHANT_ID = 'merchant-1';

function setUser(user: { id: string } | null) {
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  });
}

function setMerchant(overrides: Record<string, unknown> = {}) {
  mocks.getMerchantForApiRequest.mockResolvedValue({
    merchantId: MERCHANT_ID,
    merchantSlug: 'test-store',
    staffAccess: { isOwner: true, isStaff: false },
    ...overrides,
  });
}

const request = new Request('https://baci.app/api/merchant/categories', {
  method: 'POST',
});

describe('resolveCategoryRouteContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser({ id: 'user-1' });
    setMerchant();
  });

  it('resolves the merchant server-side for an owner', async () => {
    const result = await resolveCategoryRouteContext(request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.merchantId).toBe(MERCHANT_ID);
      // Identifiers drive server-side purge hostname resolution.
      expect(result.context.merchantIdentifiers).toEqual(['test-store']);
    }
  });

  it('returns 401 when unauthenticated', async () => {
    setUser(null);

    const result = await resolveCategoryRouteContext(request);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('returns 404 when the user has no merchant', async () => {
    mocks.getMerchantForApiRequest.mockResolvedValue(null);

    const result = await resolveCategoryRouteContext(request);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(404);
  });

  describe('permission contract is owner-only', () => {
    it('denies staff even with broad permissions', async () => {
      // Deliberate: categories_merchant_* RLS has no staff branch, so allowing
      // staff here would diverge from the database and fail at the write.
      setMerchant({
        staffAccess: {
          isOwner: false,
          isStaff: true,
          permissions: { full_access: { all: true } },
        },
      });

      const result = await resolveCategoryRouteContext(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
        await expect(result.response.json()).resolves.toMatchObject({
          code: 'CATEGORY_OWNER_ONLY',
        });
      }
    });
  });

  describe('cross-merchant assertion', () => {
    it('rejects a mismatched client-supplied merchant id with 403', async () => {
      const result = await resolveCategoryRouteContext(
        request,
        'some-other-merchant'
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(403);
    });

    it('accepts a matching assertion', async () => {
      const result = await resolveCategoryRouteContext(request, MERCHANT_ID);

      expect(result.ok).toBe(true);
    });

    it('never lets the client id select the tenant', async () => {
      // No assertion supplied -> still the server-resolved merchant.
      const result = await resolveCategoryRouteContext(request);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.context.merchantId).toBe(MERCHANT_ID);
    });
  });
});

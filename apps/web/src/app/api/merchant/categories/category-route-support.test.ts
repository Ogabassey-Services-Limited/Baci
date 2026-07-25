import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  getStorefrontPublicationCacheIdentity: vi.fn(),
}));

vi.mock('@/lib/supabase/mobile-auth', () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchantForApiRequest,
  toUserAccess: (ctx: { staffAccess: { isOwner?: boolean } }) => ({
    isOwner: ctx.staffAccess.isOwner,
  }),
}));
vi.mock('@/lib/get-storefront-publication-cache-identity', () => ({
  getStorefrontPublicationCacheIdentity:
    mocks.getStorefrontPublicationCacheIdentity,
}));

import { z } from 'zod';
import {
  assertRequestedMerchant,
  type CategoryRouteContext,
  firstValidationMessage,
  isParentCategoryOwnedByMerchant,
  resolveCategoryRouteContext,
} from './category-route-support';

const MERCHANT_ID = 'merchant-1';

function setUser(user: { id: string } | null) {
  // getAuthenticatedUser handles BOTH Bearer (mobile) and cookie (web).
  mocks.getAuthenticatedUser.mockResolvedValue({ user, supabase: {} });
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
    mocks.getStorefrontPublicationCacheIdentity.mockResolvedValue({
      identifiers: ['test-store'],
    });
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

  it('returns 401 when the auth helper resolves to nothing at all', async () => {
    // getAuthenticatedUser returns null (not { user: null }) for a missing or
    // unparseable Bearer token — a bare `.user` read here would have thrown.
    mocks.getAuthenticatedUser.mockResolvedValue(null);

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

  it('carries retired slugs and custom domains into the purge identifiers', async () => {
    // A renamed merchant still serves the OLD hostname from the edge, and a
    // slug-null merchant with a live custom domain would otherwise resolve to
    // zero hostnames and skip eviction entirely.
    mocks.getStorefrontPublicationCacheIdentity.mockResolvedValue({
      identifiers: ['test-store', 'old-store', 'shop.example.com'],
    });

    const result = await resolveCategoryRouteContext(request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.merchantIdentifiers).toEqual([
        'test-store',
        'old-store',
        'shop.example.com',
      ]);
    }
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

  it('never lets a client value select the tenant', async () => {
    // The resolver takes no body input at all, by construction.
    expect(resolveCategoryRouteContext).toHaveLength(1);

    const result = await resolveCategoryRouteContext(request);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.merchantId).toBe(MERCHANT_ID);
  });
});

describe('assertRequestedMerchant', () => {
  const context = {
    merchantId: MERCHANT_ID,
    merchantIdentifiers: ['test-store'],
    supabase: {},
  } as unknown as CategoryRouteContext;

  it('rejects a mismatched client-supplied merchant id with 403', () => {
    const response = assertRequestedMerchant(context, 'some-other-merchant');

    expect(response?.status).toBe(403);
  });

  it('accepts a matching assertion', () => {
    expect(assertRequestedMerchant(context, MERCHANT_ID)).toBeNull();
  });

  it('accepts an absent assertion', () => {
    expect(assertRequestedMerchant(context)).toBeNull();
  });
});

describe('isParentCategoryOwnedByMerchant', () => {
  function supabaseReturning(data: { id: string } | null) {
    const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
    const eqMerchant = vi.fn(() => ({ maybeSingle }));
    const eqId = vi.fn(() => ({ eq: eqMerchant }));
    const select = vi.fn(() => ({ eq: eqId }));
    const from = vi.fn(() => ({ select }));
    return {
      client: { from } as unknown as CategoryRouteContext['supabase'],
      select,
      eqId,
      eqMerchant,
    };
  }

  it('accepts a parent belonging to the same merchant', async () => {
    const { client, select, eqId, eqMerchant } = supabaseReturning({
      id: 'parent-1',
    });

    await expect(
      isParentCategoryOwnedByMerchant(client, MERCHANT_ID, 'parent-1')
    ).resolves.toBe(true);

    expect(select).toHaveBeenCalledWith('id');
    expect(eqId).toHaveBeenCalledWith('id', 'parent-1');
    expect(eqMerchant).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
  });

  it('rejects a parent owned by a DIFFERENT merchant', async () => {
    // The FK alone only proves the UUID exists somewhere in `categories`, so
    // without the merchant scope an owner could nest under a foreign tenant.
    const { client } = supabaseReturning(null);

    await expect(
      isParentCategoryOwnedByMerchant(client, MERCHANT_ID, 'foreign-parent')
    ).resolves.toBe(false);
  });
});

describe('firstValidationMessage', () => {
  it('surfaces the specific rule that failed', () => {
    // mobile-admin derives the slug from the NAME, so "Checkout" is rejected
    // through no visible fault of the merchant's — "Invalid input" alone gives
    // them nothing to correct, and fieldErrors never reaches the toast.
    const error = z
      .object({ slug: z.string().refine(() => false, 'That slug is reserved') })
      .safeParse({ slug: 'checkout' });

    expect(error.success).toBe(false);
    if (!error.success) {
      expect(firstValidationMessage(error.error)).toBe('That slug is reserved');
    }
  });

  it('falls back to a generic message when there are no issues', () => {
    expect(
      firstValidationMessage({ issues: [] } as unknown as z.ZodError)
    ).toBe('Invalid input');
  });
});

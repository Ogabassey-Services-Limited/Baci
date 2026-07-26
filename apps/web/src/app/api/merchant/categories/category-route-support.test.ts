import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  resolveCategoryOwnerAccess: vi.fn(),
}));

vi.mock('@/lib/supabase/mobile-auth', () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));
vi.mock('./resolve-category-owner-access', () => ({
  resolveCategoryOwnerAccess: mocks.resolveCategoryOwnerAccess,
}));

import { z } from 'zod';
import {
  authenticateCategoryRequest,
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

function setMerchant() {
  mocks.resolveCategoryOwnerAccess.mockResolvedValue({
    kind: 'owner',
    merchantId: MERCHANT_ID,
  });
}

const request = new Request('https://baci.app/api/merchant/categories', {
  method: 'POST',
});

const AUTH = { userId: 'user-1', supabase: {} } as Parameters<
  typeof resolveCategoryRouteContext
>[0];

describe('resolveCategoryRouteContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser({ id: 'user-1' });
    setMerchant();
  });

  it('resolves the merchant server-side for an owner', async () => {
    const result = await resolveCategoryRouteContext(AUTH);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.merchantId).toBe(MERCHANT_ID);
    }
  });

  it('returns 404 when the user has no merchant', async () => {
    mocks.resolveCategoryOwnerAccess.mockResolvedValue({ kind: 'absent' });

    const result = await resolveCategoryRouteContext(AUTH);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(404);
  });

  describe('permission contract is owner-only', () => {
    it('denies staff even with broad permissions', async () => {
      // Deliberate: categories_merchant_* RLS has no staff branch, so allowing
      // staff here would diverge from the database and fail at the write.
      mocks.resolveCategoryOwnerAccess.mockResolvedValue({ kind: 'staff' });

      const result = await resolveCategoryRouteContext(AUTH);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
        await expect(result.response.json()).resolves.toMatchObject({
          code: 'CATEGORY_OWNER_ONLY',
        });
      }
    });
  });

  it('forwards the asserted merchant id as a SELECTOR to the access-scoped lookup', async () => {
    // resolveCategoryOwnerAccess filters owners by user_id and staff by active
    // membership, so the id only selects among merchants the caller reaches.
    await resolveCategoryRouteContext(AUTH, 'store-b');

    expect(mocks.resolveCategoryOwnerAccess).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'store-b'
    );
  });

  it('returns 500 when merchant access lookup fails', async () => {
    mocks.resolveCategoryOwnerAccess.mockResolvedValue({
      kind: 'lookup-failed',
    });

    const result = await resolveCategoryRouteContext(AUTH);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(500);
  });
});

describe('authenticateCategoryRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser({ id: 'user-1' });
  });

  it('resolves the caller for a valid session', async () => {
    const result = await authenticateCategoryRequest(request);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.auth.userId).toBe('user-1');
  });

  it('returns 401 when unauthenticated', async () => {
    setUser(null);

    const result = await authenticateCategoryRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('returns 401 when the auth helper resolves to nothing at all', async () => {
    // getAuthenticatedUser returns null (not { user: null }) for a missing or
    // unparseable Bearer token — a bare `.user` read would have thrown.
    mocks.getAuthenticatedUser.mockResolvedValue(null);

    const result = await authenticateCategoryRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });
});

describe('isParentCategoryOwnedByMerchant', () => {
  function supabaseReturning(
    data: { id: string; is_active?: boolean | null } | null
  ) {
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
      is_active: true,
    });

    await expect(
      isParentCategoryOwnedByMerchant(client, MERCHANT_ID, 'parent-1')
    ).resolves.toBe('owned');

    expect(select).toHaveBeenCalledWith('id, is_active');
    expect(eqId).toHaveBeenCalledWith('id', 'parent-1');
    expect(eqMerchant).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
  });

  it('rejects a parent owned by a DIFFERENT merchant', async () => {
    // The FK alone only proves the UUID exists somewhere in `categories`, so
    // without the merchant scope an owner could nest under a foreign tenant.
    const { client } = supabaseReturning(null);

    await expect(
      isParentCategoryOwnedByMerchant(client, MERCHANT_ID, 'foreign-parent')
    ).resolves.toBe('absent');
  });

  it('rejects a RETIRED parent so an active child is not orphaned', async () => {
    // Navigation walks down from `parent_id IS NULL`; a live child under a
    // tombstone is servable but invisible — the same orphaning DELETE avoids.
    const { client } = supabaseReturning({ id: 'parent-1', is_active: false });

    await expect(
      isParentCategoryOwnedByMerchant(client, MERCHANT_ID, 'parent-1')
    ).resolves.toBe('retired');
  });

  it('rejects a null-active parent hidden by public reads', async () => {
    const { client } = supabaseReturning({
      id: 'parent-1',
      is_active: null,
    });

    await expect(
      isParentCategoryOwnedByMerchant(client, MERCHANT_ID, 'parent-1')
    ).resolves.toBe('retired');
  });

  it('reports a lookup FAILURE distinctly from absence', async () => {
    // A transient error also yields data: null. Collapsing the two answered a
    // non-retryable 400 PARENT_NOT_FOUND for a parent that exists.
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'timeout' } });
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
        })),
      })),
    } as unknown as CategoryRouteContext['supabase'];

    await expect(
      isParentCategoryOwnedByMerchant(client, MERCHANT_ID, 'parent-1')
    ).resolves.toBe('lookup-failed');
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

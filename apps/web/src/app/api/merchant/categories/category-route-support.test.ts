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
  authenticateCategoryRequest,
  type CategoryRouteContext,
  firstValidationMessage,
  isParentCategoryOwnedByMerchant,
  resolveCategoryRouteContext,
  wouldCreateCategoryCycle,
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

const AUTH = { userId: 'user-1', supabase: {} } as Parameters<
  typeof resolveCategoryRouteContext
>[0];

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
    const result = await resolveCategoryRouteContext(AUTH);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.merchantId).toBe(MERCHANT_ID);
      // Identifiers drive server-side purge hostname resolution.
      expect(result.context.merchantIdentifiers).toEqual(['test-store']);
    }
  });

  it('returns 404 when the user has no merchant', async () => {
    mocks.getMerchantForApiRequest.mockResolvedValue(null);

    const result = await resolveCategoryRouteContext(AUTH);

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

    const result = await resolveCategoryRouteContext(AUTH);

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
    // getMerchantForApiRequest filters owned merchants by user_id and staff
    // rows by active membership, so the id can only pick among merchants the
    // caller already reaches — it never grants access.
    await resolveCategoryRouteContext(AUTH, 'store-b');

    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { requestedMerchantId: 'store-b' }
    );
  });

  describe('purge identity is auxiliary and must not fail the mutation', () => {
    it('falls back to the canonical slug when the identity lookup throws', async () => {
      // The domains / retired-slug reads exist only to widen the best-effort
      // edge purge; a transient failure there previously 500'd the mutation.
      mocks.getStorefrontPublicationCacheIdentity.mockRejectedValue(
        new Error('domains table unavailable')
      );

      const result = await resolveCategoryRouteContext(AUTH);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.context.merchantIdentifiers).toEqual(['test-store']);
      }
    });
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
    ).resolves.toBe('owned');

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
    ).resolves.toBe('absent');
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

describe('wouldCreateCategoryCycle', () => {
  const CATEGORY = 'cat-self';

  /** Minimal `categories` table keyed by id, answering parent_id lookups. */
  function supabaseWithTree(tree: Record<string, string | null>) {
    return {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn((_idCol: string, id: string) => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: id in tree ? { parent_id: tree[id] } : null,
                error: null,
              }),
            })),
          })),
        })),
      })),
    } as unknown as CategoryRouteContext['supabase'];
  }

  it('rejects self-parenting without any query', async () => {
    const client = supabaseWithTree({});

    await expect(
      wouldCreateCategoryCycle(client, MERCHANT_ID, CATEGORY, CATEGORY)
    ).resolves.toBe(true);
  });

  it('rejects a parent that is a DESCENDANT of the category', async () => {
    // cat-self -> child -> grandchild. Re-parenting cat-self under grandchild
    // would close a loop and detach the whole branch from navigation.
    const client = supabaseWithTree({
      grandchild: 'child',
      child: CATEGORY,
      [CATEGORY]: null,
    });

    await expect(
      wouldCreateCategoryCycle(client, MERCHANT_ID, CATEGORY, 'grandchild')
    ).resolves.toBe(true);
  });

  it('accepts an unrelated parent', async () => {
    const client = supabaseWithTree({ other: null, [CATEGORY]: null });

    await expect(
      wouldCreateCategoryCycle(client, MERCHANT_ID, CATEGORY, 'other')
    ).resolves.toBe(false);
  });

  it('accepts a parent whose chain leaves this merchant', async () => {
    // A row the merchant cannot read has no path back to `categoryId`;
    // ownership is enforced separately by isParentCategoryOwnedByMerchant.
    const client = supabaseWithTree({ other: 'unreadable' });

    await expect(
      wouldCreateCategoryCycle(client, MERCHANT_ID, CATEGORY, 'other')
    ).resolves.toBe(false);
  });

  it('fails closed when an ancestor lookup ERRORS', async () => {
    // A failed read cannot prove the absence of a loop; answering "no cycle"
    // would let a transient error write the very edge this guard prevents.
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
      wouldCreateCategoryCycle(client, MERCHANT_ID, CATEGORY, 'other')
    ).resolves.toBe(true);
  });

  it('fails closed on a pre-existing loop rather than spinning forever', async () => {
    // a -> b -> a already in the data, and neither is the edited category.
    const client = supabaseWithTree({ a: 'b', b: 'a' });

    await expect(
      wouldCreateCategoryCycle(client, MERCHANT_ID, CATEGORY, 'a')
    ).resolves.toBe(true);
  });
});

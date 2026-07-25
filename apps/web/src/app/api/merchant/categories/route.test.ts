import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateCategoryRequest: vi.fn(),
  resolveCategoryRouteContext: vi.fn(),
  isParentCategoryOwnedByMerchant: vi.fn(),
  checkCsrfProtection: vi.fn(),
  invalidateCategoryCaches: vi.fn(),
}));

vi.mock('./category-route-support', async () => {
  return {
    authenticateCategoryRequest: mocks.authenticateCategoryRequest,
    resolveCategoryRouteContext: mocks.resolveCategoryRouteContext,
    isParentCategoryOwnedByMerchant: mocks.isParentCategoryOwnedByMerchant,
    firstValidationMessage: (error: { issues: Array<{ message: string }> }) =>
      error.issues[0]?.message ?? 'Invalid input',
  };
});
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));
vi.mock('@/lib/category-cache-invalidation', () => ({
  invalidateCategoryCaches: mocks.invalidateCategoryCaches,
}));

import { POST } from './route';

const MERCHANT_ID = 'merchant-1';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';

/** Captures the row handed to `.insert()` so sanitization can be asserted. */
let insertedRow: Record<string, unknown> | null = null;

/** Captures the row handed to the tombstone-revive `.update()`. */
let revivedRow: Record<string, unknown> | null = null;

function supabaseInserting(
  result: {
    data?: unknown;
    error?: { code?: string; message: string };
    /** Row the revive update finds (null => no tombstone to revive). */
    revives?: { id: string; name: string; slug: string } | null;
  } = {}
) {
  return {
    from: vi.fn(() => ({
      insert: vi.fn((row: Record<string, unknown>) => {
        insertedRow = row;
        return {
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: result.error
                ? null
                : (result.data ?? {
                    id: 'cat-1',
                    name: 'Phones',
                    slug: 'phones',
                    is_active: true,
                  }),
              error: result.error ?? null,
            }),
          })),
        };
      }),
      update: vi.fn((row: Record<string, unknown>) => {
        revivedRow = row;
        return {
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: result.revives ?? null,
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        };
      }),
    })),
  };
}

function setContext(supabase: unknown) {
  mocks.authenticateCategoryRequest.mockResolvedValue({
    ok: true,
    auth: { userId: 'user-1', supabase },
  });
  mocks.resolveCategoryRouteContext.mockResolvedValue({
    ok: true,
    context: {
      merchantId: MERCHANT_ID,
      merchantIdentifiers: ['test-store'],
      supabase,
    },
  });
}

function postRequest(body: unknown) {
  return new NextRequest('https://baci.app/api/merchant/categories', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { name: 'Phones', slug: 'phones' };

describe('POST /api/merchant/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedRow = null;
    revivedRow = null;
    setContext(supabaseInserting());
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.isParentCategoryOwnedByMerchant.mockResolvedValue('owned');
    mocks.invalidateCategoryCaches.mockReturnValue({
      revalidatedSlugs: ['phones'],
      revalidated: true,
      purgeAttemptedHostnames: ['test-store.baci.app'],
      edgePurgeScheduled: true,
    });
  });

  it('creates the category and invalidates the new slug', async () => {
    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      category: { id: 'cat-1', slug: 'phones' },
    });
    expect(mocks.invalidateCategoryCaches).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: MERCHANT_ID, nextSlug: 'phones' })
    );
  });

  it('scopes the insert to the SERVER-resolved merchant', async () => {
    await POST(
      postRequest({ ...VALID_BODY, merchantId: MERCHANT_ID, isActive: false })
    );

    expect(insertedRow).toMatchObject({
      merchant_id: MERCHANT_ID,
      is_active: false,
    });
  });

  describe('authentication runs before anything else', () => {
    it('returns 401 without touching CSRF or the request body', async () => {
      mocks.authenticateCategoryRequest.mockResolvedValue({
        ok: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      });
      const request = postRequest(VALID_BODY);
      const json = vi.spyOn(request, 'json');

      const response = await POST(request);

      expect(response.status).toBe(401);
      // An unauthenticated caller must not reach CSRF handling or JSON parsing.
      expect(mocks.checkCsrfProtection).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
    });

    it('propagates the 403 for a non-owner', async () => {
      mocks.resolveCategoryRouteContext.mockResolvedValue({
        ok: false,
        response: NextResponse.json(
          { error: 'Permission denied', code: 'CATEGORY_OWNER_ONLY' },
          { status: 403 }
        ),
      });

      const response = await POST(postRequest(VALID_BODY));

      expect(response.status).toBe(403);
    });
  });

  it('returns 403 when CSRF validation fails', async () => {
    mocks.checkCsrfProtection.mockResolvedValue({ valid: false });

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(403);
  });

  describe('input validation', () => {
    it('returns 400 for malformed JSON', async () => {
      const request = new NextRequest(
        'https://baci.app/api/merchant/categories',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{ not json',
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: 'MALFORMED_JSON',
      });
    });

    it('returns 400 for a missing name', async () => {
      const response = await POST(postRequest({ slug: 'phones' }));

      expect(response.status).toBe(400);
    });

    it('returns 400 for a slug that collides with a storefront route', async () => {
      const response = await POST(
        postRequest({ name: 'Cart', slug: 'checkout' })
      );

      expect(response.status).toBe(400);
      // The merchant must be told WHY — mobile derives this slug from the name.
      await expect(response.json()).resolves.toMatchObject({
        error: expect.stringMatching(/reserved/i),
        code: 'INVALID_INPUT',
      });
    });

    it('passes the asserted merchantId through as a SELECTOR, not authority', async () => {
      // getMerchantForApiRequest filters owned merchants by user_id and staff
      // rows by active membership, so an id the caller cannot reach 404s.
      // Ignoring it broke multi-store owners: the app shows the lowest merchant
      // UUID while this server defaults to the most recently created one.
      await POST(postRequest({ ...VALID_BODY, merchantId: 'store-b' }));

      expect(mocks.resolveCategoryRouteContext).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
        'store-b'
      );
    });

    it('returns 404 when the asserted merchant is not reachable by the caller', async () => {
      mocks.resolveCategoryRouteContext.mockResolvedValue({
        ok: false,
        response: NextResponse.json(
          { error: 'Merchant not found' },
          { status: 404 }
        ),
      });

      const response = await POST(
        postRequest({ ...VALID_BODY, merchantId: 'someone-elses-store' })
      );

      expect(response.status).toBe(404);
    });
  });

  describe('parent must belong to the same merchant', () => {
    it('returns 400 when the parent belongs to another tenant', async () => {
      mocks.isParentCategoryOwnedByMerchant.mockResolvedValue('absent');

      const response = await POST(
        postRequest({ ...VALID_BODY, parentId: PARENT_ID })
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: 'PARENT_NOT_FOUND',
      });
    });

    it('skips the lookup when no parent is supplied', async () => {
      await POST(postRequest(VALID_BODY));

      expect(mocks.isParentCategoryOwnedByMerchant).not.toHaveBeenCalled();
    });
  });

  describe('bugfix: merchant-authored text is sanitized server-side', () => {
    it('writes the SANITIZED value the schema produced', async () => {
      // mobile-admin sanitized before its direct insert; routing the write
      // through the API must not become the weaker path. Sanitization moved
      // into the schema so `.min(1)` guards the value actually stored.
      await POST(
        postRequest({
          name: '<script>alert(1)</script>Phones',
          slug: 'phones',
          description: '<img src=x onerror=alert(1)>Best phones',
        })
      );

      expect(insertedRow?.name).not.toContain('<script>');
      expect(String(insertedRow?.description)).not.toContain('onerror');
    });

    it('rejects a name that is nothing but markup', async () => {
      // `<b></b>` passed the old `.min(1)` and reached the insert as '',
      // creating a blank category (categories.name is only NOT NULL).
      const response = await POST(
        postRequest({ name: '<b></b>', slug: 'phones' })
      );

      expect(response.status).toBe(400);
      expect(insertedRow).toBeNull();
    });
  });

  describe('parent lookup failures are not absence', () => {
    it('returns 500, not a non-retryable 400, when the lookup errors', async () => {
      mocks.isParentCategoryOwnedByMerchant.mockResolvedValue('lookup-failed');

      const response = await POST(
        postRequest({ ...VALID_BODY, parentId: PARENT_ID })
      );

      expect(response.status).toBe(500);
    });
  });

  it('maps a duplicate LIVE slug to 409, not 500', async () => {
    setContext(
      supabaseInserting({
        error: { code: '23505', message: 'duplicate key' },
        revives: null, // no inactive row -> nothing to revive
      })
    );

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'CATEGORY_SLUG_TAKEN',
    });
  });

  describe('bugfix: DELETE leaves a tombstone, so the slug must stay reusable', () => {
    it('revives an inactive category with the same slug instead of 409ing', async () => {
      setContext(
        supabaseInserting({
          error: { code: '23505', message: 'duplicate key' },
          revives: { id: 'cat-1', name: 'Phones', slug: 'phones' },
        })
      );

      const response = await POST(postRequest(VALID_BODY));

      expect(response.status).toBe(201);
      // The revive is scoped to is_active=false rows and reactivates them.
      expect(revivedRow).toMatchObject({ is_active: true, slug: 'phones' });
    });
  });

  it('returns 500 for any other database error', async () => {
    setContext(
      supabaseInserting({ error: { code: '42501', message: 'denied by RLS' } })
    );

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(500);
  });
});

import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateCategoryRequest: vi.fn(),
  resolveCategoryRouteContext: vi.fn(),
  promoteChildrenToRoots: vi.fn(),
  validateCategoryParent: vi.fn(),
  checkCsrfProtection: vi.fn(),
  invalidateCategoryCaches: vi.fn(),
}));

vi.mock('./category-route-support', async () => {
  return {
    authenticateCategoryRequest: mocks.authenticateCategoryRequest,
    resolveCategoryRouteContext: mocks.resolveCategoryRouteContext,
    promoteChildrenToRoots: mocks.promoteChildrenToRoots,
    firstValidationMessage: (error: { issues: Array<{ message: string }> }) =>
      error.issues[0]?.message ?? 'Invalid input',
  };
});
vi.mock('./validate-category-parent', () => ({
  validateCategoryParent: mocks.validateCategoryParent,
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));
vi.mock('@/lib/category-cache-invalidation', () => ({
  invalidateCategoryCaches: mocks.invalidateCategoryCaches,
}));

import { POST } from './route';

const MERCHANT_ID = 'merchant-1';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_MERCHANT = '33333333-3333-4333-8333-333333333333';

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
    /** Error the revive lookup itself returns. */
    reviveError?: { message: string } | null;
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
                    data: result.reviveError ? null : (result.revives ?? null),
                    error: result.reviveError ?? null,
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
    mocks.validateCategoryParent.mockResolvedValue(null);
    mocks.promoteChildrenToRoots.mockResolvedValue(0);
    mocks.invalidateCategoryCaches.mockReturnValue({
      revalidatedSlugs: ['phones'],
      revalidated: true,
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
    await POST(postRequest({ ...VALID_BODY, isActive: false }));

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
      await POST(postRequest({ ...VALID_BODY, merchantId: OTHER_MERCHANT }));

      expect(mocks.resolveCategoryRouteContext).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
        OTHER_MERCHANT
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
        postRequest({ ...VALID_BODY, merchantId: OTHER_MERCHANT })
      );

      expect(response.status).toBe(404);
    });
  });

  describe('parent validation is delegated, and its refusal is returned', () => {
    it('propagates the refusal response verbatim', async () => {
      const { NextResponse: Response } = await import('next/server');
      mocks.validateCategoryParent.mockResolvedValue(
        Response.json({ code: 'PARENT_RETIRED' }, { status: 400 })
      );

      const response = await POST(
        postRequest({ ...VALID_BODY, parentId: PARENT_ID })
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: 'PARENT_RETIRED',
      });
    });

    it('passes no categoryId, because a create has none yet', async () => {
      await POST(postRequest({ ...VALID_BODY, parentId: PARENT_ID }));

      expect(mocks.validateCategoryParent).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: PARENT_ID })
      );
      expect(
        mocks.validateCategoryParent.mock.calls[0]?.[0]
      ).not.toHaveProperty('categoryId');
    });

    it('skips validation entirely when no parent is supplied', async () => {
      await POST(postRequest(VALID_BODY));

      expect(mocks.validateCategoryParent).not.toHaveBeenCalled();
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

  describe('bugfix: reviving a tombstone republished its old SEO copy', () => {
    it('clears the retired row seo_* fields on revive', async () => {
      setContext(
        supabaseInserting({
          error: { code: '23505', message: 'duplicate key' },
          revives: { id: 'cat-1', name: 'Phones', slug: 'phones' },
        })
      );

      await POST(postRequest(VALID_BODY));

      // getCachedCategoryPageShellData reads these straight onto the public
      // page, so a reused slug would inherit the deleted category's copy.
      expect(revivedRow).toMatchObject({
        seo_description: null,
        seo_faq: null,
        seo_features: null,
        seo_heading: null,
      });
    });
  });

  describe('revive lookup failures are not "no tombstone"', () => {
    it('returns 500 rather than a misleading duplicate-slug 409', async () => {
      setContext(
        supabaseInserting({
          error: { code: '23505', message: 'duplicate key' },
          reviveError: { message: 'connection reset' },
        })
      );

      const response = await POST(postRequest(VALID_BODY));

      // A 409 would tell the client to stop retrying something transient.
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

import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveCategoryRouteContext: vi.fn(),
  isParentCategoryOwnedByMerchant: vi.fn(),
  checkCsrfProtection: vi.fn(),
  invalidateCategoryCaches: vi.fn(),
}));

vi.mock('./category-route-support', async () => {
  const { NextResponse: Response } = await import('next/server');
  return {
    resolveCategoryRouteContext: mocks.resolveCategoryRouteContext,
    isParentCategoryOwnedByMerchant: mocks.isParentCategoryOwnedByMerchant,
    // Real implementation — the assertion is part of what this suite exercises.
    firstValidationMessage: (error: { issues: Array<{ message: string }> }) =>
      error.issues[0]?.message ?? 'Invalid input',
    assertRequestedMerchant: (
      context: { merchantId: string },
      requested?: string
    ) =>
      requested && requested !== context.merchantId
        ? Response.json({ error: 'Permission denied' }, { status: 403 })
        : null,
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

function supabaseInserting(
  result: { data?: unknown; error?: { code?: string; message: string } } = {}
) {
  return {
    from: vi.fn(() => ({
      insert: vi.fn((row: Record<string, unknown>) => {
        insertedRow = row;
        return {
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: result.data ?? {
                id: 'cat-1',
                name: 'Phones',
                slug: 'phones',
                is_active: true,
              },
              error: result.error ?? null,
            }),
          })),
        };
      }),
    })),
  };
}

function setContext(supabase: unknown) {
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
    setContext(supabaseInserting());
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.isParentCategoryOwnedByMerchant.mockResolvedValue(true);
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
      mocks.resolveCategoryRouteContext.mockResolvedValue({
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

    it('returns 403 when the client asserts a different merchant', async () => {
      const response = await POST(
        postRequest({ ...VALID_BODY, merchantId: 'someone-else' })
      );

      expect(response.status).toBe(403);
    });
  });

  describe('parent must belong to the same merchant', () => {
    it('returns 400 when the parent belongs to another tenant', async () => {
      mocks.isParentCategoryOwnedByMerchant.mockResolvedValue(false);

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
    it('strips markup from name and description before insert', async () => {
      // mobile-admin sanitized before its direct insert; routing the write
      // through the API must not become the weaker path.
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
  });

  it('maps a duplicate slug to 409, not 500', async () => {
    setContext(
      supabaseInserting({ error: { code: '23505', message: 'duplicate key' } })
    );

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'CATEGORY_SLUG_TAKEN',
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

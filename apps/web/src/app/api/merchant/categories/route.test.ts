import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateCategoryRequest: vi.fn(),
  resolveCategoryRouteContext: vi.fn(),
  validateCategoryParent: vi.fn(),
  checkCsrfProtection: vi.fn(),
  invalidateCategoryCaches: vi.fn(),
}));

vi.mock('./category-route-support', async () => {
  return {
    authenticateCategoryRequest: mocks.authenticateCategoryRequest,
    resolveCategoryRouteContext: mocks.resolveCategoryRouteContext,
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
const OTHER_MERCHANT = '33333333-3333-4333-8333-333333333333';

/** Captures the row handed to `.insert()` so sanitization can be asserted. */
let insertedRow: Record<string, unknown> | null = null;
let activeSupabase: ReturnType<typeof supabaseInserting>;

function supabaseInserting() {
  return {
    from: vi.fn(() => ({
      insert: vi.fn((row: Record<string, unknown>) => {
        insertedRow = row;
        return {
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'cat-1',
                name: 'Phones',
                slug: 'phones',
                is_active: true,
              },
              error: null,
            }),
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
      canonicalMerchantSlug: 'merchant-one',
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('POST /api/merchant/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedRow = null;
    activeSupabase = supabaseInserting();
    setContext(activeSupabase);
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.validateCategoryParent.mockResolvedValue(null);
    mocks.invalidateCategoryCaches.mockResolvedValue({
      revalidatedSlugs: ['phones'],
      revalidated: true,
      vercelEvicted: true,
    });
  });

  it('creates the category and invalidates the new slug', async () => {
    const invalidation = createDeferred<{
      revalidatedSlugs: string[];
      revalidated: boolean;
      vercelEvicted: boolean;
    }>();
    mocks.invalidateCategoryCaches.mockReturnValueOnce(invalidation.promise);

    const responsePromise = POST(postRequest(VALID_BODY));
    await vi.waitFor(() =>
      expect(mocks.invalidateCategoryCaches).toHaveBeenCalledOnce()
    );
    let responseSettled = false;
    void responsePromise.then(() => {
      responseSettled = true;
    });
    await Promise.resolve();
    expect(responseSettled).toBe(false);

    invalidation.resolve({
      revalidatedSlugs: ['phones'],
      revalidated: true,
      vercelEvicted: true,
    });
    const response = await responsePromise;

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      category: { id: 'cat-1', slug: 'phones' },
    });
    expect(mocks.invalidateCategoryCaches).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalMerchantSlug: 'merchant-one',
        merchantId: MERCHANT_ID,
        nextSlug: 'phones',
        supabase: activeSupabase,
      })
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
});

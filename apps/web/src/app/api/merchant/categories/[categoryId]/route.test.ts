import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateCategoryRequest: vi.fn(),
  resolveCategoryRouteContext: vi.fn(),
  getCategoryChildSlugs: vi.fn(),
  validateCategoryParent: vi.fn(),
  checkCsrfProtection: vi.fn(),
  invalidateCategoryCaches: vi.fn(),
}));

vi.mock('../category-route-support', async () => {
  return {
    authenticateCategoryRequest: mocks.authenticateCategoryRequest,
    resolveCategoryRouteContext: mocks.resolveCategoryRouteContext,
    firstValidationMessage: (error: { issues: Array<{ message: string }> }) =>
      error.issues[0]?.message ?? 'Invalid input',
  };
});
vi.mock('../validate-category-parent', () => ({
  validateCategoryParent: mocks.validateCategoryParent,
}));
vi.mock('../get-category-child-slugs', () => ({
  getCategoryChildSlugs: mocks.getCategoryChildSlugs,
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));
vi.mock('@/lib/category-cache-invalidation', () => ({
  invalidateCategoryCaches: mocks.invalidateCategoryCaches,
}));

import { DELETE, PATCH } from './route';

const MERCHANT_ID = 'merchant-1';
const CATEGORY_ID = '22222222-2222-4222-8222-222222222222';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';

interface TableState {
  /** Row returned by the pre-mutation read (null => 404). */
  existing?: { id: string; slug: string } | null;
  updated?: Record<string, unknown> | null;
  updateError?: { code?: string; message: string } | null;
  deleted?: { id: string; slug: string } | null;
  deleteError?: { message: string } | null;
}

/** Captures the patch handed to `.update()`. */
let updatedRow: Record<string, unknown> | null = null;

function supabaseFor(state: TableState) {
  const existing =
    state.existing === undefined
      ? { id: CATEGORY_ID, slug: 'phones' }
      : state.existing;

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: existing, error: null }),
          })),
        })),
      })),
      update: vi.fn((row: Record<string, unknown>) => {
        updatedRow = row;
        const result = {
          data:
            state.deleted === undefined
              ? { id: CATEGORY_ID, slug: 'phones' }
              : state.deleted,
          error: state.deleteError ?? null,
        };
        return {
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              // Distinguished by projection. PATCH selects the full row
              // and calls single(); DELETE selects 'id, slug' and calls
              // maybeSingle().
              select: vi.fn((columns: string) => {
                if (columns === 'id, slug') {
                  return { maybeSingle: vi.fn().mockResolvedValue(result) };
                }
                return {
                  single: vi.fn().mockResolvedValue({
                    data:
                      state.updated ??
                      (state.updateError
                        ? null
                        : {
                            id: CATEGORY_ID,
                            name: 'Phones',
                            slug: 'mobile-phones',
                            is_active: true,
                          }),
                    error: state.updateError ?? null,
                  }),
                };
              }),
            })),
          })),
        };
      }),
    })),
  };
}

function setContext(state: TableState = {}) {
  const supabase = supabaseFor(state);
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

function params(categoryId = CATEGORY_ID) {
  return { params: Promise.resolve({ categoryId }) };
}

function patchRequest(body: unknown) {
  return new NextRequest(
    `https://baci.app/api/merchant/categories/${CATEGORY_ID}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

const MERCHANT_UUID = '33333333-3333-4333-8333-333333333333';

function deleteRequest(merchantId?: string) {
  const query = merchantId ? `?merchantId=${merchantId}` : '';
  return new NextRequest(
    `https://baci.app/api/merchant/categories/${CATEGORY_ID}${query}`,
    { method: 'DELETE' }
  );
}

const UNAUTHORIZED = {
  ok: false,
  response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
};

function setUnauthenticated() {
  mocks.authenticateCategoryRequest.mockResolvedValue(UNAUTHORIZED);
}

beforeEach(() => {
  vi.clearAllMocks();
  updatedRow = null;
  setContext();
  mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
  mocks.validateCategoryParent.mockResolvedValue(null);
  mocks.getCategoryChildSlugs.mockResolvedValue({ ok: true, slugs: [] });
  mocks.invalidateCategoryCaches.mockReturnValue({
    revalidatedSlugs: ['phones', 'mobile-phones'],
    revalidated: true,
  });
});

describe('PATCH /api/merchant/categories/[categoryId]', () => {
  it('renames and invalidates BOTH the old and new slug', async () => {
    const response = await PATCH(
      patchRequest({ slug: 'mobile-phones' }),
      params()
    );

    expect(response.status).toBe(200);
    expect(mocks.invalidateCategoryCaches).toHaveBeenCalledWith(
      expect.objectContaining({
        previousSlug: 'phones',
        nextSlug: 'mobile-phones',
      })
    );
  });

  it('returns 401 without touching CSRF or the request body', async () => {
    setUnauthenticated();
    const request = patchRequest({ slug: 'mobile-phones' });
    const json = vi.spyOn(request, 'json');

    const response = await PATCH(request, params());

    expect(response.status).toBe(401);
    expect(mocks.checkCsrfProtection).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it('returns 403 when CSRF validation fails', async () => {
    mocks.checkCsrfProtection.mockResolvedValue({ valid: false });

    const response = await PATCH(patchRequest({ slug: 'x' }), params());

    expect(response.status).toBe(403);
  });

  describe('bugfix: a non-UUID id is a 400, not a driver-level 500', () => {
    it('rejects a malformed categoryId before any query runs', async () => {
      // Postgres answers 22P02 for a non-UUID, which surfaced as a 500.
      const response = await PATCH(
        patchRequest({ slug: 'phones' }),
        params('not-a-uuid')
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: 'INVALID_CATEGORY_ID',
      });
    });
  });

  it('returns 400 for an empty patch', async () => {
    const response = await PATCH(patchRequest({}), params());

    expect(response.status).toBe(400);
  });

  it('returns 404 when the category belongs to another merchant', async () => {
    setContext({ existing: null });

    const response = await PATCH(patchRequest({ slug: 'x-1' }), params());

    expect(response.status).toBe(404);
  });

  describe('parent validation is delegated and includes this category', () => {
    it('propagates the refusal response verbatim', async () => {
      const { NextResponse: Response } = await import('next/server');
      mocks.validateCategoryParent.mockResolvedValue(
        Response.json({ code: 'PARENT_CYCLE' }, { status: 400 })
      );

      const response = await PATCH(
        patchRequest({ parentId: PARENT_ID }),
        params()
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: 'PARENT_CYCLE',
      });
    });

    it('passes the edited categoryId so the ancestor walk can run', async () => {
      await PATCH(patchRequest({ parentId: PARENT_ID }), params());

      expect(mocks.validateCategoryParent).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: PARENT_ID,
          categoryId: CATEGORY_ID,
        })
      );
    });
  });

  it('writes the sanitized name and description the schema produced', async () => {
    await PATCH(
      patchRequest({
        name: '<script>alert(1)</script>Phones',
        description: '<img src=x onerror=alert(1)>Best',
      }),
      params()
    );

    expect(String(updatedRow?.name)).not.toContain('<script>');
    expect(String(updatedRow?.description)).not.toContain('onerror');
  });

  it('rejects a rename to markup-only text instead of blanking the name', async () => {
    const response = await PATCH(patchRequest({ name: '<b></b>' }), params());

    expect(response.status).toBe(400);
    expect(updatedRow).toBeNull();
  });

  describe('a deactivating PATCH owes the same subtree contract as DELETE', () => {
    it('reports the children promoted by the atomic lifecycle trigger', async () => {
      mocks.getCategoryChildSlugs.mockResolvedValue({
        ok: true,
        slugs: ['android', 'ios', 'tablets'],
      });

      const response = await PATCH(patchRequest({ isActive: false }), params());

      expect(mocks.getCategoryChildSlugs).toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        detachedChildren: 3,
      });
    });

    it('leaves children alone for an ordinary rename', async () => {
      await PATCH(patchRequest({ slug: 'mobile-phones' }), params());

      expect(mocks.getCategoryChildSlugs).not.toHaveBeenCalled();
    });
  });

  it('maps a duplicate slug to 409', async () => {
    setContext({ updateError: { code: '23505', message: 'duplicate key' } });

    const response = await PATCH(patchRequest({ slug: 'taken' }), params());

    expect(response.status).toBe(409);
  });
});

describe('DELETE /api/merchant/categories/[categoryId]', () => {
  it('retires the category and invalidates the removed slug', async () => {
    const response = await DELETE(deleteRequest(), params());

    expect(response.status).toBe(200);
    expect(mocks.invalidateCategoryCaches).toHaveBeenCalledWith(
      expect.objectContaining({ previousSlug: 'phones' })
    );
  });

  describe('bugfix: children of a retired parent became unreachable', () => {
    it('reports promoted children and invalidates their slugs', async () => {
      // Navigation walks DOWN from `parent_id IS NULL`; a child still pointing
      // at a retired parent is neither retired nor reachable.
      mocks.getCategoryChildSlugs.mockResolvedValue({
        ok: true,
        slugs: ['android', 'ios'],
      });

      const response = await DELETE(deleteRequest(), params());

      await expect(response.json()).resolves.toMatchObject({
        detachedChildren: 2,
        childrenDetached: true,
      });
      expect(mocks.invalidateCategoryCaches).toHaveBeenCalledWith(
        expect.objectContaining({ relatedSlugs: ['android', 'ios'] })
      );
    });

    it('fails before retirement when child cache identities cannot be read', async () => {
      mocks.getCategoryChildSlugs.mockResolvedValue({ ok: false });

      const response = await DELETE(deleteRequest(), params());

      expect(response.status).toBe(500);
      expect(updatedRow).toBeNull();
    });

    it('accepts a merchantId selector so multi-store owners can delete', async () => {
      // Without it, getMerchantForApiRequest picks the owner's most recent
      // store and every other store 404s.
      await DELETE(deleteRequest(MERCHANT_UUID), params());

      expect(mocks.resolveCategoryRouteContext).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
        MERCHANT_UUID
      );
    });

    it('rejects a non-UUID merchantId selector with 400', async () => {
      const response = await DELETE(deleteRequest('not-a-uuid'), params());

      expect(response.status).toBe(400);
    });
  });

  describe('bugfix: a hard delete revives the category URL', () => {
    it('tombstones the row instead of removing it', async () => {
      // Removing the row makes getCachedCategoryPageShellData fall back to
      // `{ kind: 'legacy' }`, which matches products on the retained
      // `products.category` text — the "deleted" page keeps serving them.
      // An INACTIVE row maps to `{ kind: 'none' }`, i.e. genuinely empty.
      await DELETE(deleteRequest(), params());

      expect(updatedRow).toMatchObject({ is_active: false });
    });
  });

  it('returns 401 before CSRF handling', async () => {
    setUnauthenticated();

    const response = await DELETE(deleteRequest(), params());

    expect(response.status).toBe(401);
    expect(mocks.checkCsrfProtection).not.toHaveBeenCalled();
  });

  it('rejects a malformed categoryId with 400', async () => {
    const response = await DELETE(deleteRequest(), params('not-a-uuid'));

    expect(response.status).toBe(400);
  });

  it('returns 404 when nothing was deleted', async () => {
    setContext({ deleted: null });

    const response = await DELETE(deleteRequest(), params());

    expect(response.status).toBe(404);
    expect(mocks.invalidateCategoryCaches).not.toHaveBeenCalled();
  });
});

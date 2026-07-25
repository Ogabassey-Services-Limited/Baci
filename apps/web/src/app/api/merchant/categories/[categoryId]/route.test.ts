import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateCategoryRequest: vi.fn(),
  resolveCategoryRouteContext: vi.fn(),
  isParentCategoryOwnedByMerchant: vi.fn(),
  wouldCreateCategoryCycle: vi.fn(),
  checkCsrfProtection: vi.fn(),
  invalidateCategoryCaches: vi.fn(),
}));

vi.mock('../category-route-support', async () => {
  return {
    authenticateCategoryRequest: mocks.authenticateCategoryRequest,
    resolveCategoryRouteContext: mocks.resolveCategoryRouteContext,
    isParentCategoryOwnedByMerchant: mocks.isParentCategoryOwnedByMerchant,
    wouldCreateCategoryCycle: mocks.wouldCreateCategoryCycle,
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
  /** Rows the children-detach update reports. */
  detached?: Array<{ slug: string }>;
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
        // The children-detach update sets parent_id and is not the row under
        // test, so it must not clobber `updatedRow`.
        if (
          !('parent_id' in row && row.parent_id === null && !('name' in row))
        ) {
          updatedRow = row;
        }
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
              // and calls single(); the DELETE tombstone selects 'id, slug'
              // and calls maybeSingle(); the children-detach update selects
              // 'slug' and awaits the builder directly.
              select: vi.fn((columns: string) => {
                if (columns === 'slug') {
                  return Promise.resolve({
                    data: state.detached ?? [],
                    error: null,
                  });
                }
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
      merchantIdentifiers: ['test-store'],
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

function deleteRequest() {
  return new NextRequest(
    `https://baci.app/api/merchant/categories/${CATEGORY_ID}`,
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
  mocks.isParentCategoryOwnedByMerchant.mockResolvedValue('owned');
  mocks.wouldCreateCategoryCycle.mockResolvedValue(false);
  mocks.invalidateCategoryCaches.mockReturnValue({
    revalidatedSlugs: ['phones', 'mobile-phones'],
    revalidated: true,
    purgeAttemptedHostnames: ['test-store.baci.app'],
    edgePurgeScheduled: true,
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

  describe('parent integrity', () => {
    it('rejects a parent that would close a loop', async () => {
      // Not just self-parenting: storefront navigation walks down from
      // `parent_id IS NULL` roots, so ANY ancestor loop detaches the branch.
      mocks.wouldCreateCategoryCycle.mockResolvedValue(true);

      const response = await PATCH(
        patchRequest({ parentId: PARENT_ID }),
        params()
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: 'PARENT_CYCLE',
      });
    });

    it('checks ownership BEFORE walking the ancestor chain', async () => {
      mocks.isParentCategoryOwnedByMerchant.mockResolvedValue('absent');

      await PATCH(patchRequest({ parentId: PARENT_ID }), params());

      // A foreign parent must not have its chain walked at all.
      expect(mocks.wouldCreateCategoryCycle).not.toHaveBeenCalled();
    });

    it('returns 500, not 400, when the parent lookup itself fails', async () => {
      mocks.isParentCategoryOwnedByMerchant.mockResolvedValue('lookup-failed');

      const response = await PATCH(
        patchRequest({ parentId: PARENT_ID }),
        params()
      );

      expect(response.status).toBe(500);
    });

    it('rejects a parent owned by another merchant', async () => {
      mocks.isParentCategoryOwnedByMerchant.mockResolvedValue('absent');

      const response = await PATCH(
        patchRequest({ parentId: PARENT_ID }),
        params()
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: 'PARENT_NOT_FOUND',
      });
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
    it('promotes children to roots so they stay browsable', async () => {
      // Navigation walks DOWN from `parent_id IS NULL`; a child still pointing
      // at a retired parent is neither retired nor reachable.
      setContext({ detached: [{ slug: 'android' }, { slug: 'ios' }] });

      const response = await DELETE(deleteRequest(), params());

      await expect(response.json()).resolves.toMatchObject({
        detachedChildren: 2,
        childrenDetached: true,
      });
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

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

import { PATCH } from './route';
import {
  CATEGORY_ID,
  createCategoryRouteTestHarness,
  createDeferred,
} from './route.test-support';

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const {
  getUpdatedRow,
  params,
  patchRequest,
  reset,
  setContext,
  setUnauthenticated,
} = createCategoryRouteTestHarness(mocks);

beforeEach(() => {
  reset();
});

describe('PATCH /api/merchant/categories/[categoryId]', () => {
  it('rejects reactivation when the stored slug is now reserved', async () => {
    setContext({
      existing: { id: CATEGORY_ID, slug: 'featured', is_active: false },
    });

    const response = await PATCH(patchRequest({ isActive: true }), params());

    expect(response.status).toBe(400);
    expect(getUpdatedRow()).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });

  it('renames and invalidates BOTH the old and new slug', async () => {
    const invalidation = createDeferred<{
      revalidatedSlugs: string[];
      revalidated: boolean;
      vercelEvicted: boolean;
    }>();
    mocks.invalidateCategoryCaches.mockReturnValueOnce(invalidation.promise);

    const responsePromise = PATCH(
      patchRequest({ slug: 'mobile-phones' }),
      params()
    );
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
      revalidatedSlugs: ['phones', 'mobile-phones'],
      revalidated: true,
      vercelEvicted: true,
    });
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(mocks.invalidateCategoryCaches).toHaveBeenCalledWith(
      expect.objectContaining({
        previousSlug: 'phones',
        nextSlug: 'mobile-phones',
      })
    );
  });

  it('rejects a rename when the slug changed after the authoritative read', async () => {
    setContext({ updated: null });

    const response = await PATCH(
      patchRequest({ slug: 'mobile-phones' }),
      params()
    );

    expect(response.status).toBe(409);
    expect(mocks.invalidateCategoryCaches).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: 'CATEGORY_CONCURRENT_UPDATE',
    });
  });

  it('rejects a same-slug edit when the category version changed after the read', async () => {
    setContext({ updated: null });

    const response = await PATCH(
      patchRequest({ name: 'Updated phones' }),
      params()
    );

    expect(response.status).toBe(409);
    expect(mocks.invalidateCategoryCaches).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: 'CATEGORY_CONCURRENT_UPDATE',
    });
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

  it('returns 500 when the authoritative category lookup fails', async () => {
    setContext({ existingError: { message: 'database unavailable' } });

    const response = await PATCH(patchRequest({ slug: 'x-1' }), params());

    expect(response.status).toBe(500);
    expect(getUpdatedRow()).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: 'Could not load the category',
    });
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

    expect(String(getUpdatedRow()?.name)).not.toContain('<script>');
    expect(String(getUpdatedRow()?.description)).not.toContain('onerror');
  });

  it('rejects a rename to markup-only text instead of blanking the name', async () => {
    const response = await PATCH(patchRequest({ name: '<b></b>' }), params());

    expect(response.status).toBe(400);
    expect(getUpdatedRow()).toBeNull();
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

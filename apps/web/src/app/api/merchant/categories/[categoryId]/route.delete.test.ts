import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateCategoryRequest: vi.fn(),
  resolveCategoryRouteContext: vi.fn(),
  getCategoryChildSlugs: vi.fn(),
  validateCategoryParent: vi.fn(),
  checkCsrfProtection: vi.fn(),
  invalidateCategoryCaches: vi.fn(),
}));

vi.mock('../category-route-support', () => ({
  authenticateCategoryRequest: mocks.authenticateCategoryRequest,
  resolveCategoryRouteContext: mocks.resolveCategoryRouteContext,
  firstValidationMessage: (error: { issues: Array<{ message: string }> }) =>
    error.issues[0]?.message ?? 'Invalid input',
}));
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

import { DELETE } from './route';
import {
  createCategoryRouteTestHarness,
  createDeferred,
  MERCHANT_UUID,
} from './route.test-support';

const {
  deleteRequest,
  getUpdatedRow,
  params,
  reset,
  setContext,
  setUnauthenticated,
} = createCategoryRouteTestHarness(mocks);

beforeEach(() => reset());

describe('DELETE /api/merchant/categories/[categoryId]', () => {
  it('retires the category and invalidates the removed slug', async () => {
    const invalidation = createDeferred<{
      revalidatedSlugs: string[];
      revalidated: boolean;
      vercelEvicted: boolean;
    }>();
    mocks.invalidateCategoryCaches.mockReturnValueOnce(invalidation.promise);

    const responsePromise = DELETE(deleteRequest(), params());
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

    expect(response.status).toBe(200);
    expect(mocks.invalidateCategoryCaches).toHaveBeenCalledWith(
      expect.objectContaining({ previousSlug: 'phones' })
    );
  });

  it('reports promoted children and invalidates their slugs', async () => {
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
    expect(getUpdatedRow()).toBeNull();
  });

  it('accepts a merchantId selector for multi-store owners', async () => {
    await DELETE(deleteRequest(MERCHANT_UUID), params());

    expect(mocks.resolveCategoryRouteContext).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      MERCHANT_UUID
    );
  });

  it('rejects a non-UUID merchantId selector with 400', async () => {
    expect((await DELETE(deleteRequest('not-a-uuid'), params())).status).toBe(
      400
    );
  });

  it('tombstones the row instead of reviving the legacy URL', async () => {
    await DELETE(deleteRequest(), params());

    expect(getUpdatedRow()).toMatchObject({ is_active: false });
  });

  it('returns 401 before CSRF handling', async () => {
    setUnauthenticated();

    expect((await DELETE(deleteRequest(), params())).status).toBe(401);
    expect(mocks.checkCsrfProtection).not.toHaveBeenCalled();
  });

  it('rejects a malformed categoryId with 400', async () => {
    expect((await DELETE(deleteRequest(), params('not-a-uuid'))).status).toBe(
      400
    );
  });

  it('returns 404 when nothing was retired', async () => {
    setContext({ deleted: null });

    const response = await DELETE(deleteRequest(), params());

    expect(response.status).toBe(404);
    expect(mocks.invalidateCategoryCaches).not.toHaveBeenCalled();
  });
});

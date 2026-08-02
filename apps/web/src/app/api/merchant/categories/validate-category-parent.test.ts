import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  categoryHasChildren: vi.fn(),
  isParentCategoryOwnedByMerchant: vi.fn(),
  wouldCreateCategoryCycle: vi.fn(),
}));

vi.mock('./category-route-support', () => ({
  categoryHasChildren: mocks.categoryHasChildren,
  isParentCategoryOwnedByMerchant: mocks.isParentCategoryOwnedByMerchant,
  wouldCreateCategoryCycle: mocks.wouldCreateCategoryCycle,
}));

import { validateCategoryParent } from './validate-category-parent';

const BASE = {
  supabase: {} as never,
  merchantId: 'merchant-1',
  parentId: '11111111-1111-4111-8111-111111111111',
  categoryId: '22222222-2222-4222-8222-222222222222',
};

describe('validateCategoryParent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isParentCategoryOwnedByMerchant.mockResolvedValue('owned');
    mocks.categoryHasChildren.mockResolvedValue('no-children');
    mocks.wouldCreateCategoryCycle.mockResolvedValue('safe');
  });

  it('accepts an owned, active, non-looping parent', async () => {
    await expect(validateCategoryParent(BASE)).resolves.toBeNull();
  });

  it.each([
    ['absent', 400, 'PARENT_NOT_FOUND'],
    ['retired', 400, 'PARENT_RETIRED'],
    ['nested', 400, 'PARENT_DEPTH_EXCEEDED'],
  ])('refuses an %s parent with %i', async (state, status, code) => {
    mocks.isParentCategoryOwnedByMerchant.mockResolvedValue(state);

    const response = await validateCategoryParent(BASE);

    expect(response?.status).toBe(status);
    await expect(response?.json()).resolves.toMatchObject({ code });
  });

  it('returns 500 when the ownership lookup itself fails', async () => {
    // Not 400: that would tell the client to stop retrying a transient error.
    mocks.isParentCategoryOwnedByMerchant.mockResolvedValue('lookup-failed');

    expect((await validateCategoryParent(BASE))?.status).toBe(500);
  });

  it('refuses a parent that would close a loop', async () => {
    mocks.wouldCreateCategoryCycle.mockResolvedValue('cycle');

    const response = await validateCategoryParent(BASE);

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({
      code: 'PARENT_CYCLE',
    });
  });

  it('refuses to move a category with children below another root', async () => {
    mocks.categoryHasChildren.mockResolvedValue('has-children');

    const response = await validateCategoryParent(BASE);

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({
      code: 'CATEGORY_DEPTH_EXCEEDED',
    });
    expect(mocks.wouldCreateCategoryCycle).not.toHaveBeenCalled();
  });

  it('returns 500 when checking for children fails', async () => {
    mocks.categoryHasChildren.mockResolvedValue('lookup-failed');

    expect((await validateCategoryParent(BASE))?.status).toBe(500);
    expect(mocks.wouldCreateCategoryCycle).not.toHaveBeenCalled();
  });

  it('returns 500 when the ancestor walk fails', async () => {
    mocks.wouldCreateCategoryCycle.mockResolvedValue('lookup-failed');

    const response = await validateCategoryParent(BASE);

    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({
      error: 'Could not verify the category hierarchy',
    });
  });

  describe('create has no id yet, so it has no cycle to check', () => {
    it('skips the ancestor walk when categoryId is omitted', async () => {
      const { categoryId, ...create } = BASE;

      await expect(validateCategoryParent(create)).resolves.toBeNull();
      expect(mocks.categoryHasChildren).not.toHaveBeenCalled();
      expect(mocks.wouldCreateCategoryCycle).not.toHaveBeenCalled();
    });
  });

  it('checks ownership BEFORE walking the ancestor chain', async () => {
    mocks.isParentCategoryOwnedByMerchant.mockResolvedValue('absent');

    await validateCategoryParent(BASE);

    // A foreign parent must not have its chain walked at all.
    expect(mocks.wouldCreateCategoryCycle).not.toHaveBeenCalled();
  });
});

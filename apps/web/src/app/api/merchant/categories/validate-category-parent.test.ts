import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isParentCategoryOwnedByMerchant: vi.fn(),
  wouldCreateCategoryCycle: vi.fn(),
}));

vi.mock('./category-route-support', () => ({
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
    mocks.wouldCreateCategoryCycle.mockResolvedValue(false);
  });

  it('accepts an owned, active, non-looping parent', async () => {
    await expect(validateCategoryParent(BASE)).resolves.toBeNull();
  });

  it.each([
    ['absent', 400, 'PARENT_NOT_FOUND'],
    ['retired', 400, 'PARENT_RETIRED'],
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
    mocks.wouldCreateCategoryCycle.mockResolvedValue(true);

    const response = await validateCategoryParent(BASE);

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({
      code: 'PARENT_CYCLE',
    });
  });

  describe('create has no id yet, so it has no cycle to check', () => {
    it('skips the ancestor walk when categoryId is omitted', async () => {
      const { categoryId, ...create } = BASE;

      await expect(validateCategoryParent(create)).resolves.toBeNull();
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

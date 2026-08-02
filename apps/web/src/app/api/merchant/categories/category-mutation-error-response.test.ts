import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.error } }));

import { categoryMutationErrorResponse } from './category-mutation-error-response';

describe('categoryMutationErrorResponse', () => {
  it('maps database lifecycle guards without exposing internals', async () => {
    const response = categoryMutationErrorResponse(
      { code: '23514', message: 'CATEGORY_PARENT_CYCLE: internal detail' },
      'update'
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'That parent would create a category loop',
      code: 'PARENT_CYCLE',
    });
  });

  it('maps the concurrent depth guard to the same client error as preflight', async () => {
    const response = categoryMutationErrorResponse(
      { code: '23514', message: 'CATEGORY_DEPTH_EXCEEDED' },
      'update'
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'A category with subcategories cannot become a subcategory',
      code: 'CATEGORY_DEPTH_EXCEEDED',
    });
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('returns a generic 500 and logs the database detail', async () => {
    const response = categoryMutationErrorResponse(
      { code: 'XX000', message: 'constraint secret_detail' },
      'retire'
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Could not retire the category',
    });
    expect(mocks.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'constraint secret_detail' })
    );
  });
});

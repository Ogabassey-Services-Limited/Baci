import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  archiveError: null as { code?: string; message?: string } | null,
  archiveResult: {
    id: '123e4567-e89b-42d3-a456-426614174000',
    slug: 'phone-ultra',
    status: 'archived',
    name: 'Phone Ultra',
    category: 'Smartphones',
    categories: null as unknown,
    product_categories: null as unknown,
  } as {
    id: string;
    slug: string | null;
    status: string;
    name: string | null;
    category: string | null;
    categories: unknown;
    product_categories: unknown;
  } | null,
  authenticateApiRequest: vi.fn(),
  checkCsrfProtection: vi.fn(),
  filters: [] as [string, unknown][],
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
  // The pre-delete-style merchant-slug lookup the purge uses (this route auths
  // via getUserAccess, which only yields the merchant id).
  merchantError: null as { message?: string } | null,
  merchantSlugRow: { slug: 'test-store' } as { slug: string | null } | null,
  merchantThrows: false,
  revalidateProducts: vi.fn(),
  revalidateProductSlugs: vi.fn(),
  scheduleStorefrontProductPurge: vi.fn(),
  // Captures the products `.select(...)` argument so tests assert the archive
  // reads the category_id join + product_categories junction for the purge.
  selectArgs: [] as string[],
  supabase: null as unknown,
  updatePayload: null as unknown,
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticateApiRequest,
  getUserAccess: mocks.getUserAccess,
  hasPermission: mocks.hasPermission,
}));

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateProducts: mocks.revalidateProducts,
  revalidateProductSlugs: mocks.revalidateProductSlugs,
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));

vi.mock('@/lib/storefront-product-purge', () => ({
  scheduleStorefrontProductPurge: (...args: unknown[]) =>
    mocks.scheduleStorefrontProductPurge(...args),
}));

// Minimal category-segment resolver mirroring the real precedence (direct
// category_id join → legacy text → product_categories junction) so tests can
// assert the purge derives the same canonical segment the storefront serves.
vi.mock('@/lib/storefront-product-purge-urls', () => ({
  resolveProductPurgeCategorySegmentForRow: (row: {
    category?: string | null;
    categories?: { slug?: string } | null;
    product_categories?: Array<{ categories?: { slug?: string } }> | null;
  }) => {
    const direct = row.categories?.slug;
    if (direct) return direct;
    const text = row.category?.trim();
    if (text) return text.toLowerCase().replace(/\s+/g, '-');
    const junction = row.product_categories?.[0]?.categories?.slug;
    return junction ?? null;
  },
}));

function createSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        const merchantQuery = {
          select: vi.fn(() => merchantQuery),
          eq: vi.fn(() => merchantQuery),
          single: vi.fn(() => {
            if (mocks.merchantThrows) {
              return Promise.reject(new Error('merchant read failed'));
            }
            return Promise.resolve({
              data: mocks.merchantError ? null : mocks.merchantSlugRow,
              error: mocks.merchantError,
            });
          }),
        };
        return merchantQuery;
      }

      expect(table).toBe('products');

      const query = {
        eq: vi.fn((column: string, value: unknown) => {
          mocks.filters.push([column, value]);
          return query;
        }),
        select: vi.fn((arg?: string) => {
          if (typeof arg === 'string') {
            mocks.selectArgs.push(arg);
          }
          return {
            single: vi.fn(() =>
              Promise.resolve({
                data: mocks.archiveError ? null : mocks.archiveResult,
                error: mocks.archiveError,
              })
            ),
          };
        }),
      };

      return {
        update: vi.fn((payload: unknown) => {
          mocks.updatePayload = payload;
          return query;
        }),
      };
    }),
  };
}

import { PATCH } from './route';

function makeRequest() {
  return new NextRequest(
    'https://usebaci.com/api/products/123e4567-e89b-42d3-a456-426614174000/archive',
    { method: 'PATCH' }
  );
}

function makeContext(id = '123e4567-e89b-42d3-a456-426614174000') {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/products/[id]/archive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archiveError = null;
    mocks.archiveResult = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      slug: 'phone-ultra',
      status: 'archived',
      name: 'Phone Ultra',
      category: 'Smartphones',
      categories: null,
      product_categories: null,
    };
    mocks.filters.length = 0;
    mocks.merchantError = null;
    mocks.merchantSlugRow = { slug: 'test-store' };
    mocks.merchantThrows = false;
    mocks.selectArgs.length = 0;
    mocks.supabase = createSupabase();
    mocks.updatePayload = null;
    mocks.authenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: mocks.supabase,
      user: { id: 'user-1' },
    });
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.getUserAccess.mockResolvedValue({
      isOwner: false,
      isStaff: true,
      merchantId: 'merchant-1',
      permissions: { products: { edit: true } },
      role: 'manager',
    });
    mocks.hasPermission.mockReturnValue(true);
  });

  it('archives a merchant product when the user has edit permission', async () => {
    const response = await PATCH(makeRequest(), makeContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      product: { id: '123e4567-e89b-42d3-a456-426614174000' },
      success: true,
    });
    expect(mocks.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 'merchant-1' }),
      'products',
      'edit'
    );
    expect(mocks.updatePayload).toMatchObject({ status: 'archived' });
    expect(mocks.filters).toContainEqual([
      'id',
      '123e4567-e89b-42d3-a456-426614174000',
    ]);
    expect(mocks.filters).toContainEqual(['merchant_id', 'merchant-1']);
    expect(mocks.revalidateProducts).toHaveBeenCalledWith(
      'merchant-1',
      'phone-ultra'
    );
  });

  it('does not leak the category join/junction embeds in the response body', async () => {
    mocks.archiveResult = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      slug: 'phone-ultra',
      status: 'archived',
      name: 'Phone Ultra',
      category: 'Smartphones',
      categories: { slug: 'smartphones' },
      product_categories: [{ categories: { slug: 'gadgets' } }],
    };

    const response = await PATCH(makeRequest(), makeContext());

    await expect(response.json()).resolves.toEqual({
      product: {
        id: '123e4567-e89b-42d3-a456-426614174000',
        slug: 'phone-ultra',
        status: 'archived',
      },
      success: true,
    });
  });

  it('returns 401 when the user is not authenticated', async () => {
    mocks.authenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });

    const response = await PATCH(makeRequest(), makeContext());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(mocks.updatePayload).toBeNull();
    expect(mocks.revalidateProducts).not.toHaveBeenCalled();
    expect(mocks.scheduleStorefrontProductPurge).not.toHaveBeenCalled();
  });

  it('rejects requests that fail CSRF validation', async () => {
    mocks.checkCsrfProtection.mockResolvedValue({ valid: false });

    const response = await PATCH(makeRequest(), makeContext());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'CSRF validation failed',
    });
    expect(mocks.updatePayload).toBeNull();
    expect(mocks.revalidateProducts).not.toHaveBeenCalled();
    expect(mocks.scheduleStorefrontProductPurge).not.toHaveBeenCalled();
  });

  it('rejects users without product edit permission', async () => {
    mocks.hasPermission.mockReturnValue(false);

    const response = await PATCH(makeRequest(), makeContext());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Permission denied',
    });
    expect(mocks.updatePayload).toBeNull();
  });

  it('rejects invalid product ids before updating', async () => {
    const response = await PATCH(makeRequest(), makeContext('not-a-uuid'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid product id',
    });
    expect(mocks.updatePayload).toBeNull();
  });

  it('returns 500 when the archive update fails', async () => {
    mocks.archiveError = { code: '23505', message: 'update failed' };

    const response = await PATCH(makeRequest(), makeContext());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to archive product',
    });
    expect(mocks.updatePayload).toMatchObject({ status: 'archived' });
    expect(mocks.revalidateProducts).not.toHaveBeenCalled();
    expect(mocks.scheduleStorefrontProductPurge).not.toHaveBeenCalled();
  });

  it('returns 404 when the product does not belong to the merchant', async () => {
    mocks.archiveError = { code: 'PGRST116', message: 'no rows' };

    const response = await PATCH(makeRequest(), makeContext());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Product not found',
    });
    expect(mocks.updatePayload).toMatchObject({ status: 'archived' });
    expect(mocks.revalidateProducts).not.toHaveBeenCalled();
    expect(mocks.scheduleStorefrontProductPurge).not.toHaveBeenCalled();
  });

  describe('Cloudflare purge', () => {
    it('schedules a purge for the archived product with its category segment', async () => {
      const response = await PATCH(makeRequest(), makeContext());

      expect(response.status).toBe(200);
      expect(mocks.scheduleStorefrontProductPurge).toHaveBeenCalledWith(
        'test-store',
        [{ slug: 'phone-ultra', categorySegment: 'smartphones' }]
      );
    });

    it('reads the category_id join and product_categories junction on the archive select', async () => {
      await PATCH(makeRequest(), makeContext());

      expect(
        mocks.selectArgs.some((arg) =>
          arg.includes('categories:category_id(slug)')
        )
      ).toBe(true);
      expect(
        mocks.selectArgs.some((arg) =>
          arg.includes('product_categories(categories(slug))')
        )
      ).toBe(true);
    });

    it('prefers the direct category_id join over the legacy text', async () => {
      mocks.archiveResult = {
        id: '123e4567-e89b-42d3-a456-426614174000',
        slug: 'phone-ultra',
        status: 'archived',
        name: 'Phone Ultra',
        category: 'Legacy Display Name',
        categories: { slug: 'smartphones' },
        product_categories: null,
      };

      await PATCH(makeRequest(), makeContext());

      expect(mocks.scheduleStorefrontProductPurge).toHaveBeenCalledWith(
        'test-store',
        [{ slug: 'phone-ultra', categorySegment: 'smartphones' }]
      );
    });

    it('busts the per-slug Next cache before scheduling the edge purge', async () => {
      await PATCH(makeRequest(), makeContext());

      expect(mocks.revalidateProductSlugs).toHaveBeenCalledWith('merchant-1', [
        'phone-ultra',
      ]);
      expect(
        mocks.revalidateProductSlugs.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mocks.scheduleStorefrontProductPurge.mock.invocationCallOrder[0]
      );
    });

    it('falls back to the product id for the purge target when the slug is null', async () => {
      mocks.archiveResult = {
        id: '123e4567-e89b-42d3-a456-426614174000',
        slug: null,
        status: 'archived',
        name: 'Legacy',
        category: null,
        categories: null,
        product_categories: null,
      };

      await PATCH(makeRequest(), makeContext());

      expect(mocks.revalidateProductSlugs).toHaveBeenCalledWith('merchant-1', [
        '123e4567-e89b-42d3-a456-426614174000',
      ]);
      expect(mocks.scheduleStorefrontProductPurge).toHaveBeenCalledWith(
        'test-store',
        [
          {
            slug: '123e4567-e89b-42d3-a456-426614174000',
            categorySegment: null,
          },
        ]
      );
    });

    it('completes the archive even when scheduling the purge throws', async () => {
      mocks.scheduleStorefrontProductPurge.mockImplementationOnce(() => {
        throw new Error('purge scheduling failed');
      });

      const response = await PATCH(makeRequest(), makeContext());

      // The purge is best-effort; a scheduling failure must not fail the archive.
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ success: true });
    });

    it('archives (and still busts the Next cache) when the merchant-slug read fails', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      try {
        mocks.merchantThrows = true;

        const response = await PATCH(makeRequest(), makeContext());

        // Fail-open: a failed merchant-slug read cannot break the archive, and
        // the per-slug Next cache bust (which needs only the merchant id) still
        // ran before the failing lookup.
        expect(response.status).toBe(200);
        expect(mocks.revalidateProductSlugs).toHaveBeenCalledWith(
          'merchant-1',
          ['phone-ultra']
        );
        expect(mocks.scheduleStorefrontProductPurge).not.toHaveBeenCalled();
      } finally {
        consoleWarnSpy.mockRestore();
      }
    });

    it('skips the edge purge (no-op identifier) when the merchant slug is missing', async () => {
      mocks.merchantSlugRow = { slug: null };

      const response = await PATCH(makeRequest(), makeContext());

      expect(response.status).toBe(200);
      // The merchant has no slug, so the schedule receives a null identifier —
      // scheduleStorefrontProductPurge itself no-ops on that.
      expect(mocks.scheduleStorefrontProductPurge).toHaveBeenCalledWith(null, [
        { slug: 'phone-ultra', categorySegment: 'smartphones' },
      ]);
    });
  });
});

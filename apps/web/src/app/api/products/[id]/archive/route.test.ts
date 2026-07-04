import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  archiveError: null as { code?: string; message?: string } | null,
  archiveResult: {
    id: '123e4567-e89b-42d3-a456-426614174000',
    slug: 'phone-ultra',
    status: 'archived',
  } as { id: string; slug: string | null; status: string } | null,
  authenticateApiRequest: vi.fn(),
  checkCsrfProtection: vi.fn(),
  filters: [] as [string, unknown][],
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
  revalidateProducts: vi.fn(),
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
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));

function createSupabase() {
  return {
    from: vi.fn((table: string) => {
      expect(table).toBe('products');

      const query = {
        eq: vi.fn((column: string, value: unknown) => {
          mocks.filters.push([column, value]);
          return query;
        }),
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: mocks.archiveError ? null : mocks.archiveResult,
              error: mocks.archiveError,
            })
          ),
        })),
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
    };
    mocks.filters.length = 0;
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
      permissions: { products: { delete: true } },
      role: 'manager',
    });
    mocks.hasPermission.mockReturnValue(true);
  });

  it('archives a merchant product when the user has delete permission', async () => {
    const response = await PATCH(makeRequest(), makeContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      product: { id: '123e4567-e89b-42d3-a456-426614174000' },
      success: true,
    });
    expect(mocks.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 'merchant-1' }),
      'products',
      'delete'
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
  });

  it('rejects users without product delete permission', async () => {
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
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

const mockRevalidateProducts = vi.fn();
vi.mock('@/lib/cache-revalidation', () => ({
  revalidateProducts: (...args: unknown[]) => mockRevalidateProducts(...args),
}));

// Supabase mock
const MERCHANT_ID = 'merchant-123';
const USER_ID = 'user-123';

let authUser: { id: string } | null = { id: USER_ID };
let merchant: { id: string } | null = { id: MERCHANT_ID };
let deleteData: unknown[] = [{ id: 'draft-1' }];
let deleteError: unknown = null;
let updateData: unknown[] = [{ id: 'product-1' }];
let updateError: unknown = null;

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: authUser },
          error: authUser ? null : { message: 'Not authenticated' },
        })
      ),
    },
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn(() =>
                Promise.resolve({
                  data: merchant,
                  error: merchant ? null : { message: 'Not found' },
                })
              ),
            }),
          }),
        };
      }
      if (table === 'products') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn(() =>
                  Promise.resolve({ data: deleteData, error: deleteError })
                ),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                select: vi.fn(() =>
                  Promise.resolve({ data: updateData, error: updateError })
                ),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    }),
  })),
}));

// ---- Tests ----

describe('POST /api/products/bulk-publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser = { id: USER_ID };
    merchant = { id: MERCHANT_ID };
    deleteData = [{ id: 'draft-1' }];
    deleteError = null;
    updateData = [{ id: 'product-1' }, { id: 'product-2' }];
    updateError = null;
  });

  it('returns 401 when not authenticated', async () => {
    const { POST } = await import('./route');
    authUser = null;

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 404 when merchant not found', async () => {
    const { POST } = await import('./route');
    merchant = null;

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Merchant not found');
  });

  it('deletes drafts and publishes products', async () => {
    const { POST } = await import('./route');

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.deletedDrafts).toBe(1);
    expect(json.publishedProducts).toBe(2);
  });

  it('calls revalidateProducts after publish', async () => {
    const { POST } = await import('./route');

    await POST();

    expect(mockRevalidateProducts).toHaveBeenCalledWith(MERCHANT_ID);
  });

  it('returns 500 when update fails', async () => {
    const { POST } = await import('./route');
    updateError = { message: 'DB error' };

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to publish products');
  });

  it('handles delete error gracefully and continues', async () => {
    const { POST } = await import('./route');
    deleteError = { message: 'Delete failed' };

    const res = await POST();
    const json = await res.json();

    // Delete error is logged but does not fail the request
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('handles zero deleted drafts and zero published', async () => {
    const { POST } = await import('./route');
    deleteData = [];
    updateData = [];

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deletedDrafts).toBe(0);
    expect(json.publishedProducts).toBe(0);
  });
});

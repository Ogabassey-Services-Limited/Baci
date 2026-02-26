import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateProducts: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({
      valid: true,
      response: null,
    })
  ),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateProductSlug: (name: string) => name,
  generateSlug: (name: string) => name,
}));

vi.mock('@/lib/countries', () => ({
  getCountryByCode: (code: string) => ({
    code,
    name: 'Nigeria',
    currency: 'NGN',
  }),
}));

// Supabase mock setup
const MERCHANT_ID = 'merchant-123';
const USER_ID = 'user-123';

const mockEq = vi.fn().mockReturnThis();

// Creates a query builder that supports chaining .eq() and resolves with { error }
function createQueryBuilder(getError: () => unknown) {
  const builder = {
    eq: mockEq,
    // biome-ignore lint/suspicious/noThenProperty: Mocking a Thenable
    then: (resolve: (value: any) => void, reject: (reason?: any) => void) => {
      const error = getError();
      return Promise.resolve({ error }).then(resolve, reject);
    },
  };
  return builder;
}

const mockUpdate = vi.fn(() => createQueryBuilder(() => null));
const mockInsert = vi.fn().mockResolvedValue({ error: null });

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
          data: { user: { id: USER_ID } },
          error: null,
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
                  data: {
                    id: MERCHANT_ID,
                    business_name: 'Test Store',
                    country: 'NG',
                  },
                  error: null,
                })
              ),
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: MERCHANT_ID,
                    business_name: 'Test Store',
                    country: 'NG',
                  },
                  error: null,
                })
              ),
            }),
          }),
        };
      }
      if (table === 'products') {
        return {
          update: mockUpdate,
          insert: mockInsert,
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };
    }),
  })),
}));

// ---- Helpers ----

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/products/bulk-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---- Tests ----

describe('POST /api/products/bulk-update scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockClear();
    mockUpdate.mockClear();
  });

  it('SHOULD include merchant_id scope when updating a product by ID', async () => {
    const { POST } = await import('./route');

    const changes = [
      {
        type: 'update',
        productId: 'product-1',
        details: {
          name: 'Updated Product',
          price: 150,
          category: 'Electronics',
        },
      },
    ];

    await POST(makeRequest({ changes }));

    // Verify update was called
    expect(mockUpdate).toHaveBeenCalled();

    // Verify scoping
    // We expect .eq('id', 'product-1') AND .eq('merchant_id', MERCHANT_ID)
    expect(mockEq).toHaveBeenCalledWith('id', 'product-1');
    expect(mockEq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
  });

  it('SHOULD include merchant_id scope when removing a product by ID', async () => {
    const { POST } = await import('./route');

    const changes = [
      {
        type: 'remove',
        productId: 'product-to-remove',
        details: {},
      },
    ];

    await POST(makeRequest({ changes }));

    // Verify update was called (archive action)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'archived' })
    );

    // Verify scoping
    expect(mockEq).toHaveBeenCalledWith('id', 'product-to-remove');
    expect(mockEq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
  });
});

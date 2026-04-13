import { NextRequest } from 'next/server';
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

let csrfValid = true;
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({
      valid: csrfValid,
      response: csrfValid
        ? null
        : new Response(JSON.stringify({ error: 'CSRF validation failed' }), {
            status: 403,
          }),
    })
  ),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateProductSlug: (name: string) =>
    name.toLowerCase().replace(/\s+/g, '-'),
  generateSlug: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
}));

vi.mock('@/lib/countries', () => ({
  getCountryByCode: (code: string) => ({
    code,
    name: 'Nigeria',
    currency: 'NGN',
  }),
}));

type MerchantContextMock = {
  merchantId: string;
  businessName: string;
  staffAccess: {
    isOwner: boolean;
    isStaff: boolean;
    role: string | null;
    permissions: Record<string, Record<string, boolean>>;
  };
};

const merchantContextMock = {
  current: {
    merchantId: 'merchant-123',
    businessName: 'Test Store',
    staffAccess: {
      isOwner: true,
      isStaff: false,
      role: null,
      permissions: { full_access: { all: true } },
    },
  } as MerchantContextMock | null,
};
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(() =>
    Promise.resolve(merchantContextMock.current)
  ),
  toUserAccess: vi.fn((ctx: MerchantContextMock | null) => {
    if (!ctx) {
      throw new Error('Merchant context is required');
    }

    return {
      merchantId: ctx.merchantId,
      role: ctx.staffAccess.role ?? (ctx.staffAccess.isOwner ? 'owner' : null),
      isOwner: ctx.staffAccess.isOwner,
      isStaff: ctx.staffAccess.isStaff,
      permissions: ctx.staffAccess.permissions,
    };
  }),
}));

// Supabase mock
const MERCHANT_ID = 'merchant-123';
const USER_ID = 'user-123';

let authUser: { id: string } | null = { id: USER_ID };
let merchant: {
  id: string;
  business_name: string;
  country: string;
} | null = {
  id: MERCHANT_ID,
  business_name: 'Test Store',
  country: 'NG',
};
let updateError: unknown = null;
let insertError: unknown = null;

// Creates a query builder that supports chaining .eq() and resolves with { error }
function createQueryBuilder(getError: () => unknown) {
  const builder: Record<string, unknown> = {};
  builder.eq = vi.fn(() => builder);
  // biome-ignore lint/suspicious/noThenProperty: Needed for vitest promise mocking
  builder.then = vi.fn((resolve: (value: { error: unknown }) => void) =>
    resolve({ error: getError() })
  );
  return builder;
}

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
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: merchant,
                  error: null,
                })
              ),
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
          update: vi.fn(() => createQueryBuilder(() => updateError)),
          insert: vi.fn(() => Promise.resolve({ error: insertError })),
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

describe('POST /api/products/bulk-update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser = { id: USER_ID };
    merchant = { id: MERCHANT_ID, business_name: 'Test Store', country: 'NG' };
    merchantContextMock.current = {
      merchantId: MERCHANT_ID,
      businessName: 'Test Store',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        role: null,
        permissions: { full_access: { all: true } },
      },
    };
    updateError = null;
    insertError = null;
    csrfValid = true;
  });

  it('returns 401 when not authenticated', async () => {
    const { POST } = await import('./route');
    authUser = null;

    const res = await POST(makeRequest({ changes: [] }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 404 when merchant not found', async () => {
    const { POST } = await import('./route');
    merchantContextMock.current = null;

    const res = await POST(makeRequest({ changes: [] }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Merchant not found');
  });

  it('returns 403 when CSRF validation fails', async () => {
    const { POST } = await import('./route');
    csrfValid = false;

    const res = await POST(makeRequest({ changes: [] }));

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid changes data', async () => {
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ changes: 'not-an-array' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid changes data');
  });

  it('processes update changes and calls revalidateProducts', async () => {
    const { POST } = await import('./route');

    const changes = [
      {
        type: 'update',
        productId: 'product-1',
        newPrice: 150,
        details: {
          name: 'Updated Product',
          price: 150,
          category: 'Electronics',
        },
      },
    ];

    const res = await POST(makeRequest({ changes }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.results.updated).toBe(1);
    expect(mockRevalidateProducts).toHaveBeenCalledWith(MERCHANT_ID);
  });

  it('processes new product changes', async () => {
    const { POST } = await import('./route');

    const changes = [
      {
        type: 'new',
        details: { name: 'New Product', price: 200, stock: 10 },
      },
    ];

    const res = await POST(makeRequest({ changes }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results.created).toBe(1);
    expect(mockRevalidateProducts).toHaveBeenCalledWith(MERCHANT_ID);
  });

  it('processes remove changes', async () => {
    const { POST } = await import('./route');

    const changes = [
      {
        type: 'remove',
        productId: 'product-1',
        details: { name: 'Old Product', price: 100 },
      },
    ];

    const res = await POST(makeRequest({ changes }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results.removed).toBe(1);
  });

  it('handles update errors gracefully', async () => {
    const { POST } = await import('./route');
    updateError = { message: 'Constraint violation' };

    const changes = [
      {
        type: 'update',
        productId: 'p-1',
        details: { name: 'Bad Update', price: 100 },
      },
    ];

    const res = await POST(makeRequest({ changes }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results.errors).toHaveLength(1);
    expect(json.results.errors[0]).toContain('Bad Update');
  });

  it('calls revalidateProducts even with empty changes', async () => {
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ changes: [] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    // Still called since the function always revalidates after processing
    expect(mockRevalidateProducts).toHaveBeenCalledWith(MERCHANT_ID);
  });
});

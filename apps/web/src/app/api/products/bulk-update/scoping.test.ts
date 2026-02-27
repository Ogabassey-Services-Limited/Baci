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

// Track calls to .eq() to verify scoping
const eqCalls: Array<{ column: string; value: string }> = [];

// Creates a query builder that supports chaining .eq() and resolves with { error }
function createQueryBuilder(getError: () => unknown) {
  const builder = {
    eq: vi.fn((col, val) => {
      eqCalls.push({ column: col, value: val });
      return builder;
    }),
    // biome-ignore lint/suspicious/noThenProperty: Needed for await support in tests
    then: (resolve: any) => resolve({ error: getError() }),
  };
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

describe('POST /api/products/bulk-update SCOPING', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser = { id: USER_ID };
    merchant = { id: MERCHANT_ID, business_name: 'Test Store', country: 'NG' };
    updateError = null;
    insertError = null;
    csrfValid = true;
    eqCalls.length = 0;
  });

  it('SHOULD fail if update query is NOT scoped by merchant_id when productId is provided', async () => {
    const { POST } = await import('./route');

    const changes = [
      {
        type: 'update',
        productId: 'product-1', // Providing ID usually bypasses other filters
        newPrice: 150,
        details: {
          name: 'Updated Product',
          price: 150,
          category: 'Electronics',
        },
      },
    ];

    await POST(makeRequest({ changes }));

    // Check if we called .eq('merchant_id', ...)
    const merchantIdCall = eqCalls.find(
      (c) => c.column === 'merchant_id' && c.value === MERCHANT_ID
    );

    // This expectation is designed to FAIL currently, proving the bug
    expect(
      merchantIdCall,
      'Critical: Update query missing .eq("merchant_id") scope'
    ).toBeDefined();
  });

  it('SHOULD fail if remove query is NOT scoped by merchant_id when productId is provided', async () => {
    const { POST } = await import('./route');

    const changes = [
      {
        type: 'remove',
        productId: 'product-to-remove',
        details: { name: 'Old Product', price: 100 },
      },
    ];

    await POST(makeRequest({ changes }));

    // Check if we called .eq('merchant_id', ...)
    const merchantIdCall = eqCalls.find(
      (c) => c.column === 'merchant_id' && c.value === MERCHANT_ID
    );

    // This expectation is designed to FAIL currently, proving the bug
    expect(
      merchantIdCall,
      'Critical: Remove query missing .eq("merchant_id") scope'
    ).toBeDefined();
  });
});

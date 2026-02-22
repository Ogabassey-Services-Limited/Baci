import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
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

// Mock formatZodErrors to simplify expectations
vi.mock('@/schemas/inventory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/schemas/inventory')>();
  return {
    ...actual,
    formatZodErrors: (error: any) =>
      error.errors.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
  };
});

// Supabase mock
const MERCHANT_ID = 'merchant-123';
const USER_ID = 'user-123';
const SUGGESTION_ID = '00000000-0000-0000-0000-000000000001';

let authUser: any = { id: USER_ID };
let merchant: any = {
  id: MERCHANT_ID,
  business_name: 'Test Store',
  country: 'NG',
};
let suggestions: any[] = [];
let updateError: any = null;
let suggestionsError: any = null;

const createMockSupabase = () => ({
  auth: {
    getUser: vi.fn(() => {
      if (authUser === undefined) {
        return Promise.reject(new Error('Unexpected error'));
      }
      const data = { user: authUser };
      return Promise.resolve({
        data,
        error: data.user ? null : { message: 'Not authenticated' },
      });
    }),
  },
  from: vi.fn((table: string) => {
    if (table === 'merchants') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(() =>
          Promise.resolve({
            data: merchant,
            error: null,
          })
        ),
      };
    }
    if (table === 'staff_members') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };
    }
    if (table === 'reorder_suggestions') {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(() =>
          Promise.resolve({
            data: suggestionsError ? null : suggestions,
            error: suggestionsError,
          })
        ),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() =>
              Promise.resolve({
                error: updateError,
              })
            ),
          })),
        })),
      };
      return chain;
    }
    return {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
  }),
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createMockSupabase(),
}));

// ---- Import handlers AFTER mocks ----
import { GET, POST } from './route';

// ---- Helpers ----

function makeGetRequest(params?: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/inventory/reorder');
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url.toString(), {
    method: 'GET',
  });
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/inventory/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function resetMocks() {
  authUser = { id: USER_ID };
  merchant = {
    id: MERCHANT_ID,
    business_name: 'Test Store',
    country: 'NG',
  };
  suggestions = [];
  suggestionsError = null;
  updateError = null;
  csrfValid = true;
}

// ---- Tests ----

describe('GET /api/inventory/reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('returns suggestions successfully', async () => {
    suggestions = [
      {
        id: SUGGESTION_ID,
        merchant_id: MERCHANT_ID,
        product_id: 'p1',
        suggested_quantity: 10,
        status: 'pending',
        products: { id: 'p1', name: 'Product 1', cost_price: 100 },
      },
    ];

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.suggestions).toHaveLength(1);
    expect(json.stats.totalInvestment).toBe(1000); // 10 * 100
  });

  it('handles database error', async () => {
    suggestionsError = { message: 'DB Error' };
    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to fetch suggestions');
  });
});

describe('POST /api/inventory/reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('rejects if CSRF invalid', async () => {
    csrfValid = false;
    const res = await POST(
      makePostRequest({ suggestionId: SUGGESTION_ID, action: 'accept' })
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('CSRF validation failed');
  });

  it('rejects invalid schema (missing suggestionId)', async () => {
    const res = await POST(makePostRequest({ action: 'accept' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Validation failed');
  });

  it('rejects invalid action', async () => {
    const res = await POST(
      makePostRequest({ suggestionId: SUGGESTION_ID, action: 'invalid' })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Validation failed');
  });

  it('rejects malformed UUID', async () => {
    const res = await POST(
      makePostRequest({ suggestionId: 'not-a-uuid', action: 'accept' })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Validation failed');
  });

  it('accepts valid request', async () => {
    const res = await POST(
      makePostRequest({ suggestionId: SUGGESTION_ID, action: 'accept' })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(() =>
    Promise.resolve({ merchantId: 'merchant-123' })
  ),
  toUserAccess: vi.fn(() => ({})),
}));

vi.mock('@/schemas/customers', () => ({
  updateCustomerSchema: {
    safeParse: (data: Record<string, unknown>) => {
      if (data.full_name === 'Invalid Name') {
        return {
          success: false,
          error: {
            issues: [{ path: ['full_name'], message: 'Invalid name' }],
          },
        };
      }
      return { success: true, data };
    },
  },
  formatZodErrors: (error: {
    issues: { path: string[]; message: string }[];
  }) => ({ [error.issues[0].path[0]]: [error.issues[0].message] }),
}));

// Supabase mock
const USER_ID = 'user-123';
const CUSTOMER_ID = 'customer-456';

let authUser: unknown = { id: USER_ID };
let customer: unknown = null;
let customerError: unknown = null;
let updateResult: unknown = null;
let updateError: unknown = null;
let updatePayload: Record<string, unknown> | null = null;
let deleteResult: unknown[] | null = null;
let deleteError: unknown = null;
let csrfResult: { valid: boolean; response: Response | null } = {
  valid: true,
  response: null,
};

const createMockSupabase = () => ({
  auth: {
    getUser: vi.fn(() => {
      return Promise.resolve({
        data: { user: authUser },
        error: authUser ? null : { message: 'Not authenticated' },
      });
    }),
  },
  from: vi.fn((table: string) => {
    if (table === 'customers') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(() => {
          const hasError = customerError != null;
          return Promise.resolve({
            data: hasError ? null : customer,
            error: customerError,
          });
        }),
        single: vi.fn(() => {
          const hasError = customerError != null;
          return Promise.resolve({
            data: hasError ? null : customer,
            error: customerError,
          });
        }),
        update: vi.fn((payload: Record<string, unknown>) => {
          updatePayload = payload;
          return {
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(() => {
                    const hasError = updateError != null;
                    return Promise.resolve({
                      data: hasError ? null : updateResult,
                      error: updateError,
                    });
                  }),
                })),
              })),
            })),
          };
        }),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() =>
                Promise.resolve({
                  data: deleteResult,
                  error: deleteError,
                })
              ),
            })),
          })),
        })),
      };
    }
    return {};
  }),
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createMockSupabase(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() => Promise.resolve(csrfResult)),
}));

// ---- Import handlers AFTER mocks ----
import { DELETE, GET, PATCH } from './route';

// ---- Helpers ----

function makeGetRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/customers/${id}`, {
    method: 'GET',
  });
}

function makePatchRequest(id: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost:3000/api/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/customers/${id}`, {
    method: 'DELETE',
  });
}

function resetMocks() {
  authUser = { id: USER_ID };
  customer = {
    id: CUSTOMER_ID,
    full_name: 'Test Customer',
    email: 'test@example.com',
  };
  customerError = null;
  updateResult = null;
  updateError = null;
  updatePayload = null;
  deleteResult = [{ id: CUSTOMER_ID }];
  deleteError = null;
  csrfResult = { valid: true, response: null };
}

// ---- Tests ----

describe('GET /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('returns customer successfully', async () => {
    const res = await GET(makeGetRequest(CUSTOMER_ID), {
      params: Promise.resolve({ id: CUSTOMER_ID }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.customer).toBeDefined();
    expect(json.customer.id).toBe(CUSTOMER_ID);
  });

  it('returns 404 when the customer does not exist', async () => {
    customer = null;

    const res = await GET(makeGetRequest(CUSTOMER_ID), {
      params: Promise.resolve({ id: CUSTOMER_ID }),
    });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Customer not found');
  });

  it('returns 500 when the customer lookup fails', async () => {
    customerError = { message: 'database is unavailable' };

    const res = await GET(makeGetRequest(CUSTOMER_ID), {
      params: Promise.resolve({ id: CUSTOMER_ID }),
    });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});

describe('PATCH /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('validates input and updates customer', async () => {
    updateResult = {
      id: CUSTOMER_ID,
      full_name: 'Updated Name',
    };

    const res = await PATCH(
      makePatchRequest(CUSTOMER_ID, { full_name: 'Updated Name' }),
      {
        params: Promise.resolve({ id: CUSTOMER_ID }),
      }
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.customer.full_name).toBe('Updated Name');
  });

  it('updates company customer name fields together', async () => {
    customer = {
      id: CUSTOMER_ID,
      customer_type: 'company',
      company_name: 'Old Co',
      first_name: null,
      full_name: 'Old Co',
      last_name: null,
      email: 'ops@old.example',
    };
    updateResult = {
      id: CUSTOMER_ID,
      customer_type: 'company',
      company_name: 'New Co',
      full_name: 'New Co',
    };

    const res = await PATCH(
      makePatchRequest(CUSTOMER_ID, {
        company_name: 'New Co',
        customer_type: 'company',
      }),
      {
        params: Promise.resolve({ id: CUSTOMER_ID }),
      }
    );

    expect(res.status).toBe(200);
    expect(updatePayload).toMatchObject({
      company_name: 'New Co',
      customer_type: 'company',
      first_name: null,
      full_name: 'New Co',
      last_name: null,
    });
  });

  it('rejects blank company names for existing company customers', async () => {
    customer = {
      id: CUSTOMER_ID,
      customer_type: 'company',
      company_name: 'Old Co',
      first_name: null,
      full_name: 'Old Co',
      last_name: null,
      email: 'ops@old.example',
    };

    const res = await PATCH(
      makePatchRequest(CUSTOMER_ID, { company_name: '' }),
      {
        params: Promise.resolve({ id: CUSTOMER_ID }),
      }
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toEqual({
      error: 'Validation failed',
      details: { company_name: ['Company name is required'] },
    });
    expect(updatePayload).toBeNull();
  });

  it('rejects changing an existing individual customer to company without a company name', async () => {
    customer = {
      id: CUSTOMER_ID,
      customer_type: 'individual',
      company_name: null,
      first_name: 'Ada',
      full_name: 'Ada Lovelace',
      last_name: 'Lovelace',
      email: 'ada@example.com',
    };

    const res = await PATCH(
      makePatchRequest(CUSTOMER_ID, { customer_type: 'company' }),
      {
        params: Promise.resolve({ id: CUSTOMER_ID }),
      }
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toEqual({
      error: 'Validation failed',
      details: { company_name: ['Company name is required'] },
    });
    expect(updatePayload).toBeNull();
  });

  it('clears stale company name when changing a company customer to individual', async () => {
    customer = {
      id: CUSTOMER_ID,
      customer_type: 'company',
      company_name: 'Old Co',
      first_name: null,
      full_name: 'Old Co',
      last_name: null,
      email: 'ops@old.example',
    };
    updateResult = {
      id: CUSTOMER_ID,
      customer_type: 'individual',
      company_name: null,
      full_name: 'Old Co',
    };

    const res = await PATCH(
      makePatchRequest(CUSTOMER_ID, { customer_type: 'individual' }),
      {
        params: Promise.resolve({ id: CUSTOMER_ID }),
      }
    );

    expect(res.status).toBe(200);
    expect(updatePayload).toMatchObject({
      company_name: null,
      customer_type: 'individual',
      first_name: null,
      full_name: 'Old Co',
      last_name: null,
    });
  });

  it('preserves explicit null clears instead of falling back to existing customer fields', async () => {
    customer = {
      id: CUSTOMER_ID,
      customer_type: 'individual',
      company_name: null,
      first_name: 'Ada',
      full_name: 'Ada Lovelace',
      last_name: 'Lovelace',
      email: 'ada@example.com',
    };
    updateResult = {
      id: CUSTOMER_ID,
      customer_type: 'individual',
      company_name: null,
      first_name: null,
      full_name: null,
      last_name: null,
      email: null,
    };

    const res = await PATCH(
      makePatchRequest(CUSTOMER_ID, {
        email: null,
        first_name: null,
        full_name: null,
        last_name: null,
      }),
      {
        params: Promise.resolve({ id: CUSTOMER_ID }),
      }
    );

    expect(res.status).toBe(200);
    expect(updatePayload).toMatchObject({
      company_name: null,
      customer_type: 'individual',
      email: null,
      first_name: null,
      full_name: null,
      last_name: null,
    });
  });

  it('returns 400 on validation failure', async () => {
    const res = await PATCH(
      makePatchRequest(CUSTOMER_ID, { full_name: 'Invalid Name' }),
      {
        params: Promise.resolve({ id: CUSTOMER_ID }),
      }
    );
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('Validation failed');
  });
});

describe('DELETE /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('returns success when a customer row is deleted', async () => {
    const res = await DELETE(makeDeleteRequest(CUSTOMER_ID), {
      params: Promise.resolve({ id: CUSTOMER_ID }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 404 when no customer row is deleted', async () => {
    deleteResult = [];

    const res = await DELETE(makeDeleteRequest(CUSTOMER_ID), {
      params: Promise.resolve({ id: CUSTOMER_ID }),
    });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Customer not found');
  });

  it('returns 500 when the delete query fails', async () => {
    deleteError = { message: 'delete failed' };

    const res = await DELETE(makeDeleteRequest(CUSTOMER_ID), {
      params: Promise.resolve({ id: CUSTOMER_ID }),
    });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });

  it('returns 401 when the user is not authenticated', async () => {
    authUser = null;

    const res = await DELETE(makeDeleteRequest(CUSTOMER_ID), {
      params: Promise.resolve({ id: CUSTOMER_ID }),
    });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns the CSRF rejection when CSRF validation fails', async () => {
    csrfResult = {
      valid: false,
      response: new Response(
        JSON.stringify({ error: 'CSRF validation failed' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };

    const res = await DELETE(makeDeleteRequest(CUSTOMER_ID), {
      params: Promise.resolve({ id: CUSTOMER_ID }),
    });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('CSRF validation failed');
  });
});

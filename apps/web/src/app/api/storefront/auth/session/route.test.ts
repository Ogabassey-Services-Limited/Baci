import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

function makeRequest(merchantSlug = 'ogabassey') {
  return new Request(
    `https://example.com/api/storefront/auth/session?merchantSlug=${merchantSlug}`
  );
}

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue(result),
  };

  return chain;
}

const merchant = { id: 'merchant-1' };
const user = {
  id: 'user-1',
  email: 'customer@example.com',
  user_metadata: {
    first_name: 'Ada',
    last_name: 'Lovelace',
    phone: '+2348000000000',
    role: 'customer',
  },
};
const customer = {
  id: 'customer-1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'customer@example.com',
  phone: '+2348000000000',
  address: null,
  saved_addresses: [],
  store_credit: 0,
  total_orders: 0,
  total_spent: 0,
  created_at: '2026-05-20T00:00:00.000Z',
};

describe('GET /api/storefront/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: 'customer-1', error: null });
  });

  it('returns an anonymous session when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      authenticated: false,
      user: null,
      customer: null,
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 400 when merchantSlug is missing', async () => {
    const response = await GET(
      new Request('https://example.com/api/storefront/auth/session')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Merchant slug is required' });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('does not treat merchant accounts as storefront customers', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          ...user,
          user_metadata: { ...user.user_metadata, role: 'merchant' },
        },
      },
      error: null,
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      authenticated: false,
      user: null,
      customer: null,
      reason: 'merchant_account',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 404 when the merchant cannot be found', async () => {
    mockGetUser.mockResolvedValue({
      data: { user },
      error: null,
    });
    mockFrom.mockReturnValue(
      makeSelectChain({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      })
    );

    const response = await GET(makeRequest('nonexistent'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Store not found' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('uses the secure customer auth upsert when the user has no customer row yet', async () => {
    mockGetUser.mockResolvedValue({
      data: { user },
      error: null,
    });

    const merchantChain = makeSelectChain({ data: merchant, error: null });
    const missingCustomerChain = makeSelectChain({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    });
    const linkedCustomerChain = makeSelectChain({
      data: customer,
      error: null,
    });

    let customerLookupCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') return merchantChain;
      if (table === 'customers') {
        customerLookupCount += 1;
        return customerLookupCount === 1
          ? missingCustomerChain
          : linkedCustomerChain;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('upsert_customer_on_auth', {
      p_merchant_id: 'merchant-1',
      p_user_id: 'user-1',
      p_email: 'customer@example.com',
      p_full_name: 'Ada Lovelace',
      p_phone: '+2348000000000',
    });
    expect(body.customer).toEqual(customer);
  });

  it('does not upsert when the authenticated customer row already exists', async () => {
    mockGetUser.mockResolvedValue({
      data: { user },
      error: null,
    });

    const merchantChain = makeSelectChain({ data: merchant, error: null });
    const customerChain = makeSelectChain({ data: customer, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') return merchantChain;
      if (table === 'customers') return customerChain;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(body.customer).toEqual(customer);
  });

  it('returns 500 when session lookup throws unexpectedly', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockGetUser.mockResolvedValue({
      data: { user },
      error: null,
    });
    mockFrom.mockImplementation(() => {
      throw new Error('database unavailable');
    });

    try {
      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ error: 'Internal server error' });
    } finally {
      consoleError.mockRestore();
    }
  });
});

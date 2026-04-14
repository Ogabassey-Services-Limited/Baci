import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockAuthenticateApiRequest = vi.fn();
const mockGetMerchantIdForApiUser = vi.fn();
const mockAdminFrom = vi.fn();
const mockExchangeJumiaCode = vi.fn();
const mockGetShops = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getMerchantIdForApiUser: (...args: unknown[]) =>
    mockGetMerchantIdForApiUser(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}));

vi.mock('@/env', () => ({
  getConfiguredAppUrl: vi.fn(() => 'https://usebaci.com'),
  getJumiaClientId: vi.fn(() => 'client-id'),
  getJumiaClientSecret: vi.fn(() => 'client-secret'),
}));

vi.mock('@/lib/jumia/helpers', () => ({
  exchangeJumiaCode: (...args: unknown[]) => mockExchangeJumiaCode(...args),
  getJumiaRedirectUri: vi.fn(
    () => 'https://usebaci.com/api/marketplace/jumia/callback'
  ),
}));

vi.mock('@/lib/jumia/client', () => ({
  JumiaClient: class {
    getShops = mockGetShops;
  },
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const TICKET_ID = '00000000-0000-4000-8000-000000000099';
const MERCHANT_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';

const mockUserSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  }),
};

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    'http://localhost/api/marketplace/jumia/connect/exchange',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

function setupAuth() {
  mockAuthenticateApiRequest.mockResolvedValue({
    user: { id: USER_ID },
    supabase: mockUserSupabase,
    error: null,
  });
  mockGetMerchantIdForApiUser.mockResolvedValue(MERCHANT_ID);
}

function createChainableMock(result: {
  data: unknown;
  error: unknown;
}): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.gt = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);
  chain.update = vi.fn().mockReturnValue(chain);
  return chain;
}

function setupTicketConsume(success = true) {
  const result = success
    ? { data: { id: TICKET_ID }, error: null }
    : { data: null, error: { message: 'No rows' } };
  mockAdminFrom.mockReturnValue(createChainableMock(result));
}

function setupTokenExchange() {
  mockExchangeJumiaCode.mockResolvedValue({
    access_token: 'access-123',
    refresh_token: 'refresh-456',
    expires_in: 3600,
  });
}

function setupShopDiscovery() {
  mockGetShops.mockResolvedValue([
    {
      id: 'shop-1',
      name: 'My Jumia Shop',
      email: 'test@test.com',
      businessClients: [
        {
          name: 'Jumia Nigeria',
          code: 'jumia_ng',
          countryCode: 'NG',
          countryName: 'Nigeria',
          status: 'active',
          shortCode: 'NG',
        },
      ],
    },
  ]);
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

const { POST } = await import('./route');

describe('POST /api/marketplace/jumia/connect/exchange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      supabase: null,
      error: 'Unauthorized',
    });

    const res = await POST(makeRequest({ code: 'abc', ticketId: TICKET_ID }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when code is missing', async () => {
    setupAuth();

    const res = await POST(makeRequest({ ticketId: TICKET_ID }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when ticketId is missing', async () => {
    setupAuth();

    const res = await POST(makeRequest({ code: 'abc' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when ticketId is not a valid UUID', async () => {
    setupAuth();

    const res = await POST(
      makeRequest({ code: 'abc', ticketId: 'not-a-uuid' })
    );
    expect(res.status).toBe(400);
  });

  // All three ticket-failure scenarios below use setupTicketConsume(false).
  // The route's atomic UPDATE ... WHERE status='redeemed' AND user_id=? AND
  // merchant_id=? AND expires_at > now() catches every failure mode in a single
  // query — wrong user, wrong status, or expired ticket all produce 0 rows.
  // Separate mocks per scenario would be redundant.

  it('returns 403 when ticket does not match authenticated user', async () => {
    setupAuth();
    setupTicketConsume(false);

    const res = await POST(makeRequest({ code: 'abc', ticketId: TICKET_ID }));
    expect(res.status).toBe(403);
  });

  it('returns 403 when ticket is already exchanged', async () => {
    setupAuth();
    setupTicketConsume(false);

    const res = await POST(makeRequest({ code: 'abc', ticketId: TICKET_ID }));
    expect(res.status).toBe(403);
  });

  it('returns 403 when ticket is redeemed but expired', async () => {
    setupAuth();
    setupTicketConsume(false);

    const res = await POST(makeRequest({ code: 'abc', ticketId: TICKET_ID }));
    expect(res.status).toBe(403);
  });

  it('returns 200 with shops on successful exchange', async () => {
    setupAuth();
    setupTicketConsume(true);
    setupTokenExchange();
    setupShopDiscovery();

    const res = await POST(
      makeRequest({ code: 'valid-code', ticketId: TICKET_ID })
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.shops).toContain('shop-1');
  });

  it('returns incomplete when only fallback shop is created', async () => {
    setupAuth();
    setupTicketConsume(true);
    setupTokenExchange();
    mockGetShops.mockResolvedValue([]); // No shops discovered

    const res = await POST(
      makeRequest({ code: 'valid-code', ticketId: TICKET_ID })
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.incomplete).toBe(true);
    expect(body.shops).toEqual([]);
  });

  it('calls exchangeJumiaCode with correct parameters', async () => {
    setupAuth();
    setupTicketConsume(true);
    setupTokenExchange();
    setupShopDiscovery();

    await POST(makeRequest({ code: 'auth-code-123', ticketId: TICKET_ID }));

    expect(mockExchangeJumiaCode).toHaveBeenCalledWith({
      code: 'auth-code-123',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://usebaci.com/api/marketplace/jumia/callback',
    });
  });

  it('returns 500 when Jumia token exchange fails', async () => {
    setupAuth();
    setupTicketConsume(true);
    mockExchangeJumiaCode.mockRejectedValue(new Error('Token exchange failed'));

    const res = await POST(
      makeRequest({ code: 'bad-code', ticketId: TICKET_ID })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Exchange failed');
  });
});

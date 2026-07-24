import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const VALID_ORDER_ID = '123e4567-e89b-42d3-a456-426614174000';

const RECEIPT_ROW = {
  business_name: 'Ogabassey Stores',
  logo_url: 'https://cdn.example/logo.png',
  email: 'shop@ogabassey.com',
  phone: '+2348000000000',
  support_email: 'help@ogabassey.com',
  support_phone: '+2348000000001',
  rider_phone_number: null,
  business_address: '1 Market Rd, Lagos',
  cac_rc_number: 'RC123456',
  tax_identification_number: 'TIN-1',
  legal_entity_name: 'Ogabassey Ltd',
  brand_colors: { primary: '#000' },
  vat_registration_status: 'registered',
  vat_rate: 7.5,
  bank_code: '058',
  bank_account_number: '0123456789',
  bank_name: 'GTBank',
  bank_account_name: 'Ogabassey Ltd',
  social_media: { instagram: 'ogabassey' },
  pages: {},
};

function setupClient(options: {
  user?: { id: string } | null;
  rpcData?: unknown;
  rpcError?: { code?: string } | null;
}) {
  mocks.getUser.mockResolvedValue({ data: { user: options.user ?? null } });
  mocks.rpc.mockResolvedValue({
    data: options.rpcData ?? null,
    error: options.rpcError ?? null,
  });
  mocks.createClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
  });
}

function callGet(orderId: string, query: Record<string, string> = {}) {
  const url = new URL(
    `http://localhost/api/storefront/orders/${orderId}/receipt-bank-details`
  );
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return GET(new NextRequest(url), {
    params: Promise.resolve({ id: orderId }),
  });
}

describe('GET /api/storefront/orders/[id]/receipt-bank-details', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when the order id is not a uuid', async () => {
    setupClient({});

    const response = await callGet('not-a-uuid', { token: 'trk_abc' });

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('returns 401 when there is no token and no session', async () => {
    setupClient({ user: null });

    const response = await callGet(VALID_ORDER_ID);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/tracking token/i);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('returns 200 with the bounded projection via the guest capability token', async () => {
    setupClient({ rpcData: [RECEIPT_ROW] });

    const response = await callGet(VALID_ORDER_ID, { token: 'trk_secret' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toEqual(RECEIPT_ROW);
    // Guest path must NOT require a session.
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('get_order_receipt_bank_details', {
      p_order_id: VALID_ORDER_ID,
      p_tracking_token: 'trk_secret',
    });
  });

  it('returns 200 for a signed-in owner without a token (null token forwarded)', async () => {
    setupClient({ user: { id: 'user-1' }, rpcData: [RECEIPT_ROW] });

    const response = await callGet(VALID_ORDER_ID);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(RECEIPT_ROW);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('get_order_receipt_bank_details', {
      p_order_id: VALID_ORDER_ID,
      p_tracking_token: null,
    });
  });

  it('returns 404 when the capability/ownership check yields no row', async () => {
    // Wrong token, non-owner, or unknown order all return an empty set — the
    // RPC fails closed and the route must not confirm the order's existence.
    setupClient({ rpcData: [] });

    const response = await callGet(VALID_ORDER_ID, { token: 'wrong_token' });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Order not found');
  });

  it('returns 500 when the RPC errors', async () => {
    setupClient({ rpcError: { code: 'XX000' } });

    const response = await callGet(VALID_ORDER_ID, { token: 'trk_secret' });

    expect(response.status).toBe(500);
  });
});

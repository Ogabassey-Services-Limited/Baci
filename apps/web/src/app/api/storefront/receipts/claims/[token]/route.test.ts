import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashReceiptClaimToken } from '@/lib/import-notifications/receipt-claim-links';

const mockAuthenticateApiRequest = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockCreateClient = vi.fn();
const mockConsoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

import { GET, POST } from './route';

const baseClaim = {
  claimed_at: null,
  claimed_by_user_id: null,
  customer_email: 'basseybjohn@yahoo.co.uk',
  customer_id: 'customer-1',
  customer_name: 'Bassey John',
  expires_at: '2099-01-01T00:00:00.000Z',
  id: 'claim-1',
  merchant_id: 'merchant-1',
  merchant: {
    business_name: 'Ogabassey',
    slug: 'ogabassey',
  },
  orders: [
    {
      id: 'order-1',
      order_items: [{ name: 'iPhone 16 Pro Max', quantity: 1 }],
      order_number: '06485',
    },
    {
      id: 'order-2',
      order_items: [{ name: 'AirPods Pro', quantity: 2 }],
      order_number: '06484',
    },
  ],
};

function createSupabaseRpcMock(response: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue(response),
  };
}

function mockAuthenticatedSupabase(
  supabase: ReturnType<typeof createSupabaseRpcMock>,
  email = 'basseybjohn@yahoo.co.uk'
) {
  mockAuthenticateApiRequest.mockResolvedValue({
    error: null,
    supabase,
    user: { email, id: 'user-1' },
  });
}

function getRequest() {
  return new NextRequest(
    'http://localhost:3000/api/storefront/receipts/claims/claim-token'
  );
}

function postRequest(headers?: HeadersInit) {
  const requestHeaders = new Headers({ 'Content-Type': 'application/json' });
  if (headers) {
    new Headers(headers).forEach((value, key) => {
      requestHeaders.set(key, value);
    });
  }

  return new NextRequest(
    'http://localhost:3000/api/storefront/receipts/claims/claim-token',
    {
      body: JSON.stringify({}),
      headers: requestHeaders,
      method: 'POST',
    }
  );
}

const params = { params: Promise.resolve({ token: 'claim-token' }) };
const invalidParams = { params: Promise.resolve({ token: 'bad token' }) };

describe('/api/storefront/receipts/claims/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleError.mockClear();
    mockAuthenticatedSupabase(
      createSupabaseRpcMock({
        data: { redirectPath: '/receipts', status: 'ok' },
        error: null,
      }),
      'BasseyBJohn@Yahoo.co.uk'
    );
    mockCheckCsrfProtection.mockResolvedValue({ response: null, valid: true });
  });

  it('returns 400 for invalid claim tokens', async () => {
    const response = await GET(getRequest(), invalidParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid receipt claim link' });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('returns claim preview details for a valid token', async () => {
    const supabase = createSupabaseRpcMock({ data: baseClaim, error: null });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET(getRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith('preview_receipt_claim', {
      p_token_hash: hashReceiptClaimToken('claim-token'),
    });
    expect(body).toMatchObject({
      claim: {
        claimed: false,
        customerName: 'Bassey John',
        devices: ['iPhone 16 Pro Max', '2 x AirPods Pro'],
        merchantName: 'Ogabassey',
      },
    });
  });

  it('uses a generic merchant fallback when the claim merchant has no name', async () => {
    const supabase = createSupabaseRpcMock({
      data: {
        ...baseClaim,
        merchant: { business_name: null, slug: null },
      },
      error: null,
    });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET(getRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.claim.merchantName).toBe('Store');
  });

  it('returns 404 when the receipt claim is not found', async () => {
    const supabase = createSupabaseRpcMock({ data: null, error: null });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET(getRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Receipt claim link not found' });
  });

  it('returns 410 for expired claims', async () => {
    const supabase = createSupabaseRpcMock({
      data: {
        ...baseClaim,
        expires_at: '2020-01-01T00:00:00.000Z',
      },
      error: null,
    });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET(getRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toEqual({ error: 'Receipt claim link has expired' });
  });

  it('returns a generic 500 when loading the receipt claim fails', async () => {
    const supabase = createSupabaseRpcMock({
      data: null,
      error: { message: 'relation receipt_claims_secret does not exist' },
    });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET(getRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to load receipt claim' });
    expect(JSON.stringify(body)).not.toContain('receipt_claims_secret');
    expect(mockConsoleError).toHaveBeenCalled();
  });

  it('returns a generic 500 when preview RPC data is malformed', async () => {
    const supabase = createSupabaseRpcMock({
      data: { id: 'claim-1' },
      error: null,
    });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET(getRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to load receipt claim' });
    expect(mockConsoleError).toHaveBeenCalled();
  });

  it('requires authentication before redeeming a claim', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Not authenticated',
      supabase: null,
      user: null,
    });

    const response = await POST(postRequest(), params);

    expect(response.status).toBe(401);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects redeem when the signed-in email does not match the claim', async () => {
    const supabase = createSupabaseRpcMock({
      data: { status: 'email_mismatch' },
      error: null,
    });
    mockAuthenticatedSupabase(supabase, 'someoneelse@example.com');

    const response = await POST(postRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: 'Sign in with the email address that received this receipt link',
    });
    expect(supabase.rpc).toHaveBeenCalledWith('redeem_receipt_claim', {
      p_token_hash: hashReceiptClaimToken('claim-token'),
    });
  });

  it('returns 409 when the claim was redeemed by a different user', async () => {
    const supabase = createSupabaseRpcMock({
      data: { status: 'already_used' },
      error: null,
    });
    mockAuthenticatedSupabase(supabase);

    const response = await POST(postRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: 'Receipt claim link has already been used',
    });
  });

  it('redeems a verified customer claim through the database RPC', async () => {
    const supabase = createSupabaseRpcMock({
      data: { redirectPath: '/receipts', status: 'ok' },
      error: null,
    });
    mockAuthenticatedSupabase(supabase);

    const response = await POST(postRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      redirectPath: '/receipts',
      success: true,
    });
    expect(supabase.rpc).toHaveBeenCalledWith('redeem_receipt_claim', {
      p_token_hash: hashReceiptClaimToken('claim-token'),
    });
  });

  it('skips CSRF validation for bearer-authenticated mobile redemptions', async () => {
    const supabase = createSupabaseRpcMock({
      data: { redirectPath: '/receipts', status: 'ok' },
      error: null,
    });
    mockAuthenticatedSupabase(supabase);

    const response = await POST(
      postRequest({ Authorization: 'Bearer mobile-session-token' }),
      params
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      redirectPath: '/receipts',
      success: true,
    });
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith('redeem_receipt_claim', {
      p_token_hash: hashReceiptClaimToken('claim-token'),
    });
  });

  it('returns 500 when the customer record cannot be linked', async () => {
    const supabase = createSupabaseRpcMock({
      data: { status: 'customer_link_failed' },
      error: null,
    });
    mockAuthenticatedSupabase(supabase);

    const response = await POST(postRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to redeem receipt claim' });
    expect(mockConsoleError).toHaveBeenCalled();
  });

  it('returns 500 when redemption RPC data is malformed', async () => {
    const supabase = createSupabaseRpcMock({
      data: { status: 'unknown_status' },
      error: null,
    });
    mockAuthenticatedSupabase(supabase);

    const response = await POST(postRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to redeem receipt claim' });
    expect(mockConsoleError).toHaveBeenCalled();
  });

  it('returns CSRF validation responses before redeeming with cookie auth', async () => {
    mockCheckCsrfProtection.mockResolvedValue({
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
      valid: false,
    });

    const authSupabase = createSupabaseRpcMock({
      data: { redirectPath: '/receipts', status: 'ok' },
      error: null,
    });
    mockAuthenticatedSupabase(authSupabase);

    const response = await POST(postRequest(), params);

    expect(response.status).toBe(403);
    expect(authSupabase.rpc).not.toHaveBeenCalled();
  });
});

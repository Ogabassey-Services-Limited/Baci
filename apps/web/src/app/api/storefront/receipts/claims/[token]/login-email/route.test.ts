import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashReceiptClaimToken } from '@/lib/import-notifications/receipt-claim-links';

const mockCreateClient = vi.fn();
const mockConsoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

import { GET } from './route';

const baseClaim = {
  claimed_at: null,
  claimed_by_user_id: null,
  customer_email: '  BasseyBJohn@Yahoo.CO.UK  ',
  customer_id: 'customer-1',
  customer_name: 'Bassey John',
  expires_at: '2099-01-01T00:00:00.000Z',
  id: 'claim-1',
  merchant_id: 'merchant-1',
  merchant: {
    business_name: 'Ogabassey',
    slug: 'ogabassey',
  },
  orders: [],
};

function createSupabaseRpcMock(response: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue(response),
  };
}

function getRequest() {
  return new NextRequest(
    'http://localhost:3000/api/storefront/receipts/claims/claim-token/login-email'
  );
}

const params = { params: Promise.resolve({ token: 'claim-token' }) };
const invalidParams = { params: Promise.resolve({ token: 'bad token' }) };

describe('GET /api/storefront/receipts/claims/[token]/login-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleError.mockClear();
  });

  it('returns 400 for invalid claim tokens', async () => {
    const response = await GET(getRequest(), invalidParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid receipt claim link' });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('returns a sanitized email hint for a valid claim token', async () => {
    const supabase = createSupabaseRpcMock({ data: baseClaim, error: null });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET(getRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith('preview_receipt_claim', {
      p_token_hash: hashReceiptClaimToken('claim-token'),
    });
    expect(body).toEqual({ emailHint: 'basseybjohn@yahoo.co.uk' });
  });

  it('returns an empty email hint when claim data has an invalid email', async () => {
    const supabase = createSupabaseRpcMock({
      data: { ...baseClaim, customer_email: 'not-an-email' },
      error: null,
    });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET(getRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ emailHint: '' });
  });

  it('returns 404 when no claim matches the token', async () => {
    const supabase = createSupabaseRpcMock({ data: null, error: null });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET(getRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Receipt claim link not found' });
  });

  it('returns a generic 500 when loading the email hint fails', async () => {
    const supabase = createSupabaseRpcMock({
      data: null,
      error: { message: 'relation receipt_claims_secret does not exist' },
    });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET(getRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Failed to load receipt claim login email',
    });
    expect(JSON.stringify(body)).not.toContain('receipt_claims_secret');
    expect(mockConsoleError).toHaveBeenCalled();
  });
});

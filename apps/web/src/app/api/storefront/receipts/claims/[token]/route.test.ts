import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashReceiptClaimToken } from '@/lib/import-notifications/receipt-claim-links';

const mockAuthenticateApiRequest = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockCreateAdminClient = vi.fn();
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

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockCreateAdminClient(),
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
  merchants: {
    business_name: 'Ogabassey',
    custom_domain: 'ogabassey.com',
    slug: 'ogabassey',
  },
  receipt_claim_orders: [
    {
      orders: {
        id: 'order-1',
        order_items: [{ name: 'iPhone 16 Pro Max', quantity: 1 }],
        order_number: '06485',
      },
    },
    {
      orders: {
        id: 'order-2',
        order_items: [{ name: 'AirPods Pro', quantity: 2 }],
        order_number: '06484',
      },
    },
  ],
};

function createReceiptClaimSelectQuery(claim: unknown, error: unknown = null) {
  const query = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: claim, error });
  return query;
}

function createCustomerUpdateQuery(result: unknown = { id: 'customer-1' }) {
  const query = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    or: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: result, error: null });
  return query;
}

function createClaimUpdateQuery(error: unknown = null) {
  const query = {
    eq: vi.fn(),
    update: vi.fn(),
  };
  query.update.mockReturnValue(query);
  query.eq.mockResolvedValue({ error });
  return query;
}

function createAdminMock({
  claim = baseClaim,
  claimError = null,
  customerUpdateResult = { id: 'customer-1' },
  claimUpdateError = null,
}: {
  claim?: unknown;
  claimError?: unknown;
  customerUpdateResult?: unknown;
  claimUpdateError?: unknown;
} = {}) {
  const claimQuery = createReceiptClaimSelectQuery(claim, claimError);
  const customerQuery = createCustomerUpdateQuery(customerUpdateResult);
  const claimUpdateQuery = createClaimUpdateQuery(claimUpdateError);

  const from = vi.fn((table: string) => {
    if (table === 'receipt_claims') {
      return from.mock.calls.filter(([name]) => name === 'receipt_claims')
        .length === 1
        ? claimQuery
        : claimUpdateQuery;
    }
    if (table === 'customers') {
      return customerQuery;
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    admin: { from },
    claimQuery,
    claimUpdateQuery,
    customerQuery,
  };
}

function getRequest() {
  return new NextRequest(
    'http://localhost:3000/api/storefront/receipts/claims/claim-token'
  );
}

function postRequest() {
  return new NextRequest(
    'http://localhost:3000/api/storefront/receipts/claims/claim-token',
    {
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
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
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { authScope: 'customer' },
      user: { email: 'BasseyBJohn@Yahoo.co.uk', id: 'user-1' },
    });
    mockCheckCsrfProtection.mockResolvedValue({ response: null, valid: true });
  });

  it('returns 400 for invalid claim tokens', async () => {
    const response = await GET(getRequest(), invalidParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid receipt claim link' });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns claim preview details for a valid token', async () => {
    const { admin, claimQuery } = createAdminMock();
    mockCreateAdminClient.mockReturnValue(admin);

    const response = await GET(getRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(claimQuery.eq).toHaveBeenCalledWith(
      'token_hash',
      hashReceiptClaimToken('claim-token')
    );
    expect(body).toMatchObject({
      claim: {
        claimed: false,
        customerName: 'Bassey John',
        devices: ['iPhone 16 Pro Max', '2 x AirPods Pro'],
        merchantName: 'Ogabassey',
      },
    });
  });

  it('returns 404 when the receipt claim is not found', async () => {
    const { admin } = createAdminMock({ claim: null });
    mockCreateAdminClient.mockReturnValue(admin);

    const response = await GET(getRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Receipt claim link not found' });
  });

  it('returns 410 for expired claims', async () => {
    const { admin } = createAdminMock({
      claim: {
        ...baseClaim,
        expires_at: '2020-01-01T00:00:00.000Z',
      },
    });
    mockCreateAdminClient.mockReturnValue(admin);

    const response = await GET(getRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toEqual({ error: 'Receipt claim link has expired' });
  });

  it('returns a generic 500 when loading the receipt claim fails', async () => {
    const { admin } = createAdminMock({
      claimError: { message: 'relation receipt_claims_secret does not exist' },
    });
    mockCreateAdminClient.mockReturnValue(admin);

    const response = await GET(getRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to load receipt claim' });
    expect(JSON.stringify(body)).not.toContain('receipt_claims_secret');
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
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('rejects redeem when the signed-in email does not match the claim', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { authScope: 'customer' },
      user: { email: 'someoneelse@example.com', id: 'user-1' },
    });
    const { admin } = createAdminMock();
    mockCreateAdminClient.mockReturnValue(admin);

    const response = await POST(postRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: 'Sign in with the email address that received this receipt link',
    });
  });

  it('returns 409 when the claim was redeemed by a different user', async () => {
    const { admin } = createAdminMock({
      claim: {
        ...baseClaim,
        claimed_by_user_id: 'other-user',
      },
    });
    mockCreateAdminClient.mockReturnValue(admin);

    const response = await POST(postRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: 'Receipt claim link has already been used',
    });
  });

  it('links the verified customer and marks the claim as redeemed', async () => {
    const { admin, claimUpdateQuery, customerQuery } = createAdminMock();
    mockCreateAdminClient.mockReturnValue(admin);

    const response = await POST(postRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      redirectPath: '/receipts',
      success: true,
    });
    expect(customerQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1' })
    );
    expect(customerQuery.or).toHaveBeenCalledWith(
      'user_id.is.null,user_id.eq.user-1'
    );
    expect(claimUpdateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ claimed_by_user_id: 'user-1' })
    );
    expect(claimUpdateQuery.eq).toHaveBeenCalledWith('id', 'claim-1');
  });

  it('returns 500 when the customer record cannot be linked', async () => {
    const { admin, claimUpdateQuery } = createAdminMock({
      customerUpdateResult: null,
    });
    mockCreateAdminClient.mockReturnValue(admin);

    const response = await POST(postRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to redeem receipt claim' });
    expect(claimUpdateQuery.update).not.toHaveBeenCalled();
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

    const response = await POST(postRequest(), params);

    expect(response.status).toBe(403);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });
});

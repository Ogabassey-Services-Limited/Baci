import { createHash, createHmac } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockAuthenticateApiRequest: vi.fn(),
  mockCheckCsrfProtection: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockCreateAdminClient: vi.fn(),
  mockReadCustomerWalletBalance: vi.fn(),
  mockRedeemImeiWalletPayment: vi.fn(),
  mockRefundImeiWalletPayment: vi.fn(),
  mockRequestSickwCheck: vi.fn(),
  mockResolveImeiCustomer: vi.fn(),
  mockResolveStorefrontMerchantFromRequest: vi.fn(),
}));

vi.mock('@/env', () => ({
  getImeiHashSalt: () => process.env.IMEI_HASH_SALT,
  getRootDomain: () => 'usebaci.com',
  getSickwApiKey: () => process.env.SICKW_API_KEY,
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mocks.mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) =>
    mocks.mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/rate-limit', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/rate-limit')>(
      '@/lib/rate-limit'
    );
  return {
    ...actual,
    checkRateLimit: (...args: unknown[]) => mocks.mockCheckRateLimit(...args),
  };
});

vi.mock('@/lib/storefront-merchant', () => ({
  resolveStorefrontMerchantFromRequest: (...args: unknown[]) =>
    mocks.mockResolveStorefrontMerchantFromRequest(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mocks.mockCreateAdminClient(),
}));

vi.mock('@/lib/imei-lookup-fulfillment', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/imei-lookup-fulfillment')
  >('@/lib/imei-lookup-fulfillment');
  return {
    ...actual,
    readCustomerWalletBalance: (...args: unknown[]) =>
      mocks.mockReadCustomerWalletBalance(...args),
    redeemImeiWalletPayment: (...args: unknown[]) =>
      mocks.mockRedeemImeiWalletPayment(...args),
    refundImeiWalletPayment: (...args: unknown[]) =>
      mocks.mockRefundImeiWalletPayment(...args),
    requestSickwCheck: (...args: unknown[]) =>
      mocks.mockRequestSickwCheck(...args),
    resolveImeiCustomer: (...args: unknown[]) =>
      mocks.mockResolveImeiCustomer(...args),
  };
});

interface ImeiLookupRow {
  amount_ngn: number;
  cached_response: Record<string, unknown> | null;
  cached_status: number | null;
  customer_id: string;
  id: string;
  idempotency_key: string;
  imei_hash: string;
  merchant_id: string;
  status: string;
  tier: string;
}

const VALID_IMEI = '354442067957452';
const IDEMPOTENCY_KEY = '11111111-1111-4111-8111-111111111111';

function hashImeiForTest(imei: string) {
  const salt = process.env.IMEI_HASH_SALT;
  if (!salt) {
    throw new Error('IMEI_HASH_SALT must be stubbed for hash assertions');
  }
  return createHmac('sha256', salt).update(imei).digest('hex');
}

function createRequest(
  body: Record<string, unknown> = { imei: VALID_IMEI, tier: 'full' },
  headers: Record<string, string> = {}
) {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({
      authorization: 'Bearer token',
      host: 'ogabassey.usebaci.com',
      'idempotency-key': IDEMPOTENCY_KEY,
      ...headers,
    }),
    method: 'POST',
    nextUrl: new URL('https://ogabassey.usebaci.com/api/storefront/imei-check'),
    url: 'https://ogabassey.usebaci.com/api/storefront/imei-check',
  } as unknown as NextRequest;
}

function createSupabaseMock(rows: ImeiLookupRow[] = []) {
  const updates: Array<{
    filters: Record<string, unknown>;
    payload: Record<string, unknown>;
  }> = [];
  let insertedPayload: Record<string, unknown> | null = null;
  let insertError: { code?: string; message: string } | null = null;
  let updateError: { code?: string; message: string } | null = null;

  const supabase = {
    __rows: rows,
    __updates: updates,
    __setInsertError: (error: { code?: string; message: string } | null) => {
      insertError = error;
    },
    __setUpdateError: (error: { code?: string; message: string } | null) => {
      updateError = error;
    },
    from: vi.fn((table: string) => {
      if (table !== 'imei_lookups') {
        throw new Error(`Unexpected table: ${table}`);
      }
      const filters: Record<string, unknown> = {};
      let activeUpdate: {
        filters: Record<string, unknown>;
        payload: Record<string, unknown>;
      } | null = null;
      const builder = {
        eq: vi.fn((column: string, value: unknown) => {
          filters[column] = value;
          if (activeUpdate) {
            activeUpdate.filters[column] = value;
            if (updateError) {
              return { error: updateError };
            }
          }
          return builder;
        }),
        insert: vi.fn((payload: Record<string, unknown>) => {
          insertedPayload = payload;
          return builder;
        }),
        maybeSingle: vi.fn(() => {
          const row =
            rows.find((candidate) =>
              Object.entries(filters).every(
                ([column, value]) =>
                  candidate[column as keyof ImeiLookupRow] === value
              )
            ) ?? null;
          return { data: row, error: null };
        }),
        select: vi.fn(() => builder),
        single: vi.fn(() => {
          if (insertError) {
            return { data: null, error: insertError };
          }
          const id = 'lookup-1';
          rows.push({
            amount_ngn: Number(insertedPayload?.amount_ngn ?? 0),
            cached_response: null,
            cached_status: null,
            customer_id: String(insertedPayload?.customer_id),
            id,
            idempotency_key: String(insertedPayload?.idempotency_key),
            imei_hash: String(insertedPayload?.imei_hash),
            merchant_id: String(insertedPayload?.merchant_id),
            status: String(insertedPayload?.status),
            tier: String(insertedPayload?.tier),
          });
          return { data: { id }, error: null };
        }),
        update: vi.fn((payload: Record<string, unknown>) => {
          activeUpdate = { filters: { ...filters }, payload };
          updates.push(activeUpdate);
          return builder;
        }),
      };
      return builder;
    }),
  };

  return supabase;
}

function mockAuthenticatedUser({
  adminSupabase = createSupabaseMock(),
  userSupabase = createSupabaseMock(),
}: {
  adminSupabase?: ReturnType<typeof createSupabaseMock>;
  userSupabase?: ReturnType<typeof createSupabaseMock>;
} = {}) {
  mocks.mockAuthenticateApiRequest.mockResolvedValue({
    error: null,
    supabase: userSupabase,
    user: { email: 'buyer@example.com', id: 'user-1' },
  });
  mocks.mockCreateAdminClient.mockReset();
  mocks.mockCreateAdminClient.mockReturnValue(adminSupabase);
  return { adminSupabase, userSupabase };
}

function importRoute() {
  vi.resetModules();
  return import('./route');
}

describe('POST /api/storefront/imei-check', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('IMEI_HASH_SALT', 'test-imei-salt');
    vi.stubEnv('SICKW_API_KEY', 'test-sickw-key');

    mocks.mockAuthenticateApiRequest.mockReset();
    mockAuthenticatedUser();
    mocks.mockCheckCsrfProtection.mockReset();
    mocks.mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mocks.mockCheckRateLimit.mockReset();
    mocks.mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetTime: Date.now() + 60_000,
    });
    mocks.mockResolveStorefrontMerchantFromRequest.mockReset();
    mocks.mockResolveStorefrontMerchantFromRequest.mockResolvedValue({
      identifier: 'ogabassey',
      merchant: { id: 'merchant-1', slug: 'ogabassey' },
      success: true,
    });
    mocks.mockResolveImeiCustomer.mockReset();
    mocks.mockResolveImeiCustomer.mockResolvedValue({
      email: 'buyer@example.com',
      first_name: 'Buyer',
      id: 'customer-1',
      last_name: null,
      phone: null,
      user_id: 'user-1',
    });
    mocks.mockReadCustomerWalletBalance.mockReset();
    mocks.mockReadCustomerWalletBalance.mockResolvedValue(5000);
    mocks.mockRedeemImeiWalletPayment.mockReset();
    mocks.mockRedeemImeiWalletPayment.mockResolvedValue(undefined);
    mocks.mockRefundImeiWalletPayment.mockReset();
    mocks.mockRefundImeiWalletPayment.mockResolvedValue(undefined);
    mocks.mockRequestSickwCheck.mockReset();
    mocks.mockRequestSickwCheck.mockResolvedValue({
      body: {
        data: { device: 'iPhone 15', imei: VALID_IMEI },
        success: true,
        tier: { checksIncluded: ['device'], name: 'Full Check' },
      },
      ok: true,
      rawResponseText: '{"result":"Model Name: iPhone 15"}',
      sickwStatus: 'success',
      status: 200,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 with AUTH_REQUIRED when no session is present', async () => {
    mocks.mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: 'Not authenticated',
      supabase: null,
      user: null,
    });
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('AUTH_REQUIRED');
    expect(mocks.mockRequestSickwCheck).not.toHaveBeenCalled();
  });

  it('returns 429 before auth or storefront resolution when rate limited', async () => {
    mocks.mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      limit: 10,
      remaining: 0,
      resetTime: Date.now() + 60_000,
    });
    const { POST } = await importRoute();

    const response = await POST(createRequest());

    expect(response.status).toBe(429);
    expect(mocks.mockAuthenticateApiRequest).not.toHaveBeenCalled();
    expect(
      mocks.mockResolveStorefrontMerchantFromRequest
    ).not.toHaveBeenCalled();
  });

  it('returns 403 when CSRF token validation fails', async () => {
    mocks.mockCheckCsrfProtection.mockResolvedValueOnce({
      response: Response.json({ error: 'Invalid CSRF token' }, { status: 403 }),
      valid: false,
    });
    const { POST } = await importRoute();

    const response = await POST(createRequest());

    expect(response.status).toBe(403);
    expect(
      mocks.mockResolveStorefrontMerchantFromRequest
    ).not.toHaveBeenCalled();
  });

  it('returns 400 when Idempotency-Key is missing or malformed', async () => {
    const { POST } = await importRoute();

    const missingResponse = await POST(
      createRequest(undefined, { 'idempotency-key': '' })
    );
    const malformedResponse = await POST(
      createRequest(undefined, { 'idempotency-key': 'not-a-uuid' })
    );
    const body = (await missingResponse.json()) as { code: string };

    expect(missingResponse.status).toBe(400);
    expect(malformedResponse.status).toBe(400);
    expect(body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(mocks.mockResolveImeiCustomer).not.toHaveBeenCalled();
  });

  it('rejects hidden service tiers before customer resolution or persistence', async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ imei: VALID_IMEI, tier: 'blacklistPro' })
    );
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe('IMEI_TIER_NOT_AVAILABLE');
    expect(mocks.mockResolveImeiCustomer).not.toHaveBeenCalled();
    expect(mocks.mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mocks.mockRequestSickwCheck).not.toHaveBeenCalled();
  });

  it('returns 404 when the authenticated user has no customer for the storefront', async () => {
    mocks.mockResolveImeiCustomer.mockResolvedValueOnce(null);
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe('CUSTOMER_NOT_FOUND');
    expect(mocks.mockRedeemImeiWalletPayment).not.toHaveBeenCalled();
    expect(mocks.mockRequestSickwCheck).not.toHaveBeenCalled();
  });

  it('returns 503 before new persistence when IMEI_HASH_SALT is missing', async () => {
    vi.stubEnv('IMEI_HASH_SALT', '');
    const supabase = createSupabaseMock();
    mockAuthenticatedUser({ userSupabase: supabase });
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(503);
    expect(body.code).toBe('IMEI_HASH_SALT_MISSING');
    expect(supabase.from).toHaveBeenCalledOnce();
    expect(mocks.mockRedeemImeiWalletPayment).not.toHaveBeenCalled();
    expect(mocks.mockRequestSickwCheck).not.toHaveBeenCalled();
  });

  it('replays a cached terminal response even when IMEI_HASH_SALT is missing', async () => {
    vi.stubEnv('IMEI_HASH_SALT', '');
    const cachedBody = {
      data: { device: 'iPhone 15', imei: VALID_IMEI },
      success: true,
      tier: { checksIncluded: ['device'], name: 'Full Check' },
    };
    mockAuthenticatedUser({
      userSupabase: createSupabaseMock([
        {
          amount_ngn: 1500,
          cached_response: cachedBody,
          cached_status: 200,
          customer_id: 'customer-1',
          id: 'lookup-1',
          idempotency_key: IDEMPOTENCY_KEY,
          imei_hash: 'persisted-hash',
          merchant_id: 'merchant-1',
          status: 'completed',
          tier: 'full',
        },
      ]),
    });
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(cachedBody);
    expect(mocks.mockRedeemImeiWalletPayment).not.toHaveBeenCalled();
    expect(mocks.mockRequestSickwCheck).not.toHaveBeenCalled();
  });

  it('replays a cached terminal response even when SICKW_API_KEY is missing', async () => {
    vi.stubEnv('SICKW_API_KEY', '');
    const cachedBody = {
      code: 'WALLET_INSUFFICIENT',
      error: 'Insufficient wallet balance',
      required: 1500,
      success: false,
    };
    mockAuthenticatedUser({
      userSupabase: createSupabaseMock([
        {
          amount_ngn: 1500,
          cached_response: cachedBody,
          cached_status: 402,
          customer_id: 'customer-1',
          id: 'lookup-1',
          idempotency_key: IDEMPOTENCY_KEY,
          imei_hash: hashImeiForTest(VALID_IMEI),
          merchant_id: 'merchant-1',
          status: 'wallet_rejected',
          tier: 'full',
        },
      ]),
    });
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body).toEqual(cachedBody);
    expect(mocks.mockRedeemImeiWalletPayment).not.toHaveBeenCalled();
    expect(mocks.mockRequestSickwCheck).not.toHaveBeenCalled();
  });

  it('returns 503 before new persistence when SICKW_API_KEY is missing', async () => {
    vi.stubEnv('SICKW_API_KEY', '');
    const supabase = createSupabaseMock();
    mockAuthenticatedUser({ userSupabase: supabase });
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(503);
    expect(body.code).toBe('SICKW_API_KEY_MISSING');
    expect(supabase.from).toHaveBeenCalledOnce();
    expect(mocks.mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mocks.mockRedeemImeiWalletPayment).not.toHaveBeenCalled();
  });

  it('returns 402 and caches the terminal response when wallet balance is short', async () => {
    const insufficient = Object.assign(
      new Error('insufficient_wallet_balance'),
      {
        code: 'P0001',
      }
    );
    mocks.mockReadCustomerWalletBalance
      .mockResolvedValueOnce(800)
      .mockResolvedValueOnce(500);
    mocks.mockRedeemImeiWalletPayment.mockRejectedValueOnce(insufficient);
    const adminSupabase = createSupabaseMock();
    const userSupabase = createSupabaseMock();
    mockAuthenticatedUser({ adminSupabase, userSupabase });
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = (await response.json()) as {
      balance: number;
      code: string;
      required: number;
    };

    expect(response.status).toBe(402);
    expect(body).toMatchObject({
      balance: 500,
      code: 'WALLET_INSUFFICIENT',
      required: 1500,
    });
    expect(mocks.mockRequestSickwCheck).not.toHaveBeenCalled();
    expect(adminSupabase.__updates.at(-1)).toMatchObject({
      filters: { id: 'lookup-1' },
      payload: {
        cached_status: 402,
        status: 'wallet_rejected',
      },
    });
  });

  it('caches a terminal 500 when wallet debit fails unexpectedly', async () => {
    mocks.mockRedeemImeiWalletPayment.mockRejectedValueOnce(
      new Error('wallet rpc unavailable')
    );
    const adminSupabase = createSupabaseMock();
    mockAuthenticatedUser({ adminSupabase });
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(mocks.mockRequestSickwCheck).not.toHaveBeenCalled();
    expect(adminSupabase.__updates.at(-1)).toMatchObject({
      filters: { id: 'lookup-1' },
      payload: {
        cached_response: body,
        cached_status: 500,
        sickw_status: 'wallet_debit_error',
        status: 'failed_error',
      },
    });
  });

  it('debits the wallet before calling SICKW', async () => {
    const callOrder: string[] = [];
    mocks.mockRedeemImeiWalletPayment.mockImplementationOnce(() => {
      callOrder.push('debit');
    });
    mocks.mockRequestSickwCheck.mockImplementationOnce(() => {
      callOrder.push('sickw');
      return {
        body: {
          data: { device: 'iPhone 15', imei: VALID_IMEI },
          success: true,
          tier: { checksIncluded: ['device'], name: 'Full Check' },
        },
        ok: true,
        rawResponseText: 'raw-provider-payload',
        sickwStatus: 'success',
        status: 200,
      };
    });
    const adminSupabase = createSupabaseMock();
    const userSupabase = createSupabaseMock();
    mockAuthenticatedUser({ adminSupabase, userSupabase });
    const { POST } = await importRoute();

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(callOrder).toEqual(['debit', 'sickw']);
    // H4: imei_lookups writes + wallet RPCs go through the service-role
    // client. Reads (resolveImeiCustomer / wallet balance) stay on the
    // authenticated user client.
    expect(mocks.mockCreateAdminClient).toHaveBeenCalled();
    expect(mocks.mockResolveImeiCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ supabase: userSupabase })
    );
    expect(mocks.mockReadCustomerWalletBalance).toHaveBeenCalledWith(
      expect.objectContaining({ supabase: userSupabase })
    );
    expect(mocks.mockRedeemImeiWalletPayment).toHaveBeenCalledWith(
      expect.objectContaining({ supabaseAdmin: adminSupabase })
    );
    expect(userSupabase.__updates).toHaveLength(0);
    expect(adminSupabase.__updates.at(-1)).toMatchObject({
      filters: { id: 'lookup-1' },
      payload: {
        response_hash: createHash('sha256')
          .update('raw-provider-payload')
          .digest('hex'),
        status: 'completed',
      },
    });
  });

  it('returns an unresolved error when successful lookup persistence fails', async () => {
    const adminSupabase = createSupabaseMock();
    adminSupabase.__setUpdateError({ message: 'database unavailable' });
    mockAuthenticatedUser({ adminSupabase });
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(500);
    expect(body.code).toBe('LOOKUP_RESULT_SAVE_FAILED');
    expect(mocks.mockRefundImeiWalletPayment).not.toHaveBeenCalled();
    expect(adminSupabase.__updates.at(-1)).toMatchObject({
      filters: { id: 'lookup-1' },
      payload: {
        cached_status: 200,
        status: 'completed',
      },
    });
  });

  it('refunds and caches a 502 when SICKW fails', async () => {
    mocks.mockRequestSickwCheck.mockResolvedValueOnce({
      body: {
        code: 'SICKW_UNAVAILABLE',
        error: 'Lookup failed; your wallet was refunded.',
        success: false,
      },
      ok: false,
      refundReason: 'error',
      sickwStatus: 'unavailable',
      status: 502,
    });
    const adminSupabase = createSupabaseMock();
    mockAuthenticatedUser({ adminSupabase });
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(502);
    expect(body.code).toBe('SICKW_UNAVAILABLE');
    expect(mocks.mockRefundImeiWalletPayment).toHaveBeenCalledWith(
      expect.objectContaining({ lookupId: 'lookup-1' })
    );
    expect(adminSupabase.__updates.at(-1)).toMatchObject({
      filters: { id: 'lookup-1' },
      payload: {
        cached_status: 502,
        status: 'refunded_error',
      },
    });
  });

  it('fails when refunded terminal state cannot be persisted', async () => {
    mocks.mockRequestSickwCheck.mockResolvedValueOnce({
      body: {
        code: 'SICKW_UNAVAILABLE',
        error: 'Lookup failed; your wallet was refunded.',
        success: false,
      },
      ok: false,
      refundReason: 'error',
      sickwStatus: 'unavailable',
      status: 502,
    });
    const adminSupabase = createSupabaseMock();
    adminSupabase.__setUpdateError({ message: 'database unavailable' });
    mockAuthenticatedUser({ adminSupabase });
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(500);
    expect(body.code).toBe('REFUNDED_STATE_SAVE_FAILED');
    expect(mocks.mockRefundImeiWalletPayment).toHaveBeenCalledWith(
      expect.objectContaining({ lookupId: 'lookup-1' })
    );
    expect(adminSupabase.__updates.at(-1)).toMatchObject({
      filters: { id: 'lookup-1' },
      payload: {
        cached_status: 502,
        status: 'refunded_error',
      },
    });
  });

  it('marks refund_pending when refund RPC fails', async () => {
    mocks.mockRequestSickwCheck.mockResolvedValueOnce({
      body: {
        code: 'SICKW_NOT_FOUND',
        error: 'IMEI result was not found; your wallet was refunded.',
        success: false,
      },
      ok: false,
      refundReason: 'not_found',
      sickwStatus: 'not_found',
      status: 404,
    });
    mocks.mockRefundImeiWalletPayment.mockRejectedValueOnce(
      new Error('refund rpc down')
    );
    const adminSupabase = createSupabaseMock();
    mockAuthenticatedUser({ adminSupabase });
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(502);
    expect(body.code).toBe('REFUND_PENDING');
    expect(adminSupabase.__updates.at(-1)).toMatchObject({
      filters: { id: 'lookup-1' },
      payload: {
        cached_status: 502,
        status: 'refund_pending',
      },
    });
  });

  it('fails when refund_pending state cannot be persisted', async () => {
    mocks.mockRequestSickwCheck.mockResolvedValueOnce({
      body: {
        code: 'SICKW_UNAVAILABLE',
        error: 'Lookup failed; your wallet was refunded.',
        success: false,
      },
      ok: false,
      refundReason: 'error',
      sickwStatus: 'unavailable',
      status: 502,
    });
    mocks.mockRefundImeiWalletPayment.mockRejectedValueOnce(
      new Error('refund rpc down')
    );
    const adminSupabase = createSupabaseMock();
    adminSupabase.__setUpdateError({ message: 'database unavailable' });
    mockAuthenticatedUser({ adminSupabase });
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(500);
    expect(body.code).toBe('REFUND_STATE_SAVE_FAILED');
    expect(adminSupabase.__updates.at(-1)).toMatchObject({
      filters: { id: 'lookup-1' },
      payload: {
        cached_status: 502,
        status: 'refund_pending',
      },
    });
  });

  it('returns 409 on Idempotency-Key reuse with a different fingerprint', async () => {
    mockAuthenticatedUser({
      userSupabase: createSupabaseMock([
        {
          amount_ngn: 1500,
          cached_response: null,
          cached_status: null,
          customer_id: 'customer-1',
          id: 'lookup-1',
          idempotency_key: IDEMPOTENCY_KEY,
          imei_hash: 'different-hash',
          merchant_id: 'merchant-1',
          status: 'completed',
          tier: 'full',
        },
      ]),
    });
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(mocks.mockRedeemImeiWalletPayment).not.toHaveBeenCalled();
  });

  it('handles a concurrent insert race for the same Idempotency-Key', async () => {
    const userSupabase = createSupabaseMock([
      {
        amount_ngn: 1500,
        cached_response: {
          data: { device: 'iPhone 15', imei: VALID_IMEI },
          success: true,
        },
        cached_status: 200,
        customer_id: 'customer-1',
        id: 'lookup-winner',
        idempotency_key: IDEMPOTENCY_KEY,
        imei_hash: hashImeiForTest(VALID_IMEI),
        merchant_id: 'merchant-1',
        status: 'completed',
        tier: 'full',
      },
    ]);
    const adminSupabase = createSupabaseMock();
    adminSupabase.__setInsertError({
      code: '23505',
      message: 'duplicate key',
    });
    mockAuthenticatedUser({ adminSupabase, userSupabase });
    const { POST } = await importRoute();

    const response = await POST(createRequest());
    const body = (await response.json()) as { success: boolean };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.mockRedeemImeiWalletPayment).not.toHaveBeenCalled();
  });
});

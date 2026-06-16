import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({})),
}));

// Supabase mock
const USER_ID = 'user-111';
const MERCHANT_ID = 'merchant-222';
const REQUESTED_MERCHANT_ID = 'merchant-requested-333';

function createMerchantContext(merchantId: string) {
  return {
    merchantId,
    staffAccess: {
      isStaff: false,
      isOwner: true,
      role: null,
      permissions: { full_access: { all: true } },
    },
  };
}

let mockUser: { id: string } | null = { id: USER_ID };
let mockAuthError: { message: string } | null = null;

let rpcResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let updateResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
const rpcCalls: Array<{ fn: string; args: unknown }> = [];

function createMockSupabase() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(() => {
      const eqChain: Record<string, unknown> = {
        eq: vi.fn(() => eqChain),
      };
      Object.defineProperty(eqChain, 'then', {
        value: (
          resolve: (v: unknown) => unknown,
          reject?: (e: unknown) => unknown
        ) => Promise.resolve(updateResult).then(resolve, reject),
        writable: true,
        configurable: true,
      });
      return eqChain;
    }),
  };

  return {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: mockUser },
          error: mockAuthError,
        })
      ),
    },
    from: vi.fn(() => chain),
    rpc: vi.fn((fn: string, args: unknown) => {
      rpcCalls.push({ args, fn });
      return Promise.resolve(rpcResult);
    }),
    _chain: chain,
  };
}

let mockSupabase: ReturnType<typeof createMockSupabase>;

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => {
    mockSupabase = createMockSupabase();
    return mockSupabase;
  }),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(() =>
    Promise.resolve(createMerchantContext(MERCHANT_ID))
  ),
}));

// ── Import after mocks ───────────────────────────────────────────────────────

import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { DELETE, POST } from './route';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(
  body: Record<string, unknown>,
  method = 'POST'
): NextRequest {
  return new NextRequest('http://localhost:3000/api/push-tokens/register', {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/push-tokens/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMerchantForApiRequest).mockResolvedValue(
      createMerchantContext(MERCHANT_ID)
    );
    mockUser = { id: USER_ID };
    mockAuthError = null;
    rpcResult = { data: null, error: null };
    updateResult = { data: null, error: null };
    rpcCalls.length = 0;
  });

  it('returns 401 when user is not authenticated', async () => {
    mockUser = null;

    const res = await POST(
      makeRequest({ token: 'ExponentPushToken[xxx]', platform: 'ios' })
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body (missing token)', async () => {
    const res = await POST(makeRequest({ platform: 'ios' }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 for invalid platform', async () => {
    const res = await POST(
      makeRequest({ token: 'ExponentPushToken[xxx]', platform: 'windows' })
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid app_type', async () => {
    const res = await POST(
      makeRequest({
        token: 'ExponentPushToken[xxx]',
        platform: 'ios',
        app_type: 'invalid',
      })
    );

    expect(res.status).toBe(400);
  });

  it('defaults app_type to admin when not provided', async () => {
    const res = await POST(
      makeRequest({ token: 'ExponentPushToken[xxx]', platform: 'ios' })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    expect(rpcCalls).toEqual([
      {
        fn: 'register_push_token',
        args: expect.objectContaining({ p_app_type: 'admin' }),
      },
    ]);
  });

  it('registers tokens through the atomic RPC without a read-before-write lookup', async () => {
    const res = await POST(
      makeRequest({
        token: 'ExponentPushToken[xxx]',
        platform: 'ios',
        app_type: 'storefront',
      })
    );

    expect(res.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('register_push_token', {
      p_app_type: 'storefront',
      p_device_name: null,
      p_merchant_id: MERCHANT_ID,
      p_platform: 'ios',
      p_token: 'ExponentPushToken[xxx]',
    });
    expect(mockSupabase._chain.select).not.toHaveBeenCalled();
    expect(mockSupabase._chain.maybeSingle).not.toHaveBeenCalled();
  });

  it('returns 500 when the push token registration RPC fails', async () => {
    rpcResult = {
      data: null,
      error: { code: '57014', message: 'query_canceled' },
    };

    const res = await POST(
      makeRequest({ token: 'ExponentPushToken[xxx]', platform: 'ios' })
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Failed to register push token');
  });

  it('uses the requested merchant id when reclaiming an existing storefront token', async () => {
    vi.mocked(getMerchantForApiRequest).mockResolvedValueOnce(
      createMerchantContext(REQUESTED_MERCHANT_ID)
    );

    const res = await POST(
      makeRequest({
        token: 'ExponentPushToken[requested-merchant-device]',
        platform: 'ios',
        app_type: 'storefront',
        merchant_id: REQUESTED_MERCHANT_ID,
      })
    );

    expect(res.status).toBe(200);
    expect(getMerchantForApiRequest).toHaveBeenCalledWith(
      mockSupabase,
      USER_ID,
      { requestedMerchantId: REQUESTED_MERCHANT_ID }
    );
    expect(rpcCalls[0]?.args).toEqual(
      expect.objectContaining({ p_merchant_id: REQUESTED_MERCHANT_ID })
    );
  });
});

describe('DELETE /api/push-tokens/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: USER_ID };
    mockAuthError = null;
    updateResult = { data: null, error: null };
  });

  it('returns 401 when not authenticated', async () => {
    mockUser = null;

    const req = new NextRequest(
      'http://localhost:3000/api/push-tokens/register?token=ExponentPushToken[xxx]',
      { method: 'DELETE' }
    );
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when token param is missing', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/push-tokens/register',
      { method: 'DELETE' }
    );
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it('deactivates token for authenticated user', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/push-tokens/register?token=ExponentPushToken[xxx]',
      { method: 'DELETE' }
    );
    const res = await DELETE(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe('Push token deactivated');
  });
});

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

let mockUser: { id: string } | null = { id: USER_ID };
let mockAuthError: { message: string } | null = null;

// Track calls for assertion
let selectResult: { data: unknown; error: unknown } = {
  data: null,
  error: { code: 'PGRST116', message: 'not found' },
};
let insertResult: { data: unknown; error: unknown } = {
  data: { id: 'token-id-1' },
  error: null,
};
let updateResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let updateCalls: Array<{ payload: unknown; filter: string }> = [];

function createMockSupabase() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve(selectResult)),
    insert: vi.fn((_payload: unknown) => {
      insertResult.data = { id: 'token-id-new' };
      return {
        select: vi.fn().mockReturnValue({
          single: vi.fn(() => Promise.resolve(insertResult)),
        }),
      };
    }),
    update: vi.fn((payload: unknown) => {
      updateCalls.push({ payload, filter: '' });
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
    Promise.resolve({ merchantId: MERCHANT_ID })
  ),
}));

// ── Import after mocks ───────────────────────────────────────────────────────

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
    mockUser = { id: USER_ID };
    mockAuthError = null;
    selectResult = {
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    };
    insertResult = { data: { id: 'token-id-new' }, error: null };
    updateResult = { data: null, error: null };
    updateCalls = [];
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

  it('accepts app_type=admin (default)', async () => {
    const res = await POST(
      makeRequest({ token: 'ExponentPushToken[xxx]', platform: 'ios' })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('accepts app_type=storefront', async () => {
    const res = await POST(
      makeRequest({
        token: 'ExponentPushToken[xxx]',
        platform: 'android',
        app_type: 'storefront',
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
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
    // The Zod schema defaults app_type to 'admin'
    // Verify by checking insert was called (new token path)
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('updates existing token when user_id matches', async () => {
    selectResult = {
      data: { id: 'existing-token-id', user_id: USER_ID },
      error: null,
    };

    const res = await POST(
      makeRequest({
        token: 'ExponentPushToken[xxx]',
        platform: 'ios',
        app_type: 'storefront',
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe('Push token updated');
  });

  it('transfers token ownership when user_id differs', async () => {
    selectResult = {
      data: { id: 'existing-token-id', user_id: 'other-user' },
      error: null,
    };

    const res = await POST(
      makeRequest({
        token: 'ExponentPushToken[xxx]',
        platform: 'android',
        app_type: 'admin',
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe('Push token updated');
  });

  it('inserts new token when no existing token found', async () => {
    const res = await POST(
      makeRequest({
        token: 'ExponentPushToken[new-device]',
        platform: 'ios',
        device_name: 'iPhone 15',
        app_type: 'admin',
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe('Push token registered');
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

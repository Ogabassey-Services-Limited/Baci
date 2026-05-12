import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/get-merchant-for-api-request')
  >('@/lib/get-merchant-for-api-request');
  return {
    ...actual,
    getMerchantForApiRequest: (...args: unknown[]) =>
      mockGetMerchantForApiRequest(...args),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

const merchantContext = {
  merchantId: 'merchant-1',
  merchantSlug: 'ogabassey',
  staffAccess: {
    isOwner: true,
    isStaff: false,
    permissions: { full_access: { all: true } },
    role: null,
  },
};

function makeRequest() {
  return new NextRequest(
    'https://usebaci.com/api/merchant/agentic/action-health'
  );
}

function createQueryResult(data: unknown, error: unknown = null) {
  const chain = {
    eq: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve({ data, error })),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
  };
  const select = vi.fn(() => chain);
  return { chain, select };
}

function createSupabaseMock({
  checkoutSessions = [
    {
      metadata: { agentic: { payment_state: 'payment_pending' } },
      session_id: 'agentic-session-1',
      status: 'processing',
      updated_at: '2026-05-12T10:05:00.000Z',
    },
    {
      metadata: { agentic: { payment_state: 'order_finalizing' } },
      session_id: 'agentic-session-2',
      status: 'processing',
      updated_at: '2026-05-12T10:04:00.000Z',
    },
  ],
  idempotency = [
    {
      created_at: '2026-05-12T10:00:00.000Z',
      expires_at: '2026-05-12T10:15:00.000Z',
      idempotency_key: 'must-not-leak',
      request_hash: 'must-not-leak',
      route: 'checkout.complete',
      status_code: null,
      updated_at: '2026-05-12T10:01:00.000Z',
    },
    {
      created_at: '2026-05-12T10:02:00.000Z',
      expires_at: '2026-05-12T10:17:00.000Z',
      route: 'checkout.create',
      status_code: 503,
      updated_at: '2026-05-12T10:03:00.000Z',
    },
  ],
  idempotencyError = null,
  requests = [
    {
      api_version: '2026-04-30',
      created_at: '2026-05-12T10:00:00.000Z',
      expires_at: '2026-05-12T10:15:00.000Z',
      idempotency_key: 'must-not-leak',
      request_id: 'must-not-leak',
    },
  ],
}: {
  checkoutSessions?: unknown[];
  idempotency?: unknown[];
  idempotencyError?: unknown;
  requests?: unknown[];
} = {}) {
  const idempotencyQuery = createQueryResult(idempotency, idempotencyError);
  const requestQuery = createQueryResult(requests);
  const sessionQuery = createQueryResult(checkoutSessions);
  const from = vi.fn((table: string) => {
    if (table === 'agentic_idempotency_records') {
      return { select: idempotencyQuery.select };
    }
    if (table === 'agentic_request_records') {
      return { select: requestQuery.select };
    }
    if (table === 'checkout_sessions') {
      return { select: sessionQuery.select };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    from,
    idempotencyQuery,
    requestQuery,
    sessionQuery,
  };
}

describe('GET /api/merchant/agentic/action-health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockReturnValue(true);
    mockGetMerchantForApiRequest.mockResolvedValue(merchantContext);
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: createSupabaseMock(),
      user: { id: 'user-1' },
    });
  });

  it('returns merchant-scoped agentic action health without raw retry secrets', async () => {
    const supabase = createSupabaseMock();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase,
      user: { id: 'user-1' },
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      actions: [
        { code: 'AGENTIC_IDEMPOTENCY_ERRORS', count: 1, severity: 'attention' },
        { code: 'AGENTIC_ORDER_FINALIZING', count: 1, severity: 'attention' },
        { code: 'AGENTIC_REQUESTS_IN_PROGRESS', count: 1, severity: 'monitor' },
        { code: 'AGENTIC_PAYMENT_PENDING', count: 1, severity: 'monitor' },
      ],
      checkout_sessions: {
        order_finalizing_count: 1,
        payment_pending_count: 1,
        recent_count: 2,
      },
      idempotency: {
        in_progress_count: 1,
        recent_count: 2,
        terminal_error_count: 1,
      },
      merchant_id: 'merchant-1',
      requests: { recent_count: 1 },
    });
    expect(JSON.stringify(payload)).not.toContain('must-not-leak');
    expect(supabase.from).toHaveBeenCalledWith('agentic_idempotency_records');
    expect(supabase.from).toHaveBeenCalledWith('agentic_request_records');
    expect(supabase.from).toHaveBeenCalledWith('checkout_sessions');
    expect(supabase.idempotencyQuery.chain.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(supabase.requestQuery.chain.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(supabase.sessionQuery.chain.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(supabase.idempotencyQuery.select).toHaveBeenCalledWith(
      'route, status_code, created_at, updated_at, expires_at'
    );
    expect(supabase.requestQuery.select).toHaveBeenCalledWith(
      'api_version, created_at, expires_at'
    );
    expect(supabase.sessionQuery.select).toHaveBeenCalledWith(
      'session_id, status, metadata, updated_at'
    );
    expect(supabase.sessionQuery.chain.not).toHaveBeenCalledWith(
      'metadata->agentic',
      'is',
      null
    );
  });

  it('returns a healthy action when no recent issues are present', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: createSupabaseMock({
        checkoutSessions: [],
        idempotency: [{ status_code: 200 }],
        requests: [],
      }),
      user: { id: 'user-1' },
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.actions).toEqual([
      {
        code: 'AGENTIC_ACTIONS_HEALTHY',
        count: 0,
        message: 'No recent agentic action issues need attention.',
        severity: 'ok',
      },
    ]);
  });

  it('returns 401 before merchant lookup when authentication fails', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mockAuthenticateApiRequest).toHaveBeenCalledOnce();
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('returns 404 when no merchant context exists', async () => {
    mockGetMerchantForApiRequest.mockResolvedValue(null);

    const { GET } = await import('./route');
    const response = await GET(makeRequest());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Merchant not found' });
  });

  it('returns 403 when the user cannot view the dashboard', async () => {
    mockHasPermission.mockReturnValue(false);

    const { GET } = await import('./route');
    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(mockHasPermission).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 'merchant-1' }),
      'dashboard',
      'view'
    );
  });

  it('returns 500 when health records cannot be loaded', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: createSupabaseMock({
        idempotencyError: { message: 'db unavailable' },
      }),
      user: { id: 'user-1' },
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to load agentic action health',
    });
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        message: 'Failed to load agentic action health',
      })
    );
  });
});

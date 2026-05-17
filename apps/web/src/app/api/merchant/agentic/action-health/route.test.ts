import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const mockLoggerError = vi.fn();
const mockLoggerWarn = vi.fn();
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
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
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

function createSupabaseMock({
  featureSettingsData = {
    agentic_checkout_enabled: true,
    custom_settings: { agentic_agent_allowlist: ['chatgpt'] },
  },
  featureSettingsError = null,
  rpcData = buildRpcData(),
  rpcError = null,
}: {
  featureSettingsData?: unknown;
  featureSettingsError?: unknown;
  rpcData?: unknown;
  rpcError?: unknown;
} = {}) {
  const maybeSingle = vi.fn(() =>
    Promise.resolve({ data: featureSettingsData, error: featureSettingsError })
  );
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn(() => Promise.resolve({ data: rpcData, error: rpcError }));

  return { from, rpc };
}

function buildRpcData({
  checkoutSessions = [
    {
      metadata: { agentic: { payment_state: 'payment_pending' } },
      session_id: 'agentic-session-1',
      status: 'processing',
      updated_at: '2099-05-12T10:05:00.000Z',
    },
    {
      metadata: { agentic: { payment_state: 'order_finalizing' } },
      session_id: 'agentic-session-2',
      status: 'processing',
      updated_at: '2026-05-12T10:04:00.000Z',
    },
  ],
  idempotencyRecords = [
    {
      created_at: '2026-05-12T10:00:00.000Z',
      expires_at: '2099-05-12T10:15:00.000Z',
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
  requestRecords = [
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
  idempotencyRecords?: unknown[];
  requestRecords?: unknown[];
} = {}) {
  return {
    checkout_sessions: checkoutSessions,
    idempotency_records: idempotencyRecords,
    request_records: requestRecords,
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
        {
          code: 'AGENTIC_IDEMPOTENCY_ERRORS',
          count: 1,
          next_step: expect.any(String),
          next_step_url: '/dashboard/orders?source=agentic',
          severity: 'attention',
        },
        {
          code: 'AGENTIC_ORDER_FINALIZING',
          count: 1,
          next_step: expect.any(String),
          next_step_url: '/dashboard/orders?source=agentic',
          severity: 'attention',
        },
        {
          code: 'AGENTIC_REQUESTS_IN_PROGRESS',
          count: 1,
          next_step: expect.any(String),
          next_step_url: '/dashboard/orders?source=agentic',
          severity: 'monitor',
        },
        {
          code: 'AGENTIC_PAYMENT_PENDING',
          count: 1,
          next_step: expect.any(String),
          next_step_url: '/dashboard/orders?source=agentic',
          severity: 'monitor',
        },
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
      request_controls: {
        allowlist_count: 1,
        denylist_count: 0,
        fetch_error: false,
        is_agentic_checkout_enabled: true,
      },
      requests: { recent_count: 1 },
    });
    expect(JSON.stringify(payload)).not.toContain('must-not-leak');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_agentic_action_health_records',
      {
        p_merchant_id: 'merchant-1',
        p_record_limit: 25,
      }
    );
  });
  it('returns a healthy action when no recent issues are present', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: createSupabaseMock({
        rpcData: buildRpcData({
          checkoutSessions: [],
          idempotencyRecords: [{ status_code: 200 }],
          requestRecords: [],
        }),
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
        next_step: 'No action required right now.',
        severity: 'ok',
      },
    ]);
  });

  it('adds a monitor action when agent checkout is enabled without an allowlist', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: createSupabaseMock({
        featureSettingsData: {
          agentic_checkout_enabled: true,
          custom_settings: {},
        },
        rpcData: buildRpcData({
          checkoutSessions: [],
          idempotencyRecords: [{ status_code: 200 }],
          requestRecords: [],
        }),
      }),
      user: { id: 'user-1' },
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.actions).toEqual([
      {
        code: 'AGENTIC_AGENT_ALLOWLIST_UNSET',
        count: 1,
        message: 'No agent allowlist is configured in Trust settings.',
        next_step:
          'Open Trust settings and configure trusted agent user-agents before broadly advertising checkout.',
        next_step_url: '/dashboard/settings/trust',
        severity: 'monitor',
      },
    ]);
    expect(payload.request_controls).toEqual({
      allowlist_count: 0,
      denylist_count: 0,
      fetch_error: false,
      is_agentic_checkout_enabled: true,
    });
  });

  it('treats missing feature-settings rows as default-enabled and surfaces allowlist monitor action', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: createSupabaseMock({
        featureSettingsData: null,
        featureSettingsError: null,
        rpcData: buildRpcData({
          checkoutSessions: [],
          idempotencyRecords: [{ status_code: 200 }],
          requestRecords: [],
        }),
      }),
      user: { id: 'user-1' },
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.actions).toEqual([
      {
        code: 'AGENTIC_AGENT_ALLOWLIST_UNSET',
        count: 1,
        message: 'No agent allowlist is configured in Trust settings.',
        next_step:
          'Open Trust settings and configure trusted agent user-agents before broadly advertising checkout.',
        next_step_url: '/dashboard/settings/trust',
        severity: 'monitor',
      },
    ]);
    expect(payload.request_controls).toEqual({
      allowlist_count: 0,
      denylist_count: 0,
      fetch_error: false,
      is_agentic_checkout_enabled: true,
    });
  });

  it('logs a warning and skips allowlist monitor actions when control lookup fails', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: createSupabaseMock({
        featureSettingsData: null,
        featureSettingsError: { message: 'feature settings unavailable' },
        rpcData: buildRpcData({
          checkoutSessions: [],
          idempotencyRecords: [{ status_code: 200 }],
          requestRecords: [],
        }),
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
        next_step: 'No action required right now.',
        severity: 'ok',
      },
    ]);
    expect(payload.request_controls).toEqual({
      allowlist_count: 0,
      denylist_count: 0,
      fetch_error: true,
      is_agentic_checkout_enabled: false,
    });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        message: 'Failed to load agentic request controls for action health',
      })
    );
  });
  it('separates expired and active in-progress idempotency reservations', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: createSupabaseMock({
        rpcData: buildRpcData({
          checkoutSessions: [],
          idempotencyRecords: [
            {
              created_at: '2026-05-12T10:00:00.000Z',
              expires_at: '2020-01-01T00:00:00.000Z',
              route: 'checkout.complete',
              status_code: null,
              updated_at: '2026-05-12T10:16:00.000Z',
            },
            {
              created_at: '2026-05-12T10:20:00.000Z',
              expires_at: '2099-01-01T00:00:00.000Z',
              route: 'checkout.update',
              status_code: null,
              updated_at: '2026-05-12T10:21:00.000Z',
            },
          ],
          requestRecords: [],
        }),
      }),
      user: { id: 'user-1' },
    });
    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS',
          count: 1,
          message:
            'Agentic retry reservations expired before storing a response.',
          next_step: expect.any(String),
          next_step_url: '/dashboard/orders?source=agentic',
          severity: 'attention',
        }),
        expect.objectContaining({
          code: 'AGENTIC_REQUESTS_IN_PROGRESS',
          count: 1,
          message: 'Agentic idempotency reservations are still in progress.',
          next_step: expect.any(String),
          next_step_url: '/dashboard/orders?source=agentic',
          severity: 'monitor',
        }),
      ])
    );
    expect(payload.idempotency).toMatchObject({
      active_in_progress_count: 1,
      in_progress_count: 2,
      stale_in_progress_count: 1,
    });
  });

  it('surfaces checkout completion failures as a dedicated action', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: createSupabaseMock({
        rpcData: buildRpcData({
          checkoutSessions: [],
          idempotencyRecords: [
            {
              created_at: '2026-05-12T10:00:00.000Z',
              expires_at: '2099-01-01T00:00:00.000Z',
              route: 'checkout_sessions.complete',
              status_code: 502,
              updated_at: '2026-05-12T10:01:00.000Z',
            },
          ],
          requestRecords: [],
        }),
      }),
      user: { id: 'user-1' },
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AGENTIC_CHECKOUT_COMPLETE_ERRORS',
          count: 1,
          message:
            'Agentic checkout completions are failing before order finalization.',
          next_step: expect.any(String),
          next_step_url: '/dashboard/orders?source=agentic',
          severity: 'attention',
        }),
      ])
    );
    expect(payload.actions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AGENTIC_IDEMPOTENCY_ERRORS',
        }),
      ])
    );
  });

  it('surfaces payment setup failures and active payment claims', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: createSupabaseMock({
        rpcData: buildRpcData({
          checkoutSessions: [
            {
              metadata: { agentic: { payment_state: 'payment_setup_failed' } },
              session_id: 'agentic-session-setup-failed',
              status: 'processing',
              updated_at: '2026-05-12T10:06:00.000Z',
            },
            {
              metadata: { agentic: { payment_state: 'claiming_payment' } },
              session_id: 'agentic-session-claiming',
              status: 'processing',
              updated_at: '2026-05-12T10:05:00.000Z',
            },
          ],
          idempotencyRecords: [{ status_code: 200 }],
          requestRecords: [],
        }),
      }),
      user: { id: 'user-1' },
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AGENTIC_PAYMENT_SETUP_FAILED',
          count: 1,
          message:
            'Agentic checkouts failed while setting up payment collection.',
          next_step: expect.any(String),
          next_step_url: '/dashboard/orders?source=agentic',
          severity: 'attention',
        }),
        expect.objectContaining({
          code: 'AGENTIC_PAYMENT_CLAIMING',
          count: 1,
          message: 'Agentic checkouts are claiming payment setup.',
          next_step: expect.any(String),
          next_step_url: '/dashboard/orders?source=agentic',
          severity: 'monitor',
        }),
      ])
    );
    expect(payload.checkout_sessions).toMatchObject({
      claiming_payment_count: 1,
      payment_setup_failed_count: 1,
    });
  });

  it('escalates stale payment-pending sessions separately from active pending payments', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: createSupabaseMock({
        rpcData: buildRpcData({
          checkoutSessions: [
            {
              metadata: { agentic: { payment_state: 'payment_pending' } },
              session_id: 'agentic-session-stale-payment',
              status: 'processing',
              updated_at: '2020-01-01T00:00:00.000Z',
            },
            {
              metadata: { agentic: { payment_state: 'payment_pending' } },
              session_id: 'agentic-session-active-payment',
              status: 'processing',
              updated_at: '2099-01-01T00:00:00.000Z',
            },
          ],
          idempotencyRecords: [{ status_code: 200 }],
          requestRecords: [],
        }),
      }),
      user: { id: 'user-1' },
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AGENTIC_PAYMENT_PENDING_STALE',
          count: 1,
          message:
            'Agentic checkouts have been waiting for payment confirmation too long.',
          next_step:
            'Confirm payment manually or cancel stale sessions before agents keep polling.',
          next_step_url: '/dashboard/orders?source=agentic',
          severity: 'attention',
        }),
        expect.objectContaining({
          code: 'AGENTIC_PAYMENT_PENDING',
          count: 1,
          message: 'Agentic checkouts are waiting for payment confirmation.',
          next_step: expect.any(String),
          next_step_url: '/dashboard/orders?source=agentic',
          severity: 'monitor',
        }),
      ])
    );
    expect(payload.checkout_sessions).toMatchObject({
      payment_pending_count: 2,
      stale_payment_pending_count: 1,
    });
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
        rpcError: { message: 'db unavailable' },
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

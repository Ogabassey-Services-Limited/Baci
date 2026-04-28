import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockCookies = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockRevalidateAnalytics = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookies()),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedPlatformAnalytics: vi.fn(),
}));

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateAnalytics: (...args: unknown[]) => mockRevalidateAnalytics(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

function createQueryBuilder(result: { data?: unknown; error?: unknown }) {
  const builder = {
    data: result.data ?? null,
    error: result.error ?? null,
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    select: vi.fn(() => builder),
  };

  return builder;
}

function createMockSupabase(
  merchantResult = { data: { is_platform_admin: true }, error: null }
) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn(() => createQueryBuilder(merchantResult)),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  };
}

function createRefreshRequest(init: RequestInit = {}): NextRequest {
  return new Request('http://localhost/api/admin/analytics/refresh', {
    method: 'POST',
    ...init,
  }) as NextRequest;
}

let mockSupabase = createMockSupabase();
let mockAdminRpc = vi.fn().mockResolvedValue({ error: null });

import { POST } from './route';

describe('/api/admin/analytics route POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCookies.mockReturnValue(new Map());
    mockCreateClient.mockReturnValue(mockSupabase);
    // refresh_platform_analytics_views runs through the admin client
    // (route uses createAdminClient() for that RPC call only).
    mockAdminRpc = vi.fn().mockResolvedValue({ error: null });
    mockCreateAdminClient.mockReturnValue({ rpc: mockAdminRpc });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: { isStaff: false },
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
  });

  it('returns 403 when CSRF validation fails on POST', async () => {
    mockCheckCsrfProtection.mockResolvedValueOnce({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });

    const response = await POST(createRefreshRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Invalid CSRF token');
  });

  it.each([
    {
      arrange: () => {
        mockSupabase.auth.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: null,
        });
      },
      error: 'Unauthorized',
      name: 'returns 401 when the user is not authenticated on POST',
      status: 401,
    },
    {
      arrange: () => {
        mockSupabase = createMockSupabase({
          data: { is_platform_admin: false },
          error: null,
        });
        mockCreateClient.mockReturnValue(mockSupabase);
      },
      error: 'Forbidden - Admin access required',
      name: 'returns 403 when the user is not a platform admin on POST',
      status: 403,
    },
    {
      arrange: () => {
        mockAdminRpc.mockResolvedValueOnce({
          error: { message: 'refresh failed' },
        });
      },
      error: 'Failed to refresh analytics views',
      name: 'returns 500 when the refresh RPC fails on POST',
      status: 500,
    },
  ])('$name', async ({ arrange, error, status }) => {
    arrange();

    const response = await POST(createRefreshRequest());
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(body.error).toBe(error);
  });

  it('refreshes analytics views on a valid POST request', async () => {
    const response = await POST(createRefreshRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockAdminRpc).toHaveBeenCalledWith(
      'refresh_platform_analytics_views'
    );
    expect(mockRevalidateAnalytics).toHaveBeenCalledTimes(1);
  });
});

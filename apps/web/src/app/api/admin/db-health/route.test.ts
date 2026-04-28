import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookies = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookies()),
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
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    select: vi.fn(() => builder),
  };

  return builder;
}

function createMockSupabase(
  options: {
    user?: { id: string } | null;
    adminCheck?: { is_platform_admin: boolean } | null;
    indexRecommendations?: unknown;
    missingIndexesError?: unknown;
  } = {}
) {
  const { user = { id: 'user-1' } } = options;
  const merchantsBuilder = createQueryBuilder({
    data: options.adminCheck ?? { is_platform_admin: true },
    error: null,
  });
  const indexRecsBuilder = createQueryBuilder({
    data: options.indexRecommendations ?? [],
    error: null,
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return merchantsBuilder;
      }
      if (table === 'index_recommendations') {
        return indexRecsBuilder;
      }
      return createQueryBuilder({ data: null, error: null });
    }),
    rpc: vi.fn().mockResolvedValue({
      data: [],
      error: options.missingIndexesError ?? null,
    }),
  };
}

let mockSupabase = createMockSupabase();
let mockAdminRpc = vi.fn().mockResolvedValue({ data: [], error: null });

import { GET } from './route';

describe('GET /api/admin/db-health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCookies.mockReturnValue(new Map());
    mockCreateClient.mockReturnValue(mockSupabase);
    mockAdminRpc = vi.fn().mockResolvedValue({ data: [], error: null });
    mockCreateAdminClient.mockReturnValue({ rpc: mockAdminRpc });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: { isStaff: false },
    });
  });

  it('returns 401 when the user is not authenticated', async () => {
    mockSupabase = createMockSupabase({ user: null });
    mockCreateClient.mockReturnValue(mockSupabase);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when the user has no merchant', async () => {
    mockGetMerchantForApiRequest.mockResolvedValueOnce(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Merchant not found');
  });

  it('returns 403 when the caller is staff (not owner)', async () => {
    mockGetMerchantForApiRequest.mockResolvedValueOnce({
      merchantId: 'merchant-1',
      staffAccess: { isStaff: true },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Permission denied');
  });

  it('returns 403 when the caller is not a platform admin', async () => {
    mockSupabase = createMockSupabase({
      adminCheck: { is_platform_admin: false },
    });
    mockCreateClient.mockReturnValue(mockSupabase);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden - Admin access required');
  });

  it('returns 200 with health metrics for a platform admin', async () => {
    mockAdminRpc.mockResolvedValueOnce({
      data: [{ check: 'connections', status: 'ok' }],
      error: null,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.health).toEqual([{ check: 'connections', status: 'ok' }]);
    // The route uses the admin client (service-role) for check_database_health
    // because the function is locked to service_role per migration 20260428071421.
    expect(mockAdminRpc).toHaveBeenCalledWith('check_database_health');
  });

  it('returns 500 when an unexpected error is thrown', async () => {
    mockGetMerchantForApiRequest.mockRejectedValueOnce(
      new Error('database is down')
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to check database health');
  });
});

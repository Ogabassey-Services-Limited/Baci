import type { StoreReadiness } from '@baci/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  hasPermission: vi.fn(),
  loadStoreReadiness: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticateApiRequest,
  hasPermission: mocks.hasPermission,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchantForApiRequest,
  toUserAccess: (context: { merchantId: string; staffAccess: unknown }) => ({
    merchantId: context.merchantId,
    ...(context.staffAccess as object),
  }),
}));

vi.mock('@/lib/store-readiness/load-store-readiness', () => ({
  loadStoreReadiness: mocks.loadStoreReadiness,
}));

const merchantContext = {
  merchantId: '11111111-1111-4111-8111-111111111111',
  staffAccess: {
    isOwner: true,
    isStaff: false,
    permissions: { full_access: { all: true } },
    role: 'owner',
  },
};

const readiness: StoreReadiness = {
  completedRecommended: 0,
  completedRequired: 1,
  isPublished: false,
  isReady: true,
  items: [
    {
      category: 'store',
      completed: true,
      description: 'Choose a unique address for your store.',
      id: 'store_url',
      label: 'Set your store URL',
      priority: 'required',
    },
  ],
  merchantId: merchantContext.merchantId,
  overallProgress: 100,
  storeBuild: {
    aiStatus: 'not_started',
    canApplyAiDraft: false,
    latestJobId: null,
    message: 'Starter store is ready.',
    starterStoreReady: true,
  },
  surface: 'web',
  totalRecommended: 0,
  totalRequired: 1,
};

function request(path = '') {
  return new NextRequest(`https://usebaci.com/api/merchant/readiness${path}`);
}

function bearerRequest(path = '') {
  return new NextRequest(`https://usebaci.com/api/merchant/readiness${path}`, {
    headers: { Authorization: 'Bearer mobile-session-token' },
  });
}

describe('GET /api/merchant/readiness', () => {
  const scopedClient = { scope: 'caller' } as unknown as SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: scopedClient,
      user: { id: 'user-1' },
    });
    mocks.getMerchantForApiRequest.mockResolvedValue(merchantContext);
    mocks.hasPermission.mockReturnValue(true);
    mocks.loadStoreReadiness.mockResolvedValue(readiness);
  });

  it('returns 401 before merchant lookup when bearer or cookie auth fails', async () => {
    mocks.authenticateApiRequest.mockResolvedValue({
      error: 'Not authenticated',
      supabase: null,
      user: null,
    });
    const { GET } = await import('./route');

    const response = await GET(bearerRequest('?merchantId=not-a-uuid'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(mocks.loadStoreReadiness).not.toHaveBeenCalled();
  });

  it('returns 401 when authentication reports an error despite a populated client and user', async () => {
    mocks.authenticateApiRequest.mockResolvedValue({
      error: 'Expired session',
      supabase: scopedClient,
      user: { id: 'user-1' },
    });
    const { GET } = await import('./route');

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(mocks.loadStoreReadiness).not.toHaveBeenCalled();
  });

  it('passes the bearer-scoped client to merchant resolution and the loader', async () => {
    const { GET } = await import('./route');
    const input = bearerRequest('?surface=mobile');

    await GET(input);

    expect(mocks.authenticateApiRequest).toHaveBeenCalledWith(input);
    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      scopedClient,
      'user-1',
      { requestedMerchantId: undefined }
    );
    expect(mocks.loadStoreReadiness).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: merchantContext.merchantId,
        surface: 'mobile',
        supabase: scopedClient,
      })
    );
  });

  it('returns 400 for an invalid merchantId only after authentication succeeds', async () => {
    const { GET } = await import('./route');

    const response = await GET(request('?merchantId=not-a-uuid'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: 'INVALID_READINESS_QUERY',
      error: 'Invalid readiness query',
    });
    expect(mocks.authenticateApiRequest).toHaveBeenCalledTimes(1);
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid readiness surface', async () => {
    const { GET } = await import('./route');

    const response = await GET(request('?surface=desktop'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: 'INVALID_READINESS_QUERY',
      error: 'Invalid readiness query',
    });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('defaults cookie/web requests without a surface to web', async () => {
    const { GET } = await import('./route');

    await GET(request());

    expect(mocks.loadStoreReadiness).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 'web' })
    );
  });

  it('passes a valid requested merchantId to getMerchantForApiRequest', async () => {
    const { GET } = await import('./route');
    const requestedMerchantId = '22222222-2222-4222-8222-222222222222';

    await GET(request(`?merchantId=${requestedMerchantId}`));

    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      scopedClient,
      'user-1',
      { requestedMerchantId }
    );
  });

  it('returns 404 when the authenticated caller cannot access the requested merchant', async () => {
    mocks.getMerchantForApiRequest.mockResolvedValue(null);
    const { GET } = await import('./route');

    const response = await GET(
      bearerRequest('?merchantId=22222222-2222-4222-8222-222222222222')
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Merchant not found' });
    expect(mocks.loadStoreReadiness).not.toHaveBeenCalled();
  });

  it('supports a cookie-authenticated web request through the same helper', async () => {
    const { GET } = await import('./route');
    const input = request();

    const response = await GET(input);

    expect(response.status).toBe(200);
    expect(mocks.authenticateApiRequest).toHaveBeenCalledWith(input);
    expect(await response.json()).toEqual(readiness);
  });

  it('returns 404 when no merchant context exists', async () => {
    mocks.getMerchantForApiRequest.mockResolvedValue(null);
    const { GET } = await import('./route');

    const response = await GET(request());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Merchant not found' });
  });

  it('returns 403 without dashboard.view', async () => {
    mocks.hasPermission.mockReturnValue(false);
    const { GET } = await import('./route');

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(mocks.loadStoreReadiness).not.toHaveBeenCalled();
  });

  it('returns the platform-neutral readiness DTO on success', async () => {
    const { GET } = await import('./route');

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(readiness);
    expect(JSON.stringify(body)).not.toContain('href');
  });

  it('returns a stable 500 code when readiness loading fails', async () => {
    mocks.loadStoreReadiness.mockRejectedValue(
      new Error('database unavailable')
    );
    const { GET } = await import('./route');

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: 'READINESS_LOAD_FAILED',
      error: 'Failed to load store readiness',
    });
  });

  it('returns the stable 500 contract when merchant resolution fails', async () => {
    mocks.getMerchantForApiRequest.mockRejectedValue(
      new Error('merchant lookup unavailable')
    );
    const { GET } = await import('./route');

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: 'READINESS_LOAD_FAILED',
      error: 'Failed to load store readiness',
    });
    expect(mocks.loadStoreReadiness).not.toHaveBeenCalled();
  });
});

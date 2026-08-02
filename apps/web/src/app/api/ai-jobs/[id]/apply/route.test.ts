import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createApplyRequest,
  createApplySupabaseMock,
  merchantId,
  mocks,
  routeContext,
  setupApplyRouteMocks,
} from './route.test-helpers';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/get-merchant-for-api-request', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/get-merchant-for-api-request')
  >('@/lib/get-merchant-for-api-request');
  return {
    ...actual,
    getMerchantForApiRequest: mocks.getMerchantForApiRequest,
  };
});

import { POST } from './route';

describe('POST /api/ai-jobs/[id]/apply request guards', () => {
  beforeEach(setupApplyRouteMocks);

  it('returns 401 when the web session is missing', async () => {
    const supabase = createApplySupabaseMock();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    mocks.createClient.mockResolvedValue(supabase);

    const response = await POST(createApplyRequest(), routeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mocks.checkCsrfProtection).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it('authorizes and applies a fresh AI draft for the selected merchant', async () => {
    const supabase = createApplySupabaseMock();
    mocks.createClient.mockResolvedValue(supabase);

    const response = await POST(createApplyRequest(), routeContext());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      lastUpdated: '2026-04-28T10:30:00.000Z',
    });
    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      supabase,
      'user-1',
      { requestedMerchantId: merchantId }
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'apply_ai_storefront_draft',
      expect.objectContaining({
        p_job_id: 'job-1',
        p_merchant_id: merchantId,
        p_force: false,
      })
    );
    expect(
      mocks.getMerchantForApiRequest.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.checkRateLimit.mock.invocationCallOrder[0]);
    expect(mocks.checkRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      supabase.rpc.mock.invocationCallOrder[0]
    );
  });

  it('returns 404 without consuming quota for an unavailable requested merchant', async () => {
    const supabase = createApplySupabaseMock();
    mocks.createClient.mockResolvedValue(supabase);
    mocks.getMerchantForApiRequest.mockResolvedValue(null);

    const response = await POST(
      createApplyRequest(
        JSON.stringify({
          merchantId: '22222222-2222-4222-8222-222222222222',
        })
      ),
      routeContext()
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Merchant not found' });
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('returns 403 without consuming quota when the selected merchant denies builder edits', async () => {
    const supabase = createApplySupabaseMock();
    mocks.createClient.mockResolvedValue(supabase);
    mocks.getMerchantForApiRequest.mockResolvedValue({
      merchantId,
      staffAccess: {
        isOwner: false,
        isStaff: true,
        role: 'staff',
        permissions: {},
      },
    });

    const response = await POST(createApplyRequest(), routeContext());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('returns the CSRF rejection response before merchant or draft lookups', async () => {
    const supabase = createApplySupabaseMock();
    mocks.checkCsrfProtection.mockResolvedValue({
      valid: false,
      response: new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
      }),
    });
    mocks.createClient.mockResolvedValue(supabase);

    const response = await POST(createApplyRequest(), routeContext());

    expect(response.status).toBe(403);
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('returns 429 when the apply action is rate limited', async () => {
    const supabase = createApplySupabaseMock();
    mocks.checkRateLimit.mockResolvedValue(false);
    mocks.createClient.mockResolvedValue(supabase);

    const response = await POST(createApplyRequest(), routeContext());

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: 'Rate limit exceeded',
      code: 'rate_limited',
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('returns 400 before rate limiting or merchant lookup when merchant ID is missing', async () => {
    const supabase = createApplySupabaseMock();
    mocks.createClient.mockResolvedValue(supabase);

    const response = await POST(createApplyRequest('{}'), routeContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid request body',
      code: 'invalid_request_body',
    });
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('rejects a malformed draft ID before merchant lookup or the apply rate limit', async () => {
    const supabase = createApplySupabaseMock();
    mocks.createClient.mockResolvedValue(supabase);

    const response = await POST(
      createApplyRequest(),
      routeContext('not-a-uuid')
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid AI draft id',
      code: 'invalid_ai_draft_id',
    });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON bodies', async () => {
    const supabase = createApplySupabaseMock();
    mocks.createClient.mockResolvedValue(supabase);

    const response = await POST(
      createApplyRequest('{bad json'),
      routeContext()
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

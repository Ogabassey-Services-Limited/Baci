import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  checkCsrfProtection: vi.fn(),
  checkRateLimit: vi.fn(),
  createClient: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
}));

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

function createApplySupabaseMock(options?: {
  jobStatus?: string;
  pageUpdatedAt?: string;
  rpcError?: Error;
  rpcCode?: string | null;
  rpcResponse?: {
    applied: boolean;
    code: string | null;
    page_config_id: string | null;
    updated_at: string | null;
  };
}) {
  const rpcResult = options?.rpcResponse ?? {
    applied: !options?.rpcCode,
    code: options?.rpcCode ?? null,
    page_config_id: 'page-1',
    updated_at: '2026-04-28T10:30:00.000Z',
  };
  const rpc = vi.fn().mockImplementation(() => ({
    maybeSingle: vi.fn().mockResolvedValue({
      data: options?.rpcError ? null : rpcResult,
      error: options?.rpcError ?? null,
    }),
  }));

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    rpc,
    from: vi.fn((table: string) => {
      if (table === 'ai_jobs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'job-1',
              merchant_id: 'merchant-1',
              type: 'storefront_layout_generation',
              status: options?.jobStatus ?? 'completed',
              output: {
                generatedConfig: {
                  content: [],
                  root: { title: 'Home' },
                  zones: {},
                },
                generatedAgainstUpdatedAt: '2026-04-28T10:00:00.000Z',
              },
            },
            error: null,
          }),
        };
      }

      if (table === 'page_configs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'page-1',
              updated_at: options?.pageUpdatedAt ?? '2026-04-28T10:00:00.000Z',
            },
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function routeContext() {
  return { params: Promise.resolve({ jobId: 'job-1' }) };
}

function createApplyRequest(body?: string): NextRequest {
  return new Request('http://localhost/api/ai-jobs/job-1/apply', {
    method: 'POST',
    body,
  }) as unknown as NextRequest;
}

describe('POST /api/ai-jobs/[jobId]/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.checkRateLimit.mockResolvedValue(true);
    mocks.getMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        role: null,
        permissions: { full_access: { all: true } },
      },
    });
  });

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
  });

  it('applies a fresh AI draft with the atomic RPC', async () => {
    const supabase = createApplySupabaseMock();
    mocks.createClient.mockResolvedValue(supabase);

    const response = await POST(createApplyRequest(), routeContext());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      lastUpdated: '2026-04-28T10:30:00.000Z',
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'apply_ai_storefront_draft',
      expect.objectContaining({
        p_job_id: 'job-1',
        p_merchant_id: 'merchant-1',
        p_force: false,
      })
    );
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

  it('returns 409 when the AI job is not completed', async () => {
    const supabase = createApplySupabaseMock({ jobStatus: 'processing' });
    mocks.createClient.mockResolvedValue(supabase);

    const response = await POST(createApplyRequest(), routeContext());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'AI draft is not ready',
      code: 'ai_job_not_completed',
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('returns 409 when the draft changed after AI generation', async () => {
    const supabase = createApplySupabaseMock({
      pageUpdatedAt: '2026-04-28T10:15:00.000Z',
    });
    mocks.createClient.mockResolvedValue(supabase);

    const response = await POST(createApplyRequest(), routeContext());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: 'ai_draft_stale' })
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('uses the atomic RPC when force is explicitly true', async () => {
    const supabase = createApplySupabaseMock({
      pageUpdatedAt: '2026-04-28T10:15:00.000Z',
    });
    mocks.createClient.mockResolvedValue(supabase);

    const response = await POST(
      createApplyRequest(JSON.stringify({ force: true })),
      routeContext()
    );

    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'apply_ai_storefront_draft',
      expect.objectContaining({
        p_job_id: 'job-1',
        p_merchant_id: 'merchant-1',
        p_force: true,
      })
    );
  });

  it.each([
    [
      'ai_draft_stale',
      409,
      { error: 'AI draft is stale', code: 'ai_draft_stale' },
    ],
    [
      'job_already_applied',
      410,
      { error: 'AI draft already applied', code: 'job_already_applied' },
    ],
  ])('surfaces %s responses returned by the atomic RPC', async (code, status, body) => {
    const supabase = createApplySupabaseMock({
      rpcResponse: {
        applied: false,
        code,
        page_config_id: null,
        updated_at: null,
      },
    });
    mocks.createClient.mockResolvedValue(supabase);

    const response = await POST(createApplyRequest(), routeContext());

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(body);
  });

  it('returns 500 when the atomic apply RPC fails', async () => {
    const supabase = createApplySupabaseMock({
      rpcError: new Error('rpc exploded'),
    });
    mocks.createClient.mockResolvedValue(supabase);
    vi.spyOn(console, 'error').mockImplementation(() => {
      // Silence expected error logs for this branch.
    });

    const response = await POST(createApplyRequest(), routeContext());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to apply AI draft',
    });
  });
});

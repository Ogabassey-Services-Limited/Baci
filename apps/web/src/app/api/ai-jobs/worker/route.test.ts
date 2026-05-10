import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));

function createWorkerRequest(token = 'worker-secret'): NextRequest {
  return new Request('http://localhost/api/ai-jobs/worker', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }) as NextRequest;
}

function createSupabaseMock(result: unknown) {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(result),
    })),
  };
}

describe('/api/ai-jobs/worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.AI_WORKER_SECRET = 'worker-secret';
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
  });

  it('selects only web-safe price list jobs', async () => {
    const eqCalls: unknown[][] = [];
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn(function eq(this: unknown, ...args: unknown[]) {
          eqCalls.push(args);
          return this;
        }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };
    mocks.createClient.mockReturnValue(supabase);

    const response = await POST(createWorkerRequest());

    expect(response.status).toBe(200);
    expect(eqCalls).toContainEqual(['status', 'pending']);
    expect(eqCalls).toContainEqual(['type', 'price_list_processing']);
  });

  it('returns 403 when CSRF validation fails', async () => {
    mocks.checkCsrfProtection.mockResolvedValueOnce({
      valid: false,
      response: new Response(JSON.stringify({ error: 'bad csrf' }), {
        status: 403,
      }),
    });

    const response = await POST(createWorkerRequest());

    expect(response.status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each([
    '',
    'wrong-secret',
  ])('returns 401 for missing or invalid worker token', async (token) => {
    mocks.createClient.mockReturnValue(
      createSupabaseMock({ data: [], error: null })
    );

    const response = await POST(createWorkerRequest(token));

    expect(response.status).toBe(401);
  });

  it('returns 500 when pending jobs cannot be loaded', async () => {
    mocks.createClient.mockReturnValue(
      createSupabaseMock({ data: null, error: { message: 'db down' } })
    );

    const response = await POST(createWorkerRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to fetch jobs' });
  });
});

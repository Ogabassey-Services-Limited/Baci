import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('@/env', () => ({
  getCronSecret: () => process.env.CRON_SECRET,
}));

const mockRpc = vi.fn().mockResolvedValue({ data: 0, error: null });

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mockRpc,
  }),
}));

// =============================================================================
// Helpers
// =============================================================================

function createCronRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader) {
    headers.Authorization = authHeader;
  }
  return new NextRequest('http://localhost:3000/api/quiz/finalize', {
    method: 'GET',
    headers,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('GET /api/quiz/finalize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    mockRpc.mockResolvedValue({ data: 0, error: null });
  });

  it('returns 500 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(createCronRequest('Bearer test-cron-secret'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Server misconfigured' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const response = await GET(createCronRequest());

    expect(response.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is invalid', async () => {
    const response = await GET(createCronRequest('Bearer wrong-secret'));

    expect(response.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls finalize_due_quiz_events and returns the finalized count', async () => {
    mockRpc.mockResolvedValueOnce({ data: 4, error: null });

    const response = await GET(createCronRequest('Bearer test-cron-secret'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ finalized: 4 });
    expect(mockRpc).toHaveBeenCalledWith('finalize_due_quiz_events');
  });

  it('returns finalized: 0 when the RPC returns null', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const response = await GET(createCronRequest('Bearer test-cron-secret'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ finalized: 0 });
  });

  it('returns 500 when the RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    });

    const response = await GET(createCronRequest('Bearer test-cron-secret'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Quiz finalize failed',
      details: 'boom',
    });
  });
});

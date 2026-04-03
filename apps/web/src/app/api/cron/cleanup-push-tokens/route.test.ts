import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('@/env', () => ({
  getCronSecret: () => process.env.CRON_SECRET,
}));

const mockRpc = vi.fn().mockResolvedValue({ data: 5, error: null });

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
  return new NextRequest('http://localhost:3000/api/cron/cleanup-push-tokens', {
    method: 'GET',
    headers,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('GET /api/cron/cleanup-push-tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  it('returns 500 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(createCronRequest('Bearer test-cron-secret'));

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({ error: 'Server misconfigured' });
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

  it('calls cleanup_stale_push_tokens and returns cleaned count', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: 12, error: null })
      .mockResolvedValueOnce({ data: 7, error: null });

    const response = await GET(createCronRequest('Bearer test-cron-secret'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ cleanedTokens: 12, cleanedAttempts: 7 });
    expect(mockRpc).toHaveBeenCalledWith('cleanup_stale_push_tokens');
    expect(mockRpc).toHaveBeenCalledWith('cleanup_old_push_attempts');
  });

  it('returns 500 when RPC fails', async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'function not found' },
      })
      .mockResolvedValueOnce({ data: 0, error: null });

    const response = await GET(createCronRequest('Bearer test-cron-secret'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'function not found' });
  });

  it('returns cleaned: 0 when RPC returns null', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const response = await GET(createCronRequest('Bearer test-cron-secret'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ cleanedTokens: 0, cleanedAttempts: 0 });
  });
});

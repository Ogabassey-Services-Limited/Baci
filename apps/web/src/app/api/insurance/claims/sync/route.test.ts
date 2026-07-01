import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getCronSecret: () => 'cron-secret',
}));

vi.mock('@/services/insurance', () => ({
  syncClaimsStatus: vi.fn(),
}));

import { POST } from '@/app/api/insurance/claims/sync/route';
import { syncClaimsStatus } from '@/services/insurance';

function syncRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/insurance/claims/sync', {
    headers,
    method: 'POST',
  });
}

describe('POST /api/insurance/claims/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(syncClaimsStatus).mockResolvedValue({
      success: true,
      updated: 2,
    });
  });

  it('returns 401 when cron authentication is invalid', async () => {
    const response = await POST(
      syncRequest({ authorization: 'Bearer wrong-secret' })
    );

    expect(response.status).toBe(401);
    expect(syncClaimsStatus).not.toHaveBeenCalled();
  });

  it('accepts lowercase bearer authorization for claim sync', async () => {
    const response = await POST(
      syncRequest({ authorization: 'bearer cron-secret' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: 'Claims status synced successfully',
      updatedCount: 2,
    });
    expect(syncClaimsStatus).toHaveBeenCalledTimes(1);
  });

  it('keeps accepting legacy x-cron-secret requests', async () => {
    const response = await POST(
      syncRequest({ 'x-cron-secret': 'cron-secret' })
    );

    expect(response.status).toBe(200);
    expect(syncClaimsStatus).toHaveBeenCalledTimes(1);
  });

  it('returns 401 before claim sync when cron authentication is invalid', async () => {
    const response = await POST(
      syncRequest({ authorization: 'Bearer wrong-secret' })
    );

    expect(response.status).toBe(401);
    expect(syncClaimsStatus).not.toHaveBeenCalled();
  });

  it('does not require browser CSRF tokens after cron authentication succeeds', async () => {
    const response = await POST(
      syncRequest({ authorization: 'bearer cron-secret' })
    );

    expect(response.status).toBe(200);
    expect(syncClaimsStatus).toHaveBeenCalledTimes(1);
  });
});

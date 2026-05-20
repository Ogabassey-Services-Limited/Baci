import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getCronSecret: () => 'cron-secret',
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/services/insurance', () => ({
  syncClaimsStatus: vi.fn(),
}));

import { checkCsrfProtection } from '@/lib/csrf';
import { syncClaimsStatus } from '@/services/insurance';
import { POST } from './route';

function syncRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/insurance/claims/sync', {
    headers,
    method: 'POST',
  });
}

describe('POST /api/insurance/claims/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
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

  it('returns the CSRF failure response before cron authentication', async () => {
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
      valid: false,
    });

    const response = await POST(
      syncRequest({ authorization: 'bearer cron-secret' })
    );

    expect(response.status).toBe(403);
    expect(syncClaimsStatus).not.toHaveBeenCalled();
  });
});

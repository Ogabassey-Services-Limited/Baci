import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => supabase,
}));
const process = vi.hoisted(() => vi.fn());
vi.mock('../gigl-tracking/gigl-tracking-notification-worker', () => ({
  claimedGiglTrackingNotificationsSchema: {
    safeParse: (value: unknown) => ({ data: value, success: true }),
  },
  processClaimedGiglTrackingNotifications: process,
}));

import { GET } from './route';

describe('GET /api/cron/gigl-tracking-notifications', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'secret');
    vi.clearAllMocks();
    supabase.rpc.mockResolvedValue({ data: [], error: null });
    process.mockResolvedValue({
      claimed: 0,
      failed: 0,
      sent: 0,
      skipped: 0,
      success: true,
    });
  });

  it('rejects callers without the cron secret', async () => {
    expect(
      (
        await GET(
          new NextRequest(
            'http://localhost/api/cron/gigl-tracking-notifications'
          )
        )
      ).status
    ).toBe(401);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('claims and processes due notification outbox rows', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/cron/gigl-tracking-notifications?batchSize=7',
        { headers: { Authorization: 'Bearer secret' } }
      )
    );
    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'claim_shipment_tracking_notifications',
      expect.objectContaining({ p_limit: 7 })
    );
  });

  it('rejects an invalid batch size without claiming notifications', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/cron/gigl-tracking-notifications?batchSize=not-a-number',
        { headers: { Authorization: 'Bearer secret' } }
      )
    );

    expect(response.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('caps sequential processing to the cron-safe notification batch size', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/cron/gigl-tracking-notifications?batchSize=100',
        { headers: { Authorization: 'Bearer secret' } }
      )
    );

    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'claim_shipment_tracking_notifications',
      expect.objectContaining({ p_limit: 10 })
    );
  });

  it('uses the cron-safe batch size when no batch size is provided', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/cron/gigl-tracking-notifications', {
        headers: { Authorization: 'Bearer secret' },
      })
    );

    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'claim_shipment_tracking_notifications',
      expect.objectContaining({ p_limit: 10 })
    );
  });

  it('returns a server error when claims fail', async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'down' },
    });
    const response = await GET(
      new NextRequest('http://localhost/api/cron/gigl-tracking-notifications', {
        headers: { Authorization: 'Bearer secret' },
      })
    );
    expect(response.status).toBe(500);
  });
});

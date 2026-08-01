import { describe, expect, it, vi } from 'vitest';
import type { TrackingResult } from '@/lib/shipping/types';

vi.mock('@/lib/insurance/notify-activate-protection', () => ({
  maybeNotifyActivateProtection: vi.fn(),
}));

import { processClaimedGiglTrackingMonitors } from './gigl-tracking-monitor-worker';

const result: TrackingResult = {
  carrierName: 'GIG Logistics',
  events: [
    {
      description: 'In transit',
      providerEventKey: 'event-1',
      rawStatus: 'In transit',
      status: 'in_transit',
      timestamp: new Date('2026-07-31T10:00:00.000Z'),
    },
  ],
  provider: 'GIGL',
  status: 'in_transit',
  trackingNumber: 'GIGL-1',
};

const firstMonitor = {
  order_id: '00000000-0000-4000-8000-000000000001',
  shipment_id: '00000000-0000-4000-8000-000000000002',
  state: 'active' as const,
  tracking_epoch_id: '00000000-0000-4000-8000-000000000003',
  tracking_number: 'GIGL-1',
};

describe('processClaimedGiglTrackingMonitors duplicate waybills', () => {
  it('tracks a duplicate waybill once and applies its result to each monitor', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const supabase = { rpc };
    const secondMonitor = {
      ...firstMonitor,
      order_id: '00000000-0000-4000-8000-000000000004',
      shipment_id: '00000000-0000-4000-8000-000000000005',
      tracking_epoch_id: '00000000-0000-4000-8000-000000000006',
    };
    const trackShipments = vi.fn(async (trackingNumbers: readonly string[]) => {
      expect(trackingNumbers).toEqual(['GIGL-1']);
      return new Map([['GIGL-1', result]]);
    });

    const summary = await processClaimedGiglTrackingMonitors(
      supabase as never,
      [firstMonitor, secondMonitor],
      'worker-1',
      trackShipments
    );

    expect(summary).toEqual({
      applied: 2,
      claimed: 2,
      failed: 0,
      paused: 0,
      success: true,
    });
    expect(trackShipments).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

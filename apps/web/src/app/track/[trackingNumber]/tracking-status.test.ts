import { describe, expect, it } from 'vitest';
import { TRACKING_STATUS_CONFIG } from './tracking-status';

describe('TRACKING_STATUS_CONFIG', () => {
  it('keeps the pending tracking state available as the default fallback', () => {
    expect(TRACKING_STATUS_CONFIG.pending.label).toBe('Order Received');
    expect(TRACKING_STATUS_CONFIG.pending.icon).toBeDefined();
  });

  it('provides complete configuration for every tracking state', () => {
    const expectedLabels = {
      pending: 'Order Received',
      booked: 'Shipment Booked',
      pickup_scheduled: 'Pickup Scheduled',
      picked_up: 'Picked Up',
      in_transit: 'In Transit',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      failed: 'Delivery Failed',
      returned: 'Returned',
    } satisfies Record<keyof typeof TRACKING_STATUS_CONFIG, string>;

    for (const [status, label] of Object.entries(expectedLabels)) {
      const config = TRACKING_STATUS_CONFIG[status];

      expect(config, `${status} config missing`).toBeDefined();
      expect(config.label).toBe(label);
      expect(config.icon, `${status} icon missing`).toBeDefined();
      expect(config.color, `${status} color missing`).toBeDefined();
      expect(config.bgColor, `${status} bgColor missing`).toBeDefined();
    }
  });
});

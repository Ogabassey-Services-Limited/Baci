import { describe, expect, it } from 'vitest';
import { shipmentTrackingStatusSchema } from './shipment-tracking-status';

describe('shipmentTrackingStatusSchema', () => {
  it('accepts every shared shipment lifecycle status', () => {
    expect(
      shipmentTrackingStatusSchema.options.every(
        (status) => shipmentTrackingStatusSchema.safeParse(status).success
      )
    ).toBe(true);
  });

  it('rejects provider-specific status text', () => {
    expect(shipmentTrackingStatusSchema.safeParse('MAPT').success).toBe(false);
  });
});

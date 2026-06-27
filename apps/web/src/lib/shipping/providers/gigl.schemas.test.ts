import { describe, expect, it } from 'vitest';
import { giglSchemas } from './gigl.schemas';

describe('giglSchemas', () => {
  it('accepts partial tracking shipments with nullable status reasons', () => {
    const result = giglSchemas.trackingData.safeParse([
      {
        Waybill: 'GIGL123',
        PickupOptions: 1,
        MobileShipmentTrackings: [
          {
            Status: 'Shipment delivered',
            ScanStatusReason: null,
            DateTime: '2026-06-27T08:00:00.000Z',
          },
        ],
      },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data[0].Origin).toBeUndefined();
    expect(result.data[0].Destination).toBeUndefined();
    expect(result.data[0].DeliveryType).toBeUndefined();
    expect(result.data[0].MobileShipmentTrackings[0].ScanStatusReason).toBe('');
  });

  it('rejects malformed price totals', () => {
    const result = giglSchemas.priceData.safeParse({
      GrandTotal: '8941.43',
    });

    expect(result.success).toBe(false);
  });
});

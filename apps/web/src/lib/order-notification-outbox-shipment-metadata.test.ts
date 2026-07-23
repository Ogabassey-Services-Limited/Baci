import { describe, expect, it } from 'vitest';
import { resolveOrderNotificationOutboxShipmentMetadata } from './order-notification-outbox-shipment-metadata';

describe('resolveOrderNotificationOutboxShipmentMetadata', () => {
  it('returns the immutable fulfillment-cycle snapshot', () => {
    expect(
      resolveOrderNotificationOutboxShipmentMetadata({
        fulfillment_courier_name: 'GIGL',
        fulfillment_tracking_number: 'CYCLE-2',
        fulfillment_tracking_token: 'cycle-token-2',
      })
    ).toEqual({
      courierName: 'GIGL',
      trackingNumber: 'CYCLE-2',
      trackingToken: 'cycle-token-2',
    });
  });

  it('preserves legacy manual overrides', () => {
    expect(
      resolveOrderNotificationOutboxShipmentMetadata({
        fulfillment_courier_name: 'GIGL',
        fulfillment_tracking_number: 'AUTOMATED-1',
        manual_courier_name: 'DHL',
        manual_estimated_delivery: '2026-07-15',
        manual_tracking_number: 'MANUAL-1',
      })
    ).toEqual({
      courierName: 'DHL',
      estimatedDelivery: '2026-07-15',
      trackingNumber: 'MANUAL-1',
      trackingToken: undefined,
    });
  });

  it('preserves explicit nulls so later order data cannot leak into an older cycle', () => {
    expect(
      resolveOrderNotificationOutboxShipmentMetadata({
        fulfillment_courier_name: null,
        fulfillment_tracking_number: null,
        fulfillment_tracking_token: null,
      })
    ).toEqual({
      courierName: null,
      estimatedDelivery: undefined,
      trackingNumber: null,
      trackingToken: null,
    });
  });

  it('normalizes empty snapshot fields without discarding the entire cycle', () => {
    expect(
      resolveOrderNotificationOutboxShipmentMetadata({
        fulfillment_courier_name: '',
        fulfillment_tracking_number: ' TRACK-1 ',
        fulfillment_tracking_token: '',
      })
    ).toEqual({
      courierName: null,
      estimatedDelivery: undefined,
      trackingNumber: 'TRACK-1',
      trackingToken: null,
    });
  });
});

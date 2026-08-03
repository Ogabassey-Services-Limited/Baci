import { describe, expect, it } from 'vitest';
import {
  GIGL_PICKUP_EN_ROUTE_RAW_STATUS,
  getGiglTrackingNotificationPolicies,
} from '../gigl-tracking-notification-policy-matrix';
import { normalizeGiglTrackingShipment } from './gigl.tracking-normalizer';

describe('normalizeGiglTrackingShipment notification policy fields', () => {
  it('preserves the pickup-en-route reason for notification policy matching', () => {
    const result = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        MobileShipmentTrackings: [
          {
            Status: 'MENP',
            ScanStatusReason: 'RIDER EN ROUTE FOR PICKUP',
            DateTimeUtc: '2026-03-02T10:59:41.000Z',
          },
        ],
      },
      'GIGL123',
      new Date('2026-03-02T11:00:00.000Z')
    );

    expect(result.events[0]).toMatchObject({
      description: 'RIDER EN ROUTE FOR PICKUP',
      rawStatus: GIGL_PICKUP_EN_ROUTE_RAW_STATUS,
      status: 'pickup_scheduled',
    });
    expect(
      getGiglTrackingNotificationPolicies(
        result.events[0]?.rawStatus ?? '',
        'pickup_scheduled'
      )
    ).toEqual([
      {
        audience: 'merchant',
        rawStatus: GIGL_PICKUP_EN_ROUTE_RAW_STATUS,
        notificationKind: 'pickup_en_route',
      },
    ]);
  });

  it('canonicalizes a mixed-case pickup-en-route reason with whitespace', () => {
    const result = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        MobileShipmentTrackings: [
          {
            Status: 'MENP',
            ScanStatusReason: '  rider en route for pickup  ',
            DateTimeUtc: '2026-03-02T10:59:41.000Z',
          },
        ],
      },
      'GIGL123',
      new Date('2026-03-02T11:00:00.000Z')
    );

    expect(result.events[0]?.rawStatus).toBe(GIGL_PICKUP_EN_ROUTE_RAW_STATUS);
    expect(
      getGiglTrackingNotificationPolicies(
        result.events[0]?.rawStatus ?? '',
        'pickup_scheduled'
      )[0]?.notificationKind
    ).toBe('pickup_en_route');
  });

  it('uses an incident pickup-en-route message when the reason is absent', () => {
    const result = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        MobileShipmentTrackings: [
          {
            Status: 'MENP',
            ScanStatusIncident: 'rider en route for pickup',
            DateTimeUtc: '2026-03-02T10:59:41.000Z',
          },
        ],
      },
      'GIGL123',
      new Date('2026-03-02T11:00:00.000Z')
    );

    expect(result.events[0]?.rawStatus).toBe(GIGL_PICKUP_EN_ROUTE_RAW_STATUS);
    expect(
      getGiglTrackingNotificationPolicies(
        result.events[0]?.rawStatus ?? '',
        'pickup_scheduled'
      )[0]?.notificationKind
    ).toBe('pickup_en_route');
  });
});

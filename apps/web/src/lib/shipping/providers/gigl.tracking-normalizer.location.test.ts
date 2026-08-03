import { describe, expect, it } from 'vitest';
import { normalizeGiglTrackingShipment } from './gigl.tracking-normalizer';

describe('normalizeGiglTrackingShipment location fallback', () => {
  it('prefers event location and uses service-centre location only as fallback', () => {
    const result = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        MobileShipmentTrackings: [
          {
            Status: 'MAPT',
            Location: 'Event location',
            DepartureServiceCentre: {
              Name: 'Centre name',
              Address: 'Centre address',
            },
            DateTimeUtc: '2026-03-02T10:59:41.000Z',
          },
          {
            Status: 'MENP',
            DepartureServiceCentre: {
              Name: 'Fallback centre',
            },
            DateTimeUtc: '2026-03-02T10:58:41.000Z',
          },
        ],
      },
      'GIGL123',
      new Date('2026-03-02T11:00:00.000Z')
    );

    expect(result.events.map((event) => event.location)).toEqual([
      'Event location',
      'Fallback centre',
    ]);
  });
});

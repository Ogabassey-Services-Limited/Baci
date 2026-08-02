import { describe, expect, it } from 'vitest';
import { normalizeGiglTrackingShipment } from './gigl.tracking-normalizer';

describe('normalizeGiglTrackingShipment', () => {
  it('normalizes documented GIGL events and preserves the provider event key', () => {
    const result = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        PickupOptions: 0,
        MobileShipmentTrackings: [
          {
            MobileShipmentTrackingId: 3738770,
            Status: 'MAPT',
            ScanStatusReason: 'SHIPMENT ASSIGNED FOR PICKUP',
            DateTimeUtc: '2026-03-02T10:59:41.000Z',
          },
        ],
      },
      'GIGL123',
      new Date('2026-03-02T11:00:00.000Z')
    );

    expect(result.status).toBe('pickup_scheduled');
    expect(result.events[0]).toMatchObject({
      providerEventId: '3738770',
      providerEventKey: 'mobile:3738770',
      rawStatus: 'MAPT',
      status: 'pickup_scheduled',
      timestamp: new Date('2026-03-02T10:59:41.000Z'),
    });
  });

  it('rejects a nonempty response waybill that differs from the requested waybill', () => {
    expect(() =>
      normalizeGiglTrackingShipment(
        {
          Waybill: 'OTHER-WAYBILL',
          MobileShipmentTrackings: [
            {
              Status: 'SHD',
              DateTimeUtc: '2026-03-02T10:59:41.000Z',
            },
          ],
        },
        'GIGL123',
        new Date('2026-03-02T11:00:00.000Z')
      )
    ).toThrow('GIGL tracking waybill does not match requested waybill');
  });

  it('uses a bounded deterministic hash key for an event without provider IDs', () => {
    const shipment = {
      Waybill: 'W'.repeat(128),
      MobileShipmentTrackings: [
        {
          Status: 'S'.repeat(128),
          ScanStatusReason: 'Shipment delivered',
          DateTimeUtc: '2026-03-02T10:59:41.000Z',
        },
      ],
    };
    const observedAt = new Date('2026-03-02T11:00:00.000Z');

    const first = normalizeGiglTrackingShipment(
      shipment,
      shipment.Waybill,
      observedAt
    );
    const second = normalizeGiglTrackingShipment(
      shipment,
      shipment.Waybill,
      observedAt
    );

    expect(first.events[0]?.providerEventKey).toMatch(
      /^fallback:[a-f0-9]{64}$/
    );
    expect(first.events[0]?.providerEventKey?.length).toBeLessThanOrEqual(256);
    expect(first.events[0]?.providerEventKey).toBe(
      second.events[0]?.providerEventKey
    );
  });

  it('distinguishes provider-id-less scans with the same status and timestamp', () => {
    const observedAt = new Date('2026-03-02T12:00:00.000Z');
    const common = {
      Status: 'InTransit',
      DateTimeUtc: '2026-03-02T11:00:00.000Z',
    };

    const first = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        MobileShipmentTrackings: [{ ...common, Location: 'Ikeja' }],
      },
      'GIGL123',
      observedAt
    );
    const second = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        MobileShipmentTrackings: [{ ...common, Location: 'Port Harcourt' }],
      },
      'GIGL123',
      observedAt
    );

    expect(first.events[0]?.providerEventKey).not.toBe(
      second.events[0]?.providerEventKey
    );
  });

  it('includes both scan detail fields in provider-id-less event identity', () => {
    const observedAt = new Date('2026-03-02T12:00:00.000Z');
    const common = {
      Status: 'InTransit',
      ScanStatusReason: 'Shipment moving',
      DateTimeUtc: '2026-03-02T11:00:00.000Z',
    };

    const first = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        MobileShipmentTrackings: [
          { ...common, ScanStatusIncident: 'Sorting complete' },
        ],
      },
      'GIGL123',
      observedAt
    );
    const second = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        MobileShipmentTrackings: [
          { ...common, ScanStatusIncident: 'Held for inspection' },
        ],
      },
      'GIGL123',
      observedAt
    );

    expect(first.events[0]?.providerEventKey).not.toBe(
      second.events[0]?.providerEventKey
    );
  });

  it('keeps the newest recognized lifecycle state when a newer scan is unknown', () => {
    const result = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        MobileShipmentTrackings: [
          {
            Status: 'UNPUBLISHED_CODE',
            DateTimeUtc: '2026-03-02T12:00:00.000Z',
          },
          {
            Status: 'SHD',
            DateTimeUtc: '2026-03-02T11:00:00.000Z',
          },
        ],
      },
      'GIGL123',
      new Date('2026-03-02T12:01:00.000Z')
    );

    expect(result.status).toBe('delivered');
    expect(result.hasRecognizedLifecycleEvent).toBe(true);
    expect(result.events[0]?.rawStatus).toBe('UNPUBLISHED_CODE');
  });

  it('checks the incident when the reason has no recognized lifecycle state', () => {
    const result = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        MobileShipmentTrackings: [
          {
            Status: 'UNPUBLISHED_CODE',
            ScanStatusReason: 'Provider-specific reason',
            ScanStatusIncident: 'Shipment delivered',
            DateTimeUtc: '2026-03-02T12:00:00.000Z',
          },
        ],
      },
      'GIGL123',
      new Date('2026-03-02T12:01:00.000Z')
    );

    expect(result.status).toBe('delivered');
    expect(result.hasRecognizedLifecycleEvent).toBe(true);
  });

  it('trims whitespace-only descriptions before falling back to the incident', () => {
    const result = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        MobileShipmentTrackings: [
          {
            Status: 'UNPUBLISHED_CODE',
            ScanStatusReason: '   ',
            ScanStatusIncident: 'Shipment delayed',
            DateTimeUtc: '2026-03-02T12:00:00.000Z',
          },
        ],
      },
      'GIGL123',
      new Date('2026-03-02T12:01:00.000Z')
    );

    expect(result.events[0]?.description).toBe('Shipment delayed');
  });

  it('skips a malformed event while preserving valid tracking history', () => {
    const result = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        MobileShipmentTrackings: [
          { Status: 'SHD', DateTimeUtc: 'not-a-timestamp' },
          { Status: 'InTransit', DateTimeUtc: '2026-03-02T11:00:00.000Z' },
        ],
      },
      'GIGL123',
      new Date('2026-03-02T12:00:00.000Z')
    );

    expect(result.status).toBe('in_transit');
    expect(result.events).toHaveLength(1);
  });

  it('interprets a bare DateTimeUtc value as UTC', () => {
    const result = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        MobileShipmentTrackings: [
          { Status: 'InTransit', DateTimeUtc: '2026-03-02T11:00:00' },
        ],
      },
      'GIGL123',
      new Date('2026-03-02T12:00:00.000Z')
    );

    expect(result.events[0]?.timestamp.toISOString()).toBe(
      '2026-03-02T11:00:00.000Z'
    );
  });

  it('returns a pending event when no lifecycle code is recognized', () => {
    const result = normalizeGiglTrackingShipment(
      {
        Waybill: 'GIGL123',
        MobileShipmentTrackings: [
          {
            Status: 'UNPUBLISHED_CODE',
            DateTimeUtc: '2026-03-02T11:00:00.000Z',
          },
        ],
      },
      'GIGL123',
      new Date('2026-03-02T12:00:00.000Z')
    );

    expect(result).toMatchObject({
      hasRecognizedLifecycleEvent: false,
      status: 'pending',
    });
    expect(result.events[0]).toMatchObject({
      rawStatus: 'UNPUBLISHED_CODE',
      status: 'pending',
    });
  });

  it('throws when every tracking event is malformed', () => {
    const shipment = {
      Waybill: 'GIGL123',
      MobileShipmentTrackings: [
        { Status: 'SHD', DateTimeUtc: 'not-a-timestamp' },
        { Status: 'MAPT' },
      ],
    };

    expect(() =>
      normalizeGiglTrackingShipment(
        shipment,
        'GIGL123',
        new Date('2026-03-02T12:00:00.000Z')
      )
    ).toThrow('GIGL tracking result has no valid tracking events');
  });

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

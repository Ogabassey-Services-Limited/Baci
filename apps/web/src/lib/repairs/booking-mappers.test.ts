import { describe, expect, it } from 'vitest';
import {
  BOOKING_DETAIL_COLUMNS,
  BOOKING_LIST_COLUMNS,
  mapBookingDetail,
  mapBookingRow,
} from './booking-mappers';

const listRow = {
  id: 'r-1',
  ticket_number: 1042,
  status: 'in_progress',
  device_type: 'Smartphone',
  device_model: 'iPhone 15',
  repair_type_label: 'Screen Replacement',
  quoted_price: '45000.00',
  estimated_cost: null,
  service_type: 'pickup',
  created_at: '2026-07-01T00:00:00.000Z',
  customer_name: 'Ada Lovelace',
};

describe('mapBookingRow', () => {
  it('maps a list row with a derived device label and numeric price', () => {
    expect(mapBookingRow(listRow)).toEqual({
      id: 'r-1',
      ticketNumber: 1042,
      status: 'in_progress',
      deviceLabel: 'Smartphone iPhone 15',
      deviceType: 'Smartphone',
      deviceModel: 'iPhone 15',
      repairTypeLabel: 'Screen Replacement',
      quotedPrice: 45_000,
      estimatedCost: null,
      serviceType: 'pickup',
      createdAt: '2026-07-01T00:00:00.000Z',
      customerName: 'Ada Lovelace',
    });
  });

  it('falls back to safe defaults for unknown status/service and empty device', () => {
    const mapped = mapBookingRow({
      ...listRow,
      status: 'weird',
      service_type: 'x',
      device_type: null,
      device_model: null,
    });
    expect(mapped.status).toBe('pending');
    expect(mapped.serviceType).toBe('dropoff');
    expect(mapped.deviceLabel).toBe('Device');
  });

  it('falls back to 0 (never NaN) for a missing or non-numeric ticket number', () => {
    expect(
      mapBookingRow({ ...listRow, ticket_number: null }).ticketNumber
    ).toBe(0);
    expect(
      mapBookingRow({ ...listRow, ticket_number: 'not-a-number' }).ticketNumber
    ).toBe(0);
    expect(
      mapBookingRow({ ...listRow, ticket_number: undefined }).ticketNumber
    ).toBe(0);
  });
});

describe('mapBookingDetail', () => {
  it('adds detail fields and the tracking number', () => {
    const detail = mapBookingDetail(
      {
        ...listRow,
        customer_email: 'ada@example.com',
        customer_phone: '08012345678',
        issue_description: 'cracked screen',
        admin_notes: 'diagnosed',
        pickup_address: '12 Aba Road',
        preferred_date: '2026-07-02T00:00:00.000Z',
        updated_at: '2026-07-05T00:00:00.000Z',
        shipment_id: 'ship-1',
        quote_id: 'q-1',
      },
      'TRK-1'
    );
    expect(detail).toMatchObject({
      customerEmail: 'ada@example.com',
      adminNotes: 'diagnosed',
      shipmentId: 'ship-1',
      trackingNumber: 'TRK-1',
    });
  });

  it('defaults tracking number to null', () => {
    expect(mapBookingDetail(listRow).trackingNumber).toBeNull();
  });
});

describe('column lists', () => {
  it('never uses a wildcard select', () => {
    expect(BOOKING_LIST_COLUMNS).not.toContain('*');
    expect(BOOKING_DETAIL_COLUMNS).toContain('customer_email');
  });
});

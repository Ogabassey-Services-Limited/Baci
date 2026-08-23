import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockClaim = vi.fn();
const mockFindReusable = vi.fn();

vi.mock('@/lib/shipping/order-shipment-booking-lock', () => ({
  claimOrderShipmentBooking: mockClaim,
}));

vi.mock('@/lib/shipping/find-reusable-order-shipment', () => ({
  findReusableOrderShipment: mockFindReusable,
}));

const { prepareDirectBookingAttempt } = await import(
  './prepare-direct-booking-attempt'
);

const existingShipment = {
  shipmentId: 'shipment-1',
  provider: 'GIGL' as const,
  providerShipmentId: 'waybill-1',
  trackingNumber: 'waybill-1',
  carrierName: 'GIG Logistics',
  quoteId: '',
  estimatedDays: 3,
  shipmentStatus: 'booked' as const,
};

describe('prepareDirectBookingAttempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the lock claim without querying shipments when claimed', async () => {
    mockClaim.mockResolvedValue({ status: 'claimed', lockToken: 'lock-1' });

    await expect(
      prepareDirectBookingAttempt({} as never, 'merchant-1', 'order-1')
    ).resolves.toEqual({ status: 'claimed', lockToken: 'lock-1' });

    expect(mockFindReusable).not.toHaveBeenCalled();
  });

  it('recovers a complete shipment instead of allowing a second provider booking', async () => {
    mockClaim.mockResolvedValue({ status: 'in_progress' });
    mockFindReusable.mockResolvedValue(existingShipment);

    await expect(
      prepareDirectBookingAttempt({} as never, 'merchant-1', 'order-1')
    ).resolves.toMatchObject({
      status: 'recovered',
      existingShipment,
      result: expect.objectContaining({
        provider: 'GIGL',
        providerShipmentId: 'waybill-1',
        trackingNumber: 'waybill-1',
      }),
    });
  });

  it('keeps an in-progress response when no shipment was persisted', async () => {
    mockClaim.mockResolvedValue({ status: 'in_progress' });
    mockFindReusable.mockResolvedValue(null);

    await expect(
      prepareDirectBookingAttempt({} as never, 'merchant-1', 'order-1')
    ).resolves.toEqual({ status: 'in_progress' });
  });
});

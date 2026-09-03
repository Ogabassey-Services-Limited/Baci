import { describe, expect, it, vi } from 'vitest';
import { finalizeRepairPickupBooking } from './finalize-repair-pickup-booking';

describe('finalizeRepairPickupBooking', () => {
  it('returns shipment_save_failed when the booked shipment cannot be updated', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'write failed' },
    });
    const eqMerchant = vi.fn().mockReturnValue({ select: () => ({ single }) });
    const eqId = vi.fn().mockReturnValue({ eq: eqMerchant });
    const update = vi.fn().mockReturnValue({ eq: eqId });
    const from = vi.fn().mockReturnValue({ update });

    const result = await finalizeRepairPickupBooking({
      booking: {
        carrierName: 'GIG Logistics',
        isStationPickup: false,
        provider: 'GIGL',
        providerShipmentId: 'prov-1',
        status: 'pending',
        trackingNumber: '1349000000',
      },
      lockToken: 'lock-1',
      merchantId: '123e4567-e89b-12d3-a456-426614174000',
      quoteId: 'quote-1',
      repairId: '223e4567-e89b-12d3-a456-426614174000',
      shipmentId: 'shipment-1',
      supabase: { from } as never,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'shipment_save_failed',
    });
    expect(from).toHaveBeenCalledWith('shipments');
  });
});
